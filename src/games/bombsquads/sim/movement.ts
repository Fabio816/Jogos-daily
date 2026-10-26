import { dirVector, getCellType, sameCell } from './map'
import { CORNER_ASSIST, PLAYER_RADIUS } from './rules'
import type { Cell, Dir, MatchState, PlayerState, Vec2 } from './types'

/** Passo de integração dentro de um tick. Pequeno o bastante para não atravessar paredes. */
const SUB_STEP = 0.05
const EPS = 1e-6

/** Célula do centro: arredondamento de pos. */
export function centerCell(pos: Vec2): Cell {
  return { x: Math.round(pos.x), y: Math.round(pos.y) }
}

/**
 * Células que a caixa do jogador (quadrado de lado 2 * PLAYER_RADIUS) toca.
 * A célula c ocupa o intervalo [c - 0.5, c + 0.5].
 */
export function boxCells(pos: Vec2): Cell[] {
  const minX = Math.floor(pos.x - PLAYER_RADIUS + 0.5)
  const maxX = Math.floor(pos.x + PLAYER_RADIUS + 0.5 - EPS)
  const minY = Math.floor(pos.y - PLAYER_RADIUS + 0.5)
  const maxY = Math.floor(pos.y + PLAYER_RADIUS + 0.5 - EPS)

  const cells: Cell[] = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push({ x, y })
    }
  }
  return cells
}

function hasLiveBombAt(state: MatchState, cell: Cell): boolean {
  return state.bombs.some((bomb) => !bomb.exploded && sameCell(bomb.cell, cell))
}

/**
 * Pode o jogador ocupar `pos`? Falha se a caixa tocar parede ou caixa, ou se o
 * centro entrar numa célula com bomba vinda de outra célula. O dono sai da
 * própria bomba normalmente: só o movimento para dentro dela é bloqueado.
 */
export function canOccupy(state: MatchState, player: PlayerState, pos: Vec2): boolean {
  for (const cell of boxCells(pos)) {
    if (getCellType(state.map, cell) !== 'empty') return false
  }

  const center = centerCell(pos)
  if (!sameCell(center, player.cell) && hasLiveBombAt(state, center)) return false

  return true
}

/**
 * Alinha o jogador ao centro da faixa perpendicular ao movimento, se estiver a
 * até CORNER_ASSIST de distância. Permite passar por corredores de uma célula
 * sem alinhar exatamente.
 */
function assistCorner(state: MatchState, player: PlayerState, dir: Exclude<Dir, 'none'>): void {
  const horizontal = dir === 'left' || dir === 'right'
  const axis = horizontal ? 'y' : 'x'
  const target = Math.round(player.pos[axis])
  const diff = target - player.pos[axis]
  if (Math.abs(diff) < EPS || Math.abs(diff) > CORNER_ASSIST) return

  const shift = Math.sign(diff) * Math.min(Math.abs(diff), SUB_STEP)
  const next = horizontal
    ? { x: player.pos.x, y: player.pos.y + shift }
    : { x: player.pos.x + shift, y: player.pos.y }

  if (canOccupy(state, player, next)) {
    player.pos = next
    player.cell = centerCell(next)
  }
}

/**
 * Move o jogador por `speed / tickRate` células na direção `dir`, em passos
 * pequenos. Se bater, para junto do obstáculo (desliza só no eixo do movimento).
 */
export function movePlayer(state: MatchState, player: PlayerState, dir: Exclude<Dir, 'none'>): void {
  const vector = dirVector(dir)
  let remaining = player.stats.speed / state.config.tickRate

  while (remaining > EPS) {
    const length = Math.min(SUB_STEP, remaining)
    remaining -= length

    assistCorner(state, player, dir)

    const next = {
      x: player.pos.x + vector.x * length,
      y: player.pos.y + vector.y * length,
    }
    if (!canOccupy(state, player, next)) break

    player.pos = next
    player.cell = centerCell(next)
  }
}
