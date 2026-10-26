import { describe, expect, it } from 'vitest'
import { boxCells, createMatch, step } from './index'
import type { InputMap, MatchState } from './index'

/** Corredor com uma quina: a faixa y=1 tem parede em (2,2), e a faixa y=3 é livre. */
const CORNER_MAP = [
  '#####',
  '#S.S#',
  '#.#.#',
  '#...#',
  '#####',
]

const OPEN_MAP = [
  '#####',
  '#S.S#',
  '#...#',
  '#####',
]

function makeMatch(mapTemplate: string[], fuseSeconds = 100): MatchState {
  const state = createMatch(['p1', 'p2'], {
    seed: 11,
    config: {
      mapTemplate,
      countdownSeconds: 0,
      roundSeconds: 600,
      spawnProtectionSeconds: 0,
      fuseSeconds,
      crateDropChance: 0,
    },
  })
  step(state)
  return state
}

function teleport(state: MatchState, index: number, x: number, y: number): void {
  state.players[index].pos = { x, y }
  state.players[index].cell = { x: Math.round(x), y: Math.round(y) }
}

describe('continuous movement', () => {
  it('boxCells returns the cells touched by the player box', () => {
    expect(boxCells({ x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }])
    expect(boxCells({ x: 1.5, y: 1 })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(boxCells({ x: 1.2, y: 1.2 })).toHaveLength(4)
  })

  it('corner assist aligns to the lane so the player passes a one-cell corridor', () => {
    const state = makeMatch(CORNER_MAP)
    teleport(state, 0, 1, 1.2)

    const inputs: InputMap = { p1: { move: 'right', bomb: false } }
    for (let i = 0; i < 20; i += 1) step(state, inputs)

    // Sem o assist, a caixa bateria em (2,2) e pararia em x ≈ 1.15
    expect(state.players[0].pos.x).toBeGreaterThan(1.5)
    expect(state.players[0].pos.y).toBeCloseTo(1, 2)
  })

  it('a bomb blocks entry from a neighbouring cell', () => {
    const state = makeMatch(OPEN_MAP)
    state.bombs.push({
      id: 1,
      ownerId: 'p2',
      cell: { x: 2, y: 1 },
      range: 1,
      type: 'normal',
      explodeTick: state.tick + 10_000,
      exploded: false,
    })

    const inputs: InputMap = { p1: { move: 'right', bomb: false } }
    for (let i = 0; i < 30; i += 1) step(state, inputs)

    expect(state.players[0].pos.x).toBeLessThan(1.5)
    expect(state.players[0].cell).toEqual({ x: 1, y: 1 })
  })

  it('the bomb owner can walk out of the bomb cell', () => {
    const state = makeMatch(OPEN_MAP)
    teleport(state, 0, 2, 1)

    step(state, { p1: { move: 'none', bomb: true } })
    expect(state.bombs).toHaveLength(1)

    const inputs: InputMap = { p1: { move: 'right', bomb: false } }
    for (let i = 0; i < 20; i += 1) step(state, inputs)

    expect(state.players[0].pos.x).toBeGreaterThan(2.5)
    expect(state.players[0].cell.x).toBeGreaterThanOrEqual(3)
  })

  it('movement distance per tick equals speed divided by tick rate', () => {
    const state = makeMatch(OPEN_MAP)
    teleport(state, 0, 1, 1)

    step(state, { p1: { move: 'right', bomb: false } })
    expect(state.players[0].pos.x).toBeCloseTo(1 + 4 / 30, 6)
  })
  it('turns into a one-cell corridor from any point of the cell, not only near the centre', () => {
    // Corredor vertical em x=1, abrindo a partir da faixa y=1.
    const TURN_MAP = [
      '#####',
      '#S.S#',
      '#.#.#',
      '#.#.#',
      '#...#',
      '#####',
    ]
    const state = makeMatch(TURN_MAP)
    // Parado num ponto afastado do centro (x = 1.3), pressionando para baixo.
    teleport(state, 0, 1.3, 1)

    const inputs: InputMap = { p1: { move: 'down', bomb: false } }
    for (let i = 0; i < 90; i += 1) step(state, inputs)

    expect(state.players[0].pos.y).toBeGreaterThan(3.5)
    expect(state.players[0].pos.x).toBeLessThan(1.2)
  })
})
