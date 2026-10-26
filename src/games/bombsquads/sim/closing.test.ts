import { describe, expect, it } from 'vitest'
import {
  createMatch,
  getCellType,
  setCellType,
  startClosing,
  step,
  updateClosing,
} from './index'
import type { Cell, GameEvent, MatchState } from './index'

/** 7x7: 25 células não-parede. Spawns: (1,1), (5,1), (1,5), (5,5). */
const CLOSE_MAP = [
  '#######',
  '#S...S#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#S...S#',
  '#######',
]

/**
 * Sudden de 3 s (90 ticks) e aviso de 0.5 s (15 ticks).
 * Intervalo = floor((90 - 15) / 24) = 3 ticks. Célula i cai em 15 + 3i.
 */
function makeMatch(): MatchState {
  const state = createMatch(['p1', 'p2'], {
    seed: 3,
    config: {
      mapTemplate: CLOSE_MAP,
      countdownSeconds: 0,
      roundSeconds: 6,
      suddenSeconds: 3,
      closingWarningSeconds: 0.5,
      roundEndSeconds: 0.1,
      spawnProtectionSeconds: 0,
      fuseSeconds: 100,
      blastSeconds: 0.2,
      crateDropChance: 0,
    },
  })
  step(state)
  expect(state.phase).toBe('playing')
  return state
}

/** Fechamento direto, sem passos de partida: avança só o relógio do fechamento. */
function advanceClosing(state: MatchState, done: () => boolean, max = 400): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < max && !done(); i += 1) {
    state.tick += 1
    state.events = []
    updateClosing(state)
    events.push(...state.events)
  }
  return events
}

describe('sudden death closing', () => {
  it('walks the rings clockwise from the outside in', () => {
    const state = makeMatch()
    startClosing(state)
    const order = state.closing.order

    expect(order).toHaveLength(25)
    // Anel externo: topo esquerda→direita, lateral direita cima→baixo, base, lateral esquerda
    expect(order[0]).toEqual({ x: 1, y: 1 })
    expect(order[4]).toEqual({ x: 5, y: 1 })
    expect(order[5]).toEqual({ x: 5, y: 2 })
    expect(order[8]).toEqual({ x: 5, y: 5 })
    expect(order[12]).toEqual({ x: 1, y: 5 })
    expect(order[15]).toEqual({ x: 1, y: 2 })
    // Segundo anel começa no canto superior esquerdo dele
    expect(order[16]).toEqual({ x: 2, y: 2 })
    // Centro por último
    expect(order[24]).toEqual({ x: 3, y: 3 })
    expect(state.closing.intervalTicks).toBe(3)
    expect(state.closing.warnTicks).toBe(15)
  })

  it('drops cells one by one in exactly the sweep order', () => {
    const state = makeMatch()
    startClosing(state)

    const events = advanceClosing(state, () => state.closing.nextIndex >= 25)
    const dropped = events
      .filter((event): event is Extract<GameEvent, { type: 'cellDropped' }> => event.type === 'cellDropped')
      .map((event): Cell => ({ x: event.x, y: event.y }))

    expect(dropped).toEqual(state.closing.order)
  })

  it('warns each cell for warnTicks before it drops', () => {
    const state = makeMatch()
    startClosing(state)
    updateClosing(state)

    let warnedAt = state.closing.warning.some((cell) => cell.x === 1 && cell.y === 1) ? state.tick : -1
    let droppedAt = -1
    for (let i = 0; i < 100 && droppedAt < 0; i += 1) {
      state.tick += 1
      state.events = []
      updateClosing(state)
      if (warnedAt < 0 && state.closing.warning.some((cell) => cell.x === 1 && cell.y === 1)) {
        warnedAt = state.tick
      }
      if (state.events.some((event) => event.type === 'cellDropped' && event.x === 1 && event.y === 1)) {
        droppedAt = state.tick
      }
    }

    expect(warnedAt).toBeGreaterThan(0)
    expect(droppedAt - warnedAt).toBe(15)
  })

  it('closes the whole map and finishes before the sudden time runs out', () => {
    const state = makeMatch()
    startClosing(state)
    const start = state.closing.startTick

    advanceClosing(state, () => state.closing.nextIndex >= 25)

    expect(state.tick - start).toBeLessThanOrEqual(90)
    for (let y = 0; y < state.map.height; y += 1) {
      for (let x = 0; x < state.map.width; x += 1) {
        expect(getCellType(state.map, { x, y })).toBe('wall')
      }
    }
  })

  it('starts when the remaining time reaches suddenSeconds', () => {
    const state = makeMatch()
    expect(state.closing.active).toBe(false)

    for (let i = 0; i < 200 && !state.closing.active; i += 1) step(state)

    expect(state.closing.active).toBe(true)
    expect(state.timeLeftTicks).toBeLessThanOrEqual(90)
    expect(state.timeLeftTicks).toBeGreaterThanOrEqual(89)
  })

  it('kills a player standing on a dropping cell, even with spawn protection', () => {
    const state = makeMatch()
    state.players[0].spawnProtectionTicks = 999

    const events: GameEvent[] = []
    for (let i = 0; i < 400 && state.phase === 'playing'; i += 1) {
      step(state)
      events.push(...state.events)
    }

    expect(state.players[0].alive).toBe(false)
    expect(events).toContainEqual({ type: 'death', playerId: 'p1', cause: 'closing' })
    expect(state.phase).toBe('roundEnd')
    expect(state.roundWinnerId).toBe('p2')
  })

  it('removes a bomb on a dropping cell without exploding it and refunds the owner', () => {
    const state = makeMatch()
    state.players[1].activeBombs = 1
    state.bombs.push({
      id: 1,
      ownerId: 'p2',
      cell: { x: 3, y: 1 },
      range: 2,
      type: 'normal',
      explodeTick: state.tick + 10_000,
      exploded: false,
    })
    startClosing(state)

    advanceClosing(state, () => state.closing.nextIndex >= 3)

    expect(state.bombs).toHaveLength(0)
    expect(state.blasts).toHaveLength(0)
    expect(state.players[1].activeBombs).toBe(0)
  })

  it('removes items on dropping cells and keeps the others', () => {
    const state = makeMatch()
    state.items.push(
      { id: 1, cell: { x: 1, y: 1 }, type: 'speed' },
      { id: 2, cell: { x: 5, y: 5 }, type: 'fire' },
    )
    startClosing(state)

    advanceClosing(state, () => state.closing.nextIndex >= 1)

    expect(state.items.map((item) => item.id)).toEqual([2])
  })

  it('turns a crate into a wall without dropping an item', () => {
    const state = makeMatch()
    setCellType(state.map, { x: 2, y: 1 }, 'crate')
    startClosing(state)

    advanceClosing(state, () => state.closing.nextIndex >= 2)

    expect(getCellType(state.map, { x: 2, y: 1 })).toBe('wall')
    expect(state.items).toHaveLength(0)
  })
})
