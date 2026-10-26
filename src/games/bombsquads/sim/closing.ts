import { cellKey, getCellType, setCellType } from './map'
import { boxCells } from './movement'
import { ticks } from './time'
import type { Cell, ClosingState, MatchState } from './types'

export function initialClosing(): ClosingState {
  return {
    active: false,
    startTick: 0,
    intervalTicks: 1,
    warnTicks: 1,
    order: [],
    nextIndex: 0,
    warning: [],
  }
}

/**
 * Ordem do círculo: anel a anel, de fora para dentro, no sentido horário. Cada
 * anel começa no canto superior esquerdo e percorre o topo (esquerda para a
 * direita), a lateral direita (cima para baixo), a base (direita para a
 * esquerda) e a lateral esquerda (baixo para cima). Só células que não são
 * parede entram na ordem.
 */
export function closingOrder(state: MatchState): Cell[] {
  const { width, height } = state.map
  const cells: Cell[] = []
  const visit = (x: number, y: number) => {
    if (getCellType(state.map, { x, y }) !== 'wall') cells.push({ x, y })
  }

  const rings = Math.ceil(Math.min(width, height) / 2)
  for (let k = 0; k < rings; k += 1) {
    const left = k
    const top = k
    const right = width - 1 - k
    const bottom = height - 1 - k

    for (let x = left; x <= right; x += 1) visit(x, top)
    for (let y = top + 1; y <= bottom; y += 1) visit(right, y)
    if (bottom > top) for (let x = right - 1; x >= left; x -= 1) visit(x, bottom)
    if (right > left) for (let y = bottom - 1; y > top; y -= 1) visit(left, y)
  }
  return cells
}

/**
 * Começa o fechamento em círculo. O intervalo entre células é calculado para que
 * a última caia antes de acabar o tempo de sudden: (suddenSeconds - aviso) / (n - 1).
 */
export function startClosing(state: MatchState): void {
  const order = closingOrder(state)
  const suddenTicks = ticks(state.config.suddenSeconds, state.config)
  const warnTicks = ticks(state.config.closingWarningSeconds, state.config)
  const gaps = Math.max(1, order.length - 1)

  state.closing = {
    active: true,
    startTick: state.tick,
    intervalTicks: Math.max(1, Math.floor((suddenTicks - warnTicks) / gaps)),
    warnTicks,
    order,
    nextIndex: 0,
    warning: [],
  }
}

/** Derruba as células que chegaram na hora e recalcula as que estão em aviso. */
export function updateClosing(state: MatchState): void {
  const closing = state.closing
  if (!closing.active) return

  const elapsed = state.tick - closing.startTick
  const dropAt = (index: number) => closing.warnTicks + index * closing.intervalTicks

  while (closing.nextIndex < closing.order.length && elapsed >= dropAt(closing.nextIndex)) {
    dropCell(state, closing.order[closing.nextIndex])
    closing.nextIndex += 1
  }

  closing.warning = []
  for (let index = closing.nextIndex; index < closing.order.length; index += 1) {
    if (elapsed < dropAt(index) - closing.warnTicks) break
    closing.warning.push(closing.order[index])
  }
}

/**
 * Uma célula vira parede rígida. Itens e bombas nela somem (a bomba não explode
 * e o dono recupera o contador). Quem tiver a caixa do jogador sobre a célula
 * morre na hora, sem proteção de spawn. Caixas viram parede sem dropar item.
 */
function dropCell(state: MatchState, cell: Cell): void {
  const key = cellKey(cell)
  if (getCellType(state.map, cell) !== 'wall') setCellType(state.map, cell, 'wall')

  state.items = state.items.filter((item) => cellKey(item.cell) !== key)

  for (const bomb of state.bombs) {
    if (cellKey(bomb.cell) !== key || bomb.exploded) continue
    const owner = state.players.find((player) => player.id === bomb.ownerId)
    if (owner && owner.activeBombs > 0) owner.activeBombs -= 1
  }
  state.bombs = state.bombs.filter((bomb) => cellKey(bomb.cell) !== key)

  for (const player of state.players) {
    if (!player.alive) continue
    if (boxCells(player.pos).some((touched) => cellKey(touched) === key)) {
      player.alive = false
      player.activeBombs = 0
      state.events.push({ type: 'death', playerId: player.id, cause: 'closing' })
    }
  }

  state.events.push({ type: 'cellDropped', x: cell.x, y: cell.y })
}
