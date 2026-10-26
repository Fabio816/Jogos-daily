import { DurableObject } from 'cloudflare:workers'
import {
  configFromSettings,
  createMatch,
  DEFAULT_SETTINGS,
  setPlayerConnected,
  step,
  type GameEvent,
  type InputFrame,
  type MatchState,
} from '../../../src/games/bombsquads/sim'
import {
  addPlayer,
  canStart,
  findPlayer,
  newLobby,
  removePlayer,
  resetReady,
  purgeDisconnected,
  setPlayerPresence,
  setReady,
  setSettings,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type LobbyState,
} from './lobby'
import { parseClientMessage, type ClientMessage } from './protocol'
import { buildSnapshot, type ServerMessage } from './snapshot'

const TICK_RATE = 30
const TICK_MS = 1000 / TICK_RATE
/** Quanto tempo um jogador que caiu ainda pode voltar ao lobby sem perder o lugar. */
const LOBBY_GRACE_MS = 60_000
/** Snapshot a cada 2 ticks: 15 Hz. */
const SNAPSHOT_EVERY = 2
/** Limite de mensagens recebidas por conexão, por segundo. */
const MAX_MESSAGES_PER_SECOND = 60

type Attachment = { playerId: string | null }

/**
 * Uma sala = um Durable Object. O lobby fica salvo em storage (sobrevive ao
 * hibernar). A partida roda em memória com um timer de 30 Hz, que só existe
 * enquanto há partida: fora dela o objeto pode hibernar.
 */
export class Room extends DurableObject<Env> {
  private lobby: LobbyState = newLobby()
  private match: MatchState | null = null
  private inputs = new Map<string, InputFrame>()
  private pendingEvents: GameEvent[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private tickCount = 0
  private rate = new WeakMap<WebSocket, { count: number; windowStart: number }>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<LobbyState>('lobby')
      if (saved) this.lobby = { ...saved, settings: saved.settings ?? { ...DEFAULT_SETTINGS } }
      // Se o objeto foi reiniciado no meio de uma partida, a partida se perdeu.
      if (this.lobby.status === 'playing') {
        this.lobby.status = 'lobby'
        resetReady(this.lobby)
        await this.persist()
      }
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }
    if (!this.lobby.code) {
      this.lobby.code = new URL(request.url).pathname.split('/')[2] ?? ''
      await this.persist()
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.allowMessage(ws) || typeof message !== 'string') {
      this.send(ws, { t: 'error', code: 'bad_message' })
      return
    }

    const msg = parseClientMessage(message)
    if (!msg) {
      this.send(ws, { t: 'error', code: 'bad_message' })
      return
    }

    await this.handle(ws, msg)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.disconnect(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.disconnect(ws)
  }

  private async handle(ws: WebSocket, msg: ClientMessage): Promise<void> {
    if (msg.t === 'ping') {
      this.send(ws, { t: 'pong' })
      return
    }

    if (msg.t === 'hello') {
      await this.hello(ws, msg)
      return
    }

    const playerId = this.playerOf(ws)
    if (!playerId) {
      this.send(ws, { t: 'error', code: 'not_joined' })
      return
    }

    if (msg.t === 'input') {
      this.inputs.set(playerId, { move: msg.move, bomb: msg.bomb })
      return
    }

    if (msg.t === 'ready') {
      if (this.lobby.status !== 'lobby') return this.send(ws, { t: 'error', code: 'match_in_progress' })
      setReady(this.lobby, playerId, msg.ready)
      await this.persist()
      this.broadcastLobby()
      return
    }

    if (msg.t === 'settings') {
      const result = setSettings(this.lobby, playerId, msg.settings)
      if (!result.ok) return this.send(ws, { t: 'error', code: result.error })
      await this.persist()
      this.broadcastLobby()
      return
    }

    if (msg.t === 'start') {
      const check = canStart(this.lobby, playerId)
      if (!check.ok) return this.send(ws, { t: 'error', code: check.error })
      await this.startMatch()
    }
  }

  private async hello(ws: WebSocket, msg: Extract<ClientMessage, { t: 'hello' }>): Promise<void> {
    if (this.playerOf(ws)) return this.send(ws, { t: 'error', code: 'already_joined' })

    if (msg.playerId && msg.token) {
      await this.reconnect(ws, msg.playerId, msg.token)
      return
    }

    const id = crypto.randomUUID()
    const token = crypto.randomUUID() + crypto.randomUUID()
    const result = addPlayer(this.lobby, { id, token, name: msg.name })
    if (!result.ok) return this.send(ws, { t: 'error', code: result.error })

    ws.serializeAttachment({ playerId: id } satisfies Attachment)
    await this.persist()
    this.send(ws, { t: 'welcome', playerId: id, token, code: this.lobby.code })
    this.broadcastLobby()
  }

  private async reconnect(ws: WebSocket, playerId: string, token: string): Promise<void> {
    const player = findPlayer(this.lobby, playerId)
    if (!player || player.token !== token) return this.send(ws, { t: 'error', code: 'bad_token' })

    // Um socket antigo do mesmo jogador é substituído pelo novo.
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && this.playerOf(other) === playerId) {
        other.serializeAttachment({ playerId: null } satisfies Attachment)
        other.close(4001, 'replaced')
      }
    }

    setPlayerPresence(this.lobby, playerId, true)
    ws.serializeAttachment({ playerId } satisfies Attachment)
    this.send(ws, { t: 'welcome', playerId, token, code: this.lobby.code })
    // Sempre manda o lobby: é ele que diz ao cliente que a partida está 'playing'.
    // Sem ele, quem recarrega no meio da partida cai no formulário de entrada.
    this.send(ws, this.lobbyMessage())

    if (this.match) {
      setPlayerConnected(this.match, playerId, true)
      this.send(ws, { t: 'snapshot', snapshot: buildSnapshot(this.match, []) })
    } else {
      this.broadcastLobby()
    }
  }

  private async disconnect(ws: WebSocket): Promise<void> {
    const playerId = this.playerOf(ws)
    if (!playerId) return

    // Se o jogador já reconectou por outro socket, não mexe nele.
    const stillOnline = this.ctx.getWebSockets().some((other) => other !== ws && this.playerOf(other) === playerId)
    if (stillOnline) return

    if (this.match) {
      setPlayerConnected(this.match, playerId, false)
      this.inputs.delete(playerId)
      return
    }

    // No lobby, presença com tolerância: dá tempo de recarregar a página sem
    // perder o lugar (e manter a sessão/token de reconexão).
    setPlayerPresence(this.lobby, playerId, false)
    await this.persist()
    this.broadcastLobby()
    await this.schedulePurgeAlarm()
  }

  /** Tira do lobby quem ficou desconectado por mais de 60 s, via alarme da DO. */
  private async schedulePurgeAlarm(): Promise<void> {
    const current = await this.ctx.storage.getAlarm()
    if (current !== null) return
    await this.ctx.storage.setAlarm(Date.now() + LOBBY_GRACE_MS)
  }

  async alarm(): Promise<void> {
    if (this.match) return
    if (purgeDisconnected(this.lobby)) {
      await this.persist()
      this.broadcastLobby()
    }
  }

  private async startMatch(): Promise<void> {
    this.lobby.status = 'playing'
    await this.persist()

    this.inputs.clear()
    this.pendingEvents = []
    this.tickCount = 0
    this.match = createMatch(
      this.lobby.players.map((player) => player.id),
      {
        seed: Math.floor(Math.random() * 0xffffffff),
        names: Object.fromEntries(this.lobby.players.map((player) => [player.id, player.name])),
        config: configFromSettings(this.lobby.settings),
      },
    )

    this.broadcastLobby()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  private tick(): void {
    const match = this.match
    if (!match) return this.stopTimer()

    if (match.players.every((player) => !player.connected)) {
      return void this.finishMatch(null, match)
    }

    const inputs: Record<string, InputFrame> = {}
    for (const player of match.players) {
      inputs[player.id] = this.inputs.get(player.id) ?? { move: 'none', bomb: false }
    }

    step(match, inputs)
    this.pendingEvents.push(...match.events)
    this.tickCount += 1

    if (this.tickCount % SNAPSHOT_EVERY === 0) {
      const snapshot = buildSnapshot(match, this.pendingEvents)
      this.pendingEvents = []
      this.broadcast({ t: 'snapshot', snapshot })
    }

    if (match.phase === 'matchEnd') {
      void this.finishMatch(match.matchWinnerId, match)
    }
  }

  private async finishMatch(winnerId: string | null, match: MatchState): Promise<void> {
    this.stopTimer()
    this.match = null
    this.inputs.clear()

    this.broadcast({
      t: 'matchEnd',
      winnerId,
      scores: Object.fromEntries(match.players.map((player) => [player.id, player.score])),
    })

    // Quem saiu durante a partida não volta para o lobby.
    for (const player of match.players) {
      if (!player.connected) removePlayer(this.lobby, player.id)
    }
    this.lobby.status = 'lobby'
    resetReady(this.lobby)
    await this.persist()
    this.broadcastLobby()
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private playerOf(ws: WebSocket): string | null {
    const attachment = ws.deserializeAttachment() as Attachment | null
    return attachment?.playerId ?? null
  }

  private allowMessage(ws: WebSocket): boolean {
    const now = Date.now()
    const entry = this.rate.get(ws)
    if (!entry || now - entry.windowStart >= 1000) {
      this.rate.set(ws, { count: 1, windowStart: now })
      return true
    }
    entry.count += 1
    return entry.count <= MAX_MESSAGES_PER_SECOND
  }

  private broadcastLobby(): void {
    this.broadcast(this.lobbyMessage())
  }

  private lobbyMessage(): ServerMessage {
    return {
      t: 'lobby',
      code: this.lobby.code,
      status: this.lobby.status,
      hostId: this.lobby.hostId,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      settings: this.lobby.settings,
      players: this.lobby.players.map((player) => ({ id: player.id, name: player.name, ready: player.ready, connected: player.connected })),
    }
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put('lobby', this.lobby)
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg))
  }

  private broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) ws.send(payload)
  }
}
