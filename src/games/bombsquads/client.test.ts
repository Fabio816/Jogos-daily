import { describe, expect, it } from 'vitest'
import { buildSnapshot } from '../../../server/bombsquads/src/snapshot'
import { bombFromKeys, InputSender, moveFromKeys } from './input'
import { SnapshotBuffer } from './interp'
import type { ClientMessage, Snapshot } from './messages'
import { LocalPredictor } from './predict'
import { createMatch, step } from './sim'

const CORRIDOR = ['#########', '#S.....S#', '#.#.#.#.#', '#.......#', '#########']

function startedMatch() {
  const state = createMatch(['p1', 'p2'], {
    seed: 3,
    config: { mapTemplate: CORRIDOR, countdownSeconds: 0, roundSeconds: 600, spawnProtectionSeconds: 0 },
  })
  step(state)
  return state
}

describe('local prediction', () => {
  it('moves exactly like the server simulation for the same inputs', () => {
    const state = startedMatch()
    const snapshot = buildSnapshot(state, []) as Snapshot
    const predictor = new LocalPredictor('p1')
    predictor.setSnapshot(snapshot)

    for (let i = 0; i < 40; i += 1) {
      step(state, { p1: { move: 'right', bomb: false } })
      predictor.step('right')
    }

    const server = state.players[0].pos
    const predicted = predictor.position()
    expect(predicted).not.toBeNull()
    expect(predicted?.x).toBeCloseTo(server.x, 9)
    expect(predicted?.y).toBeCloseTo(server.y, 9)
  })

  it('keeps the predicted position while it is close to the server, and snaps when far', () => {
    const state = startedMatch()
    const predictor = new LocalPredictor('p1')
    predictor.setSnapshot(buildSnapshot(state, []) as Snapshot)
    predictor.step('right')
    const predicted = predictor.position()

    // Servidor a 0.2 célula: a predição fica
    state.players[0].pos = { x: (predicted?.x ?? 0) + 0.2, y: predicted?.y ?? 1 }
    predictor.setSnapshot(buildSnapshot(state, []) as Snapshot)
    expect(predictor.position()?.x).toBeCloseTo(predicted?.x ?? 0, 9)

    // Servidor a 3 células: troca pela posição do servidor
    state.players[0].pos = { x: 5, y: 1 }
    predictor.setSnapshot(buildSnapshot(state, []) as Snapshot)
    expect(predictor.position()?.x).toBeCloseTo(5, 3)
  })

  it('does not move outside the playing phase', () => {
    const state = createMatch(['p1', 'p2'], { seed: 3, config: { mapTemplate: CORRIDOR, countdownSeconds: 1 } })
    const predictor = new LocalPredictor('p1')
    predictor.setSnapshot(buildSnapshot(state, []) as Snapshot)
    const before = predictor.position()
    predictor.step('right')
    expect(predictor.position()).toEqual(before)
  })
})

describe('snapshot interpolation', () => {
  function snap(x: number, cellX: number): Snapshot {
    return {
      players: [{ id: 'r', pos: [x, 1], cell: [cellX, 1] }],
    } as unknown as Snapshot
  }

  it('renders remote players 100 ms behind, interpolated between snapshots', () => {
    const buffer = new SnapshotBuffer(100)
    buffer.push(snap(1, 1), 0)
    buffer.push(snap(2, 2), 66)

    // now = 166 -> render time 66: exatamente no segundo snapshot
    expect(buffer.positionOf('r', 166)?.x).toBeCloseTo(2, 9)
    // now = 133 -> render time 33: no meio
    expect(buffer.positionOf('r', 133)?.x).toBeCloseTo(1.5, 1)
  })

  it('does not glide across a teleport (round start)', () => {
    const buffer = new SnapshotBuffer(100)
    buffer.push(snap(1, 1), 0)
    buffer.push(snap(8, 8), 66)
    expect(buffer.positionOf('r', 133)?.x).toBe(8)
  })

  it('returns null for unknown players and empty buffers', () => {
    const buffer = new SnapshotBuffer(100)
    expect(buffer.positionOf('r', 100)).toBeNull()
    buffer.push(snap(1, 1), 0)
    expect(buffer.positionOf('nobody', 100)).toBeNull()
  })
})

describe('keyboard input', () => {
  it('maps arrows and WASD to a direction, with a fixed priority', () => {
    expect(moveFromKeys(new Set())).toBe('none')
    expect(moveFromKeys(new Set(['ArrowLeft']))).toBe('left')
    expect(moveFromKeys(new Set(['KeyW']))).toBe('up')
    expect(moveFromKeys(new Set(['ArrowUp', 'ArrowRight']))).toBe('up')
  })

  it('treats Space and F as bomb', () => {
    expect(bombFromKeys(new Set(['Space']))).toBe(true)
    expect(bombFromKeys(new Set(['KeyF']))).toBe(true)
    expect(bombFromKeys(new Set(['KeyD']))).toBe(false)
  })

  it('sends input only when movement or bomb changes', () => {
    const sent: ClientMessage[] = []
    const sender = new InputSender((msg) => sent.push(msg))
    sender.update(new Set())
    sender.update(new Set())
    sender.update(new Set(['ArrowRight']))
    sender.update(new Set(['ArrowRight', 'Space']))
    sender.update(new Set(['ArrowRight', 'Space']))
    expect(sent).toEqual([
      { t: 'input', move: 'none', bomb: false },
      { t: 'input', move: 'right', bomb: false },
      { t: 'input', move: 'right', bomb: true },
    ])
  })

  it('resends the current state after reset', () => {
    const sent: ClientMessage[] = []
    const sender = new InputSender((msg) => sent.push(msg))
    sender.update(new Set(['KeyA']))
    sender.reset()
    sender.update(new Set(['KeyA']))
    expect(sent).toHaveLength(2)
  })
})
