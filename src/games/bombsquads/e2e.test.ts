import { describe, expect, it } from 'vitest'
import { Connection } from './connection'
import type { LobbyMessage, ServerMessage, Snapshot, WelcomeMessage } from './messages'

/**
 * Teste de integração com o servidor local (wrangler dev, porta 8787), via
 * WebSocket nativo do Node. Só roda com BS_E2E=1 e servidor no ar; sem isso
 * pula, para o suite continuar verde em qualquer lugar.
 */
const BASE = 'http://127.0.0.1:8787'
const WS = 'ws://127.0.0.1:8787'

const up = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1200) })
  .then((res) => res.ok)
  .catch(() => false)

type Player = {
  welcome: Promise<WelcomeMessage>
  lobby: () => LobbyMessage | undefined
  snapshots: () => Snapshot[]
  latest: () => Snapshot | undefined
  send: Connection['send']
  stop: () => void
}

function makePlayer(code: string, name: string, session?: { playerId?: string; token?: string }): Player {
  let lobby: LobbyMessage | undefined
  const snapshots: Snapshot[] = []
  let resolveWelcome: (value: WelcomeMessage) => void = () => {}
  let rejectWelcome: (reason?: unknown) => void = () => {}

  const connection = new Connection({
    url: `${WS}/room/${code}`,
    hello: () => ({ t: 'hello', name, playerId: session?.playerId, token: session?.token }),
    onMessage: (msg: ServerMessage) => {
      if (msg.t === 'welcome') resolveWelcome(msg as WelcomeMessage)
      else if (msg.t === 'lobby') lobby = msg
      else if (msg.t === 'snapshot') snapshots.push((msg as { snapshot: Snapshot }).snapshot)
    },
    onStatus: () => {},
    onFatal: () => rejectWelcome(new Error(`${name}: conexão encerrada pelo servidor`)),
  })

  const welcome = new Promise<WelcomeMessage>((resolve, reject) => {
    resolveWelcome = resolve
    rejectWelcome = reject
  })
  connection.start()

  return {
    welcome,
    lobby: () => lobby,
    snapshots: () => snapshots,
    latest: () => snapshots[snapshots.length - 1],
    send: (message) => connection.send(message),
    stop: () => connection.stop(),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(
  check: () => boolean,
  timeoutMs = 8000,
  label = 'condição',
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (check()) return
    await sleep(50)
  }
  throw new Error(`${label} não aconteceu em ${timeoutMs}ms`)
}

const TIMEOUT = 20000

describe.skipIf(!up)('e2e do Bombsquads contra o servidor local', () => {
  it('dois jogadores entram, ficam prontos, começam e recebem snapshots', async () => {
    const created = await fetch(`${BASE}/new`, { method: 'POST', signal: AbortSignal.timeout(2000) })
    expect(created.ok).toBe(true)
    const { code } = (await created.json()) as { code?: string }
    expect(typeof code).toBe('string')

    const alice = makePlayer(code!, 'Alice')
    const bruno = makePlayer(code!, 'Bruno')
    const welcomeA = await alice.welcome
    await bruno.welcome
    expect(welcomeA.code).toBe(code)

    await waitFor(() => (alice.lobby()?.players.length ?? 0) === 2 && (bruno.lobby()?.players.length ?? 0) === 2, 8000, 'lobby com os dois')
    const lobby = alice.lobby()!
    expect(lobby.status).toBe('lobby')
    expect(lobby.players.map((player) => player.name).sort()).toEqual(['Alice', 'Bruno'])
    expect(lobby.minPlayers).toBe(2)
    expect(lobby.maxPlayers).toBe(10)

    alice.send({ t: 'ready', ready: true })
    bruno.send({ t: 'ready', ready: true })
    alice.send({ t: 'start' })

    // a partida vira playing e chegam snapshots com os dois jogadores
    await waitFor(() => alice.latest() !== undefined && alice.lobby()?.status === 'playing', 15000, 'snapshot após start')
    const snap = alice.latest()!
    expect(snap.players).toHaveLength(2)
    expect(bruno.latest()).not.toBeUndefined()

    // os ticks avançam com o tempo
    const tick = snap.tick
    await sleep(1500)
    expect((alice.latest()?.tick ?? 0)).toBeGreaterThan(tick)

    alice.stop()
    bruno.stop()
  }, TIMEOUT)

  it('reconecta com a sessão e mantém o playerId', async () => {
    const created = await fetch(`${BASE}/new`, { method: 'POST', signal: AbortSignal.timeout(2000) })
    const { code } = (await created.json()) as { code: string }

    const first = makePlayer(code, 'Cida')
    const welcome = await first.welcome
    first.stop()

    const second = makePlayer(code, 'Cida', { playerId: welcome.playerId, token: welcome.token })
    const again = await second.welcome
    expect(again.playerId).toBe(welcome.playerId)
    second.stop()
  }, TIMEOUT)
})
