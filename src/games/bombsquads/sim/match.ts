import { initialClosing } from './closing'
import { createMap, generateMap, mapDimensions } from './map'
import { DEFAULT_CONFIG } from './rules'
import { ticks } from './time'
import type { MapState, MatchConfig, MatchState, PlayerState } from './types'

export { ticks } from './time'

export type CreateMatchOptions = {
  seed?: number
  config?: Partial<MatchConfig>
  names?: Record<string, string>
}

const EMPTY_MAP: MapState = { width: 0, height: 0, cells: [], spawns: [] }

export function createMatch(playerIds: string[], options: CreateMatchOptions = {}): MatchState {
  const config: MatchConfig = { ...DEFAULT_CONFIG, ...options.config }

  if (playerIds.length === 0) {
    throw new Error('createMatch needs at least one player')
  }
  if (playerIds.length > 10) {
    throw new Error('createMatch supports at most 10 players')
  }

  const players: PlayerState[] = playerIds.map((id, slot) => ({
    id,
    slot,
    name: options.names?.[id] ?? id,
    pos: { x: 0, y: 0 },
    cell: { x: 0, y: 0 },
    facing: 'down',
    alive: true,
    connected: true,
    disconnectTicks: 0,
    spawnProtectionTicks: 0,
    stats: {
      fire: 1,
      bombs: 1,
      speed: config.speedBase,
    },
    abilities: {
      kick: false,
      punch: false,
      throw: false,
    },
    activeBombs: 0,
    lastBombInput: false,
    score: 0,
  }))

  const state: MatchState = {
    tick: 0,
    phase: 'countdown',
    round: 1,
    timeLeftTicks: ticks(config.roundSeconds, config),
    countdownTicks: ticks(config.countdownSeconds, config),
    roundEndTick: 0,
    hurry: false,
    sudden: false,
    roundWinnerId: null,
    matchWinnerId: null,
    config,
    map: EMPTY_MAP,
    players,
    bombs: [],
    blasts: [],
    items: [],
    closing: initialClosing(),
    events: [],
    rngState: (options.seed ?? 1) >>> 0 || 1,
    nextIds: {
      bomb: 1,
      blast: 1,
      item: 1,
    },
  }

  startRound(state)
  return state
}

/** Gera (ou cria, se houver mapa fixo) o mapa do round e posiciona os jogadores. */
export function startRound(state: MatchState): void {
  state.map = state.config.mapTemplate
    ? createMap(state.config.mapTemplate)
    : generateMap(
        state.players.length,
        state,
        mapDimensions(state.config.mapSize, state.players.length),
        state.config.crateDensity,
      )

  if (state.map.spawns.length < state.players.length) {
    throw new Error(
      `map has ${state.map.spawns.length} spawns but ${state.players.length} players were provided`,
    )
  }

  state.phase = 'countdown'
  state.countdownTicks = ticks(state.config.countdownSeconds, state.config)
  state.timeLeftTicks = ticks(state.config.roundSeconds, state.config)
  state.roundEndTick = 0
  state.hurry = false
  state.sudden = false
  state.roundWinnerId = null
  state.bombs = []
  state.blasts = []
  state.items = []
  state.closing = initialClosing()
  state.events = []

  for (const player of state.players) {
    const spawn = state.map.spawns[player.slot]
    player.pos = { x: spawn.x, y: spawn.y }
    player.cell = { x: spawn.x, y: spawn.y }
    player.facing = 'down'
    player.alive = true
    player.spawnProtectionTicks = 0
    player.stats = {
      fire: 1,
      bombs: 1,
      speed: state.config.speedBase,
    }
    player.abilities = {
      kick: false,
      punch: false,
      throw: false,
    }
    player.activeBombs = 0
    player.lastBombInput = false
    player.disconnectTicks = player.connected
      ? 0
      : ticks(state.config.disconnectGraceSeconds, state.config)
  }
}

export function setPlayerConnected(state: MatchState, playerId: string, connected: boolean): void {
  const player = state.players.find((candidate) => candidate.id === playerId)
  if (!player) return

  player.connected = connected
  player.disconnectTicks = connected
    ? 0
    : ticks(state.config.disconnectGraceSeconds, state.config)
}
