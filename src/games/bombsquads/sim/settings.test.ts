import { describe, expect, it } from 'vitest'
import {
  cellKey,
  configFromSettings,
  createMatch,
  DEFAULT_SETTINGS,
  generateMap,
  getCellType,
  mapDimensions,
} from './index'
import type { Cell, MapState } from './index'

function reachable(map: MapState, start: Cell): Set<string> {
  const seen = new Set<string>([cellKey(start)])
  const queue: Cell[] = [start]
  while (queue.length > 0) {
    const current = queue.shift() as Cell
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy }
      if (getCellType(map, next) === 'wall') continue
      if (seen.has(cellKey(next))) continue
      seen.add(cellKey(next))
      queue.push(next)
    }
  }
  return seen
}

describe('map size choices', () => {
  it('uses fixed sizes when the host picks one', () => {
    expect(mapDimensions('small', 10)).toEqual({ width: 11, height: 9 })
    expect(mapDimensions('medium', 2)).toEqual({ width: 15, height: 13 })
    expect(mapDimensions('large', 4)).toEqual({ width: 19, height: 17 })
    expect(mapDimensions('xl', 2)).toEqual({ width: 23, height: 21 })
  })

  it('auto follows the number of players', () => {
    expect(mapDimensions('auto', 2)).toEqual({ width: 15, height: 13 })
    expect(mapDimensions('auto', 10)).toEqual({ width: 23, height: 21 })
  })

  it('every size keeps spawns connected, free and in pairs for every player count', () => {
    for (const choice of ['small', 'medium', 'large', 'xl'] as const) {
      for (let players = 2; players <= 10; players += 1) {
        const size = mapDimensions(choice, players)
        const map = generateMap(players, { rngState: 100 + players }, size)
        expect(map.spawns).toHaveLength(players)

        const open = []
        for (let y = 0; y < map.height; y += 1) {
          for (let x = 0; x < map.width; x += 1) {
            if (getCellType(map, { x, y }) !== 'wall') open.push(cellKey({ x, y }))
          }
        }
        for (const spawn of map.spawns) {
          const seen = reachable(map, spawn)
          for (const key of open) expect(seen.has(key)).toBe(true)
        }
      }
    }
  })
})

describe('match settings', () => {
  it('maps levels to crate density, item drop and power caps', () => {
    const low = configFromSettings({ ...DEFAULT_SETTINGS, crates: 'low', itemDrop: 'low', powerCap: 'low' })
    const high = configFromSettings({ ...DEFAULT_SETTINGS, crates: 'high', itemDrop: 'high', powerCap: 'high' })

    expect(low.crateDensity).toBeLessThan(high.crateDensity ?? 0)
    expect(low.crateDropChance).toBeLessThan(high.crateDropChance ?? 0)
    expect(low.fireMax).toBeLessThan(high.fireMax ?? 0)
    expect(low.bombsMax).toBeLessThan(high.bombsMax ?? 0)
    expect(low.speedMax).toBeLessThan(high.speedMax ?? 0)
  })

  it('a high crate setting produces more crates on the same seed', () => {
    const count = (crates: 'low' | 'high') => {
      const config = configFromSettings({ ...DEFAULT_SETTINGS, crates })
      const state = createMatch(['p1', 'p2', 'p3', 'p4'], { seed: 77, config: { ...config, countdownSeconds: 0 } })
      return state.map.cells.filter((cell) => cell === 'crate').length
    }
    expect(count('high')).toBeGreaterThan(count('low'))
  })

  it('applies the chosen map size in a match', () => {
    const state = createMatch(['p1', 'p2'], {
      seed: 5,
      config: configFromSettings({ ...DEFAULT_SETTINGS, mapSize: 'small' }),
    })
    expect(state.map.width).toBe(11)
    expect(state.map.height).toBe(9)
  })
})
