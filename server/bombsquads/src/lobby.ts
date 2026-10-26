import { DEFAULT_SETTINGS, type MatchSettings } from '../../../src/games/bombsquads/sim'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 10

export type LobbyPlayer = {
  id: string
  name: string
  /** Segredo para reconectar. Nunca vai para outros jogadores. */
  token: string
  ready: boolean
  /** Falso quando a conexão caiu; volta a true quando o jogador reconecta. */
  connected: boolean
}

export type LobbyState = {
  code: string
  status: 'lobby' | 'playing'
  hostId: string | null
  players: LobbyPlayer[]
  settings: MatchSettings
}

export function newLobby(code = ''): LobbyState {
  return { code, status: 'lobby', hostId: null, players: [], settings: { ...DEFAULT_SETTINGS } }
}

export function findPlayer(lobby: LobbyState, id: string): LobbyPlayer | undefined {
  return lobby.players.find((player) => player.id === id)
}

export function addPlayer(
  lobby: LobbyState,
  input: { id: string; token: string; name: string },
): { ok: true; player: LobbyPlayer } | { ok: false; error: 'room_full' | 'match_in_progress' } {
  if (lobby.status === 'playing') return { ok: false, error: 'match_in_progress' }
  if (lobby.players.length >= MAX_PLAYERS) return { ok: false, error: 'room_full' }

  const player: LobbyPlayer = { id: input.id, name: input.name, token: input.token, ready: false, connected: true }
  lobby.players.push(player)
  if (lobby.hostId === null) lobby.hostId = player.id
  return { ok: true, player }
}

/** Remove o jogador do lobby. Se era o host, o próximo da fila vira host. */
export function removePlayer(lobby: LobbyState, id: string): void {
  lobby.players = lobby.players.filter((player) => player.id !== id)
  if (lobby.hostId === id) lobby.hostId = lobby.players[0]?.id ?? null
}

/** Marca presença caindo/conectando no lobby. Reconnect mantém o token. */
export function setPlayerPresence(lobby: LobbyState, id: string, connected: boolean): void {
  const player = findPlayer(lobby, id)
  if (player) player.connected = connected
}

/** Tira os desconectados há muito tempo do lobby (o alarme da Durable Object chama isso). */
export function purgeDisconnected(lobby: LobbyState): boolean {
  const before = lobby.players.length
  for (const player of [...lobby.players]) {
    if (!player.connected) removePlayer(lobby, player.id)
  }
  return lobby.players.length !== before
}

export function setReady(lobby: LobbyState, id: string, ready: boolean): boolean {
  const player = findPlayer(lobby, id)
  if (!player) return false
  player.ready = ready
  return true
}

export function resetReady(lobby: LobbyState): void {
  for (const player of lobby.players) player.ready = false
}

/** Pode começar: host pede, 2 a 10 jogadores, todos prontos. */
export function canStart(
  lobby: LobbyState,
  requesterId: string,
): { ok: true } | { ok: false; error: 'not_host' | 'not_enough_players' | 'not_ready' | 'match_in_progress' } {
  if (lobby.status === 'playing') return { ok: false, error: 'match_in_progress' }
  if (lobby.hostId !== requesterId) return { ok: false, error: 'not_host' }
  if (lobby.players.length < MIN_PLAYERS) return { ok: false, error: 'not_enough_players' }
  if (!lobby.players.every((player) => player.ready)) return { ok: false, error: 'not_ready' }
  return { ok: true }
}

/** Só o host muda as configurações, e só com a partida parada. */
export function setSettings(
  lobby: LobbyState,
  requesterId: string,
  settings: MatchSettings,
): { ok: true } | { ok: false; error: 'not_host' | 'match_in_progress' } {
  if (lobby.status === 'playing') return { ok: false, error: 'match_in_progress' }
  if (lobby.hostId !== requesterId) return { ok: false, error: 'not_host' }
  lobby.settings = { ...settings }
  return { ok: true }
}
