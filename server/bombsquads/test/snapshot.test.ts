import { describe, expect, it } from 'vitest'
import { createMatch, step } from '../../../src/games/bombsquads/sim'
import { buildSnapshot } from '../src/snapshot'

describe('buildSnapshot', () => {
  it('encodes the map compactly and keeps positions to 3 decimals', () => {
    const state = createMatch(['p1', 'p2'], { seed: 5, config: { countdownSeconds: 0 } })
    step(state)
    state.players[0].pos = { x: 1.23456, y: 1 }

    const snapshot = buildSnapshot(state, [])

    expect(snapshot.map.w * snapshot.map.h).toBe(snapshot.map.cells.length)
    expect(snapshot.map.cells).toMatch(/^[#C.]+$/)
    expect(snapshot.players[0].pos).toEqual([1.235, 1])
    expect(snapshot.players[0].shield).toBe(true)
  })

  it('carries the events of the window and the closing state', () => {
    const state = createMatch(['p1', 'p2'], { seed: 5, config: { countdownSeconds: 0 } })
    const events = [{ type: 'cellDropped' as const, x: 1, y: 1 }]
    const snapshot = buildSnapshot(state, events)
    expect(snapshot.events).toEqual(events)
    expect(snapshot.closing.active).toBe(false)
    expect(snapshot.closing.warning).toEqual([])
  })
})
