/**
 * Contrato entre o cliente e o servidor do Bombsquads. Só tipos: o servidor e
 * o app importam daqui, então os dois lados não podem divergir.
 */
import type { GameEvent, MatchSettings, MatchState } from './sim'

export type Move = 'up' | 'down' | 'left' | 'right' | 'none'

export type ClientMessage =
  | { t: 'hello'; name: string; playerId?: string; token?: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'settings'; settings: MatchSettings }
  | { t: 'input'; move: Move; bomb: boolean }
  | { t: 'ping' }

export type LobbyPlayer = { id: string; name: string; ready: boolean; connected: boolean }

export type LobbyMessage = {
  t: 'lobby'
  code: string
  status: 'lobby' | 'playing'
  hostId: string | null
  minPlayers: number
  maxPlayers: number
  settings: MatchSettings
  players: LobbyPlayer[]
}

export type Snapshot = {
  tick: number
  phase: MatchState['phase']
  round: number
  timeLeft: number
  hurry: boolean
  sudden: boolean
  roundWinnerId: string | null
  scores: Record<string, number>
  /** Uma letra por célula, linha a linha: '#' parede, 'C' caixa, '.' livre. */
  map: { w: number; h: number; cells: string }
  players: Array<{
    id: string
    name: string
    pos: [number, number]
    cell: [number, number]
    facing: string
    alive: boolean
    connected: boolean
    fire: number
    bombs: number
    speed: number
    shield: boolean
  }>
  bombs: Array<{ id: number; x: number; y: number; ownerId: string; range: number }>
  blasts: Array<{ cells: Array<[number, number]> }>
  items: Array<{ id: number; x: number; y: number; type: string }>
  closing: { active: boolean; next: number; total: number; warning: Array<[number, number]> }
  events: GameEvent[]
}

export type WelcomeMessage = { t: 'welcome'; playerId: string; token: string; code: string }

export type ServerMessage =
  | WelcomeMessage
  | LobbyMessage
  | { t: 'snapshot'; snapshot: Snapshot }
  | { t: 'matchEnd'; winnerId: string | null; scores: Record<string, number> }
  | { t: 'error'; code: string }
  | { t: 'pong' }
