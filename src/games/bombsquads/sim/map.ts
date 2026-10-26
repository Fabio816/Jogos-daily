import { CRATE_DENSITY } from './rules'
import { nextRandom, type RngState } from './rng'
import type { Cell, CellType, Dir, MapSizeChoice, MapState } from './types'

const DIR_VECTORS: Record<Exclude<Dir, 'none'>, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function dirVector(dir: Exclude<Dir, 'none'>): Cell {
  return DIR_VECTORS[dir]
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y
}

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`
}

export function createMap(template: string[]): MapState {
  if (template.length < 3) {
    throw new Error('map template must have at least 3 rows')
  }
  const width = template[0].length
  if (width < 3) {
    throw new Error('map template must have at least 3 columns')
  }

  const cells: CellType[] = []
  const spawns: Cell[] = []

  for (let y = 0; y < template.length; y += 1) {
    const row = template[y]
    if (row.length !== width) {
      throw new Error(`map row ${y} has width ${row.length}, expected ${width}`)
    }
    for (let x = 0; x < width; x += 1) {
      const char = row[x]
      if (char === '#') {
        cells.push('wall')
      } else if (char === 'C') {
        cells.push('crate')
      } else if (char === 'S') {
        cells.push('empty')
        spawns.push({ x, y })
      } else if (char === '.') {
        cells.push('empty')
      } else {
        throw new Error(`unknown map character "${char}" at ${x},${y}`)
      }
    }
  }

  if (spawns.length === 0) {
    throw new Error('map template must contain at least one spawn (S)')
  }

  return { width, height: template.length, cells, spawns }
}

export function isInside(map: MapState, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < map.width && cell.y < map.height
}

export function getCellType(map: MapState, cell: Cell): CellType {
  if (!isInside(map, cell)) return 'wall'
  return map.cells[cell.y * map.width + cell.x]
}

export function setCellType(map: MapState, cell: Cell, type: CellType): void {
  if (!isInside(map, cell)) return
  map.cells[cell.y * map.width + cell.x] = type
}

export function isWalkable(map: MapState, cell: Cell): boolean {
  return getCellType(map, cell) === 'empty'
}

/** Tamanho do mapa por número de jogadores. Dimensões ímpares: a malha fica em posições pares. */
export function mapSizeForPlayers(playerCount: number): { width: number; height: number } {
  if (playerCount < 1 || playerCount > 10) {
    throw new Error(`mapSizeForPlayers supports 1..10 players, got ${playerCount}`)
  }
  if (playerCount <= 4) return { width: 15, height: 13 }
  if (playerCount <= 6) return { width: 17, height: 15 }
  if (playerCount <= 8) return { width: 19, height: 19 }
  return { width: 23, height: 21 }
}

/** Candidatos a spawn, do mais justo para o menos justo. Todos simétricos por rotação de 180°. */
function spawnCandidates(width: number, height: number): Cell[] {
  const midX = (width - 1) / 2
  const midY = (height - 1) / 2
  return [
    { x: 1, y: 1 },
    { x: width - 2, y: height - 2 },
    { x: 1, y: height - 2 },
    { x: width - 2, y: 1 },
    { x: midX, y: 1 },
    { x: midX, y: height - 2 },
    { x: 1, y: midY },
    { x: width - 2, y: midY },
    { x: 3, y: 3 },
    { x: width - 4, y: height - 4 },
    { x: 3, y: height - 4 },
    { x: width - 4, y: 3 },
  ]
}

/**
 * Gera um mapa determinístico para `playerCount` jogadores. Malha fixa: borda e
 * células com x e y pares são paredes rígidas. Caixas nas demais células, com
 * densidade CRATE_DENSITY, exceto a zona de spawn (o spawn e os vizinhos livres).
 */
const FIXED_SIZES: Record<Exclude<MapSizeChoice, 'auto'>, { width: number; height: number }> = {
  small: { width: 11, height: 9 },
  medium: { width: 15, height: 13 },
  large: { width: 19, height: 17 },
  xl: { width: 23, height: 21 },
}

/** Dimensões do mapa para a escolha do host. 'auto' segue o número de jogadores. */
export function mapDimensions(choice: MapSizeChoice, playerCount: number): { width: number; height: number } {
  return choice === 'auto' ? mapSizeForPlayers(playerCount) : FIXED_SIZES[choice]
}

export function generateMap(
  playerCount: number,
  rng: RngState,
  size: { width: number; height: number } = mapSizeForPlayers(playerCount),
  crateDensity: number = CRATE_DENSITY,
): MapState {
  const { width, height } = size
  const cells: CellType[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const isPillar = x % 2 === 0 && y % 2 === 0
      cells.push(isBorder || isPillar ? 'wall' : 'empty')
    }
  }

  const spawns = spawnCandidates(width, height).slice(0, playerCount)
  const map: MapState = { width, height, cells, spawns }

  const protectedCells = new Set<string>()
  for (const spawn of spawns) {
    for (const cell of [spawn, { x: spawn.x + 1, y: spawn.y }, { x: spawn.x - 1, y: spawn.y }, { x: spawn.x, y: spawn.y + 1 }, { x: spawn.x, y: spawn.y - 1 }]) {
      if (getCellType(map, cell) === 'empty') protectedCells.add(cellKey(cell))
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = { x, y }
      if (getCellType(map, cell) !== 'empty') continue
      if (protectedCells.has(cellKey(cell))) continue
      if (nextRandom(rng) < crateDensity) setCellType(map, cell, 'crate')
    }
  }

  return map
}
