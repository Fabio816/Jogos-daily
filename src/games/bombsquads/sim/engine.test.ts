import { describe, expect, it } from 'vitest'
import {
  createMatch,
  getCellType,
  setPlayerConnected,
  step,
} from './index'
import type { Dir, InputMap, MatchConfig, MatchState } from './index'

const OPEN_MAP = [
  '#######',
  '#S...S#',
  '#.....#',
  '#.....#',
  '#######',
]

const CRATE_MAP = [
  '#######',
  '#S.C.S#',
  '#.#.#.#',
  '#.....#',
  '#######',
]

function makeMatch(overrides: Partial<MatchConfig> = {}): MatchState {
  return createMatch(['p1', 'p2'], {
    seed: 7,
    config: {
      mapTemplate: OPEN_MAP,
      countdownSeconds: 0,
      roundSeconds: 60,
      roundEndSeconds: 0.1,
      spawnProtectionSeconds: 0,
      fuseSeconds: 0.1,
      blastSeconds: 0.2,
      crateDropChance: 1,
      ...overrides,
    },
  })
}

function enterPlaying(state: MatchState): void {
  step(state)
  expect(state.phase).toBe('playing')
}

/** Teleporta o jogador para o centro de uma célula, atualizando pos e cell juntos. */
function teleport(player: MatchState['players'][number], x: number, y: number): void {
  player.pos = { x, y }
  player.cell = { x, y }
}

function placeBombAndEscape(state: MatchState, fire = 1): void {
  teleport(state.players[0], 2, 1)
  teleport(state.players[1], 2, 1)
  state.players[0].stats.fire = fire
  step(state, { p1: { move: 'none', bomb: true } })
  teleport(state.players[0], 1, 3)
}

describe('shared simulation', () => {
  it('explodes in a cross, destroys a crate and drops an item', () => {
    const state = makeMatch({ mapTemplate: CRATE_MAP })
    enterPlaying(state)
    state.players[0].spawnProtectionTicks = 999
    state.players[1].spawnProtectionTicks = 999

    placeBombAndEscape(state, 2)
    for (let i = 0; i < 3; i += 1) step(state)

    expect(getCellType(state.map, { x: 3, y: 1 })).toBe('empty')
    expect(state.bombs).toHaveLength(0)
    expect(state.blasts).toHaveLength(1)
    expect(state.items).toHaveLength(1)
    expect(state.items[0].cell).toEqual({ x: 3, y: 1 })
    expect(state.players[1].alive).toBe(true)

    const blastCells = state.blasts[0].cells
    expect(blastCells).toContainEqual({ x: 2, y: 1 })
    expect(blastCells).toContainEqual({ x: 3, y: 1 })
    expect(blastCells).not.toContainEqual({ x: 4, y: 1 })
  })

  it('removes a blast after its duration', () => {
    const state = makeMatch({ mapTemplate: CRATE_MAP })
    enterPlaying(state)
    state.players[0].spawnProtectionTicks = 999
    state.players[1].spawnProtectionTicks = 999

    placeBombAndEscape(state, 2)
    for (let i = 0; i < 3; i += 1) step(state)
    expect(state.blasts).toHaveLength(1)

    for (let i = 0; i < 6; i += 1) step(state)
    expect(state.blasts).toHaveLength(0)
  })

  it('kills a player hit by a blast and ends the round', () => {
    const state = makeMatch()
    enterPlaying(state)

    placeBombAndEscape(state)
    for (let i = 0; i < 3; i += 1) step(state)

    expect(state.players[0].alive).toBe(true)
    expect(state.players[1].alive).toBe(false)
    expect(state.phase).toBe('roundEnd')
    expect(state.roundWinnerId).toBe('p1')
    expect(state.players[0].score).toBe(1)
  })

  it('moves continuously at speed/tickRate and stops against a crate', () => {
    const state = makeMatch({ mapTemplate: CRATE_MAP })
    enterPlaying(state)

    const inputs: InputMap = { p1: { move: 'right', bomb: false } }
    for (let i = 0; i < 4; i += 1) step(state, inputs)
    // 4 ticks * 4 células/s / 30 Hz = 0.533 célula
    expect(state.players[0].pos.x).toBeCloseTo(1.533, 2)
    expect(state.players[0].cell).toEqual({ x: 2, y: 1 })

    for (let i = 0; i < 30; i += 1) step(state, inputs)
    // Crate em (3,1): a caixa do jogador (raio 0.35) para em x = 2.15
    expect(state.players[0].pos.x).toBeGreaterThan(2.1)
    expect(state.players[0].pos.x).toBeLessThanOrEqual(2.151)
    expect(state.players[0].cell).toEqual({ x: 2, y: 1 })
  })

  it('does not let a second blast pass through a crate destroyed in the same tick', () => {
    const state = makeMatch({ mapTemplate: CRATE_MAP })
    enterPlaying(state)
    state.players[0].spawnProtectionTicks = 999
    state.players[1].spawnProtectionTicks = 999

    // Bomba A em (2,1) destrói a caixa em (3,1). Bomba B em (4,1) atinge a caixa
    // do lado oposto no mesmo tick: não pode passar pela caixa já destruída.
    state.bombs.push(
      { id: 1, ownerId: 'p1', cell: { x: 2, y: 1 }, range: 2, type: 'normal', explodeTick: state.tick + 1, exploded: false },
      { id: 2, ownerId: 'p1', cell: { x: 4, y: 1 }, range: 2, type: 'normal', explodeTick: state.tick + 1, exploded: false },
    )

    step(state)

    const blastB = state.blasts.find((blast) => blast.cells.some((cell) => cell.x === 4 && cell.y === 1))
    expect(blastB).toBeDefined()
    expect(blastB?.cells).not.toContainEqual({ x: 2, y: 1 })
    expect(blastB?.cells).not.toContainEqual({ x: 1, y: 1 })
  })

  it('picks up items and applies caps', () => {
    const state = makeMatch()
    enterPlaying(state)

    state.items.push({ id: 1, cell: { ...state.players[0].cell }, type: 'fire' })
    step(state)
    expect(state.players[0].stats.fire).toBe(2)
    expect(state.items).toHaveLength(0)

    state.players[0].stats.fire = 6
    state.items.push({ id: 2, cell: { ...state.players[0].cell }, type: 'fire' })
    step(state)
    expect(state.players[0].stats.fire).toBe(6)
  })

  it('chains bombs through adjacent blast cells', () => {
    const state = makeMatch()
    enterPlaying(state)
    state.players[0].spawnProtectionTicks = 999
    state.players[1].spawnProtectionTicks = 999

    state.bombs.push(
      {
        id: 1,
        ownerId: 'p1',
        cell: { x: 2, y: 1 },
        range: 2,
        type: 'normal',
        explodeTick: state.tick + 1,
        exploded: false,
      },
      {
        id: 2,
        ownerId: 'p1',
        cell: { x: 3, y: 1 },
        range: 2,
        type: 'normal',
        explodeTick: state.tick + 999,
        exploded: false,
      },
    )

    step(state)

    expect(state.bombs).toHaveLength(0)
    expect(state.blasts).toHaveLength(2)
    expect(state.players[0].alive).toBe(true)
    expect(state.players[1].alive).toBe(true)
  })

  it('turns on hurry and sudden timers', () => {
    const state = makeMatch({ roundSeconds: 2, hurrySeconds: 1.5, suddenSeconds: 1 })
    enterPlaying(state)

    for (let i = 0; i < 15; i += 1) step(state)
    expect(state.hurry).toBe(true)
    expect(state.sudden).toBe(false)

    for (let i = 0; i < 15; i += 1) step(state)
    expect(state.sudden).toBe(true)

    expect(state.closing.active).toBe(true)

    for (let i = 0; i < 60 && state.phase === 'playing'; i += 1) step(state)
    expect(state.phase).toBe('roundEnd')
  })

  it('starts the next round after the round-end delay', () => {
    const state = makeMatch({ roundsToWin: 2 })
    enterPlaying(state)

    placeBombAndEscape(state)
    for (let i = 0; i < 3; i += 1) step(state)
    expect(state.phase).toBe('roundEnd')

    for (let i = 0; i < 3; i += 1) step(state)
    expect(state.phase).toBe('countdown')
    expect(state.round).toBe(2)
    expect(state.players[0].score).toBe(1)
    expect(state.players[0].cell).toEqual({ x: 1, y: 1 })
    expect(state.players[1].alive).toBe(true)
    expect(state.bombs).toHaveLength(0)
  })

  it('eliminates a player after the disconnect grace and allows reconnecting before it', () => {
    const state = makeMatch({ disconnectGraceSeconds: 0.1 })
    enterPlaying(state)

    setPlayerConnected(state, 'p2', false)
    step(state)
    setPlayerConnected(state, 'p2', true)
    step(state)
    expect(state.players[1].alive).toBe(true)
    expect(state.players[1].disconnectTicks).toBe(0)

    setPlayerConnected(state, 'p2', false)
    for (let i = 0; i < 3; i += 1) step(state)
    expect(state.players[1].alive).toBe(false)
    expect(state.phase).toBe('roundEnd')
    expect(state.roundWinnerId).toBe('p1')
  })

  it('is deterministic for the same seed and inputs', () => {
    const options = { seed: 123 }
    const a = createMatch(['p1', 'p2'], {
      ...options,
      config: { mapTemplate: CRATE_MAP, countdownSeconds: 0, roundSeconds: 60 },
    })
    const b = createMatch(['p1', 'p2'], {
      ...options,
      config: { mapTemplate: CRATE_MAP, countdownSeconds: 0, roundSeconds: 60 },
    })

    for (let i = 0; i < 300; i += 1) {
      const inputs: InputMap = {
        p1: {
          move: (i % 20 < 10 ? 'right' : 'left') as Dir,
          bomb: i % 13 === 0,
        },
        p2: {
          move: (i % 25 < 12 ? 'left' : 'right') as Dir,
          bomb: i % 17 === 0,
        },
      }
      step(a, inputs)
      step(b, inputs)
    }

    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
