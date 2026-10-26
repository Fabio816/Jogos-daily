import { describe, expect, it } from 'vitest'
import {
  cellKey,
  generateMap,
  getCellType,
  mapSizeForPlayers,
} from './index'
import type { Cell, MapState } from './index'

function reachable(map: MapState, start: Cell): Set<string> {
  const seen = new Set<string>([cellKey(start)])
  const queue: Cell[] = [start]
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]

  while (queue.length > 0) {
    const current = queue.shift() as Cell
    for (const dir of dirs) {
      const next = { x: current.x + dir.x, y: current.y + dir.y }
      if (getCellType(map, next) === 'wall') continue
      const key = cellKey(next)
      if (seen.has(key)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return seen
}

function openCells(map: MapState): Cell[] {
  const cells: Cell[] = []
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (getCellType(map, { x, y }) !== 'wall') cells.push({ x, y })
    }
  }
  return cells
}

describe('mapSizeForPlayers', () => {
  it('scales the grid with the number of players', () => {
    expect(mapSizeForPlayers(2)).toEqual({ width: 15, height: 13 })
    expect(mapSizeForPlayers(4)).toEqual({ width: 15, height: 13 })
    expect(mapSizeForPlayers(5)).toEqual({ width: 17, height: 15 })
    expect(mapSizeForPlayers(6)).toEqual({ width: 17, height: 15 })
    expect(mapSizeForPlayers(7)).toEqual({ width: 19, height: 19 })
    expect(mapSizeForPlayers(8)).toEqual({ width: 19, height: 19 })
    expect(mapSizeForPlayers(9)).toEqual({ width: 23, height: 21 })
    expect(mapSizeForPlayers(10)).toEqual({ width: 23, height: 21 })
  })

  it('rejects counts outside 1..10', () => {
    expect(() => mapSizeForPlayers(0)).toThrow()
    expect(() => mapSizeForPlayers(11)).toThrow()
  })
})

describe('generateMap', () => {
  it('builds the fixed lattice: border and even/even cells are rigid walls', () => {
    for (let players = 2; players <= 10; players += 1) {
      const map = generateMap(players, { rngState: 5 })
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const isBorder = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1
          const isPillar = x % 2 === 0 && y % 2 === 0
          const type = getCellType(map, { x, y })
          if (isBorder || isPillar) {
            expect(type).toBe('wall')
          } else {
            expect(type).not.toBe('wall')
          }
        }
      }
    }
  })

  it('places exactly one spawn per player, on free cells', () => {
    for (let players = 2; players <= 10; players += 1) {
      const map = generateMap(players, { rngState: 9 })
      expect(map.spawns).toHaveLength(players)
      for (const spawn of map.spawns) {
        expect(getCellType(map, spawn)).toBe('empty')
      }
    }
  })

  it('keeps the spawn zone clear of crates (spawn plus free orthogonal neighbours)', () => {
    for (let players = 2; players <= 10; players += 1) {
      const map = generateMap(players, { rngState: 21 })
      for (const spawn of map.spawns) {
        const zone = [spawn, { x: spawn.x + 1, y: spawn.y }, { x: spawn.x - 1, y: spawn.y }, { x: spawn.x, y: spawn.y + 1 }, { x: spawn.x, y: spawn.y - 1 }]
        for (const cell of zone) {
          expect(getCellType(map, cell)).not.toBe('crate')
        }
      }
    }
  })

  it('has every free cell reachable from every spawn, crates included as passable', () => {
    for (let players = 2; players <= 10; players += 1) {
      const map = generateMap(players, { rngState: 1000 + players })
      const all = openCells(map).map(cellKey)
      for (const spawn of map.spawns) {
        const seen = reachable(map, spawn)
        for (const key of all) {
          expect(seen.has(key)).toBe(true)
        }
      }
    }
  })

  it('uses symmetric spawns (180 degree rotation) when the player count is even', () => {
    for (let players = 2; players <= 10; players += 2) {
      const map = generateMap(players, { rngState: 3 })
      const keys = new Set(map.spawns.map(cellKey))
      for (const spawn of map.spawns) {
        const mirror = { x: map.width - 1 - spawn.x, y: map.height - 1 - spawn.y }
        expect(keys.has(cellKey(mirror))).toBe(true)
      }
    }
  })

  it('is deterministic for the same seed and different for another seed', () => {
    const a = generateMap(8, { rngState: 42 })
    const b = generateMap(8, { rngState: 42 })
    const c = generateMap(8, { rngState: 43 })

    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(a.cells)).not.toBe(JSON.stringify(c.cells))
  })

  it('places crates in roughly the configured density of free cells', () => {
    const map = generateMap(10, { rngState: 77 })
    const crates = map.cells.filter((cell) => cell === 'crate').length
    const candidates = map.cells.filter((cell) => cell !== 'wall').length
    const ratio = crates / candidates
    expect(ratio).toBeGreaterThan(0.35)
    expect(ratio).toBeLessThan(0.65)
  })
})
