import { startClosing, updateClosing } from './closing'
import { startRound } from './match'
import { cellKey, getCellType, sameCell, setCellType } from './map'
import { movePlayer, centerCell } from './movement'
import { nextRandom } from './rng'
import { ITEM_TYPES, ITEM_WEIGHTS } from './rules'
import { ticks } from './time'
import type {
  BombState,
  Cell,
  InputMap,
  ItemType,
  MatchState,
  PlayerState,
} from './types'

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

export function step(state: MatchState, inputs: InputMap = {}): MatchState {
  state.tick += 1
  state.events = []

  if (state.phase === 'countdown') {
    stepCountdown(state)
  } else if (state.phase === 'playing') {
    stepPlaying(state, inputs)
  } else if (state.phase === 'roundEnd') {
    stepRoundEnd(state)
  }

  return state
}

function stepCountdown(state: MatchState): void {
  state.countdownTicks -= 1
  if (state.countdownTicks > 0) return

  state.phase = 'playing'
  state.timeLeftTicks = ticks(state.config.roundSeconds, state.config)
  const protection = ticks(state.config.spawnProtectionSeconds, state.config)
  for (const player of state.players) {
    player.spawnProtectionTicks = protection
    player.lastBombInput = false
  }
}

function stepPlaying(state: MatchState, inputs: InputMap): void {
  for (const player of state.players) {
    player.cell = centerCell(player.pos)
  }

  state.timeLeftTicks = Math.max(0, state.timeLeftTicks - 1)
  state.hurry = state.timeLeftTicks <= ticks(state.config.hurrySeconds, state.config)
  state.sudden = state.timeLeftTicks <= ticks(state.config.suddenSeconds, state.config)

  if (state.sudden && !state.closing.active) {
    startClosing(state)
  }

  for (const player of state.players) {
    if (!player.alive || player.connected) continue

    player.disconnectTicks -= 1
    if (player.disconnectTicks <= 0) {
      killPlayer(state, player, 'disconnect')
    }
  }

  updateClosing(state)

  for (const player of state.players) {
    if (!player.alive || !player.connected) continue

    if (player.spawnProtectionTicks > 0) {
      player.spawnProtectionTicks -= 1
    }

    const input = inputs[player.id] ?? { move: 'none', bomb: false }
    const bombPressed = input.bomb && !player.lastBombInput
    player.lastBombInput = input.bomb

    if (bombPressed) {
      placeBomb(state, player)
    }

    if (input.move !== 'none') {
      player.facing = input.move
      movePlayer(state, player, input.move)
    }

    pickupItem(state, player)
  }

  updateBombs(state)
  updateBlasts(state)

  const alive = state.players.filter((player) => player.alive)
  if (alive.length <= 1) {
    endRound(state, alive[0]?.id ?? null)
    return
  }

  if (state.timeLeftTicks <= 0) {
    endRound(state, null)
  }
}

function stepRoundEnd(state: MatchState): void {
  if (state.tick < state.roundEndTick) return

  const topScore = Math.max(...state.players.map((player) => player.score))
  const topPlayers = state.players.filter((player) => player.score === topScore)

  if (topScore >= state.config.roundsToWin || state.round >= state.config.maxRounds) {
    state.phase = 'matchEnd'
    state.matchWinnerId = topPlayers.length === 1 ? topPlayers[0].id : null
    return
  }

  state.round += 1
  startRound(state)
}

function killPlayer(state: MatchState, player: PlayerState, cause: 'blast' | 'closing' | 'disconnect'): void {
  player.alive = false
  player.activeBombs = 0
  state.events.push({ type: 'death', playerId: player.id, cause })
}

function placeBomb(state: MatchState, player: PlayerState): void {
  if (player.activeBombs >= player.stats.bombs) return
  if (findBombAt(state, player.cell)) return

  state.bombs.push({
    id: state.nextIds.bomb,
    ownerId: player.id,
    cell: { ...player.cell },
    range: player.stats.fire,
    type: 'normal',
    explodeTick: state.tick + ticks(state.config.fuseSeconds, state.config),
    exploded: false,
  })
  state.nextIds.bomb += 1
  player.activeBombs += 1
}

function pickupItem(state: MatchState, player: PlayerState): void {
  const index = state.items.findIndex((item) => sameCell(item.cell, player.cell))
  if (index < 0) return

  const [item] = state.items.splice(index, 1)
  applyItem(state, player, item.type)
}

function applyItem(state: MatchState, player: PlayerState, type: ItemType): void {
  const config = state.config

  if (type === 'fire') {
    player.stats.fire = Math.min(config.fireMax, player.stats.fire + 1)
  } else if (type === 'bomb') {
    player.stats.bombs = Math.min(config.bombsMax, player.stats.bombs + 1)
  } else if (type === 'speed') {
    player.stats.speed = Math.min(
      config.speedMax,
      Number((player.stats.speed + config.speedStep).toFixed(2)),
    )
  } else if (type === 'kick') {
    player.abilities.kick = true
  } else if (type === 'punch') {
    player.abilities.punch = true
  } else if (type === 'throw') {
    player.abilities.throw = true
  }
}

function updateBombs(state: MatchState): void {
  const queue = state.bombs
    .filter((bomb) => !bomb.exploded && bomb.explodeTick <= state.tick)
    .sort((a, b) => a.id - b.id)
  const drops: Cell[] = []
  /** Caixas destruídas neste tick: explosões seguintes do mesmo tick param nelas. */
  const destroyed = new Set<string>()

  while (queue.length > 0) {
    const bomb = queue.shift()
    if (!bomb || bomb.exploded) continue
    explodeBomb(state, bomb, queue, drops, destroyed)
  }

  state.bombs = state.bombs.filter((bomb) => !bomb.exploded)

  for (const cell of drops) {
    spawnItem(state, cell)
  }
}

function explodeBomb(
  state: MatchState,
  bomb: BombState,
  queue: BombState[],
  drops: Cell[],
  destroyed: Set<string>,
): void {
  bomb.exploded = true

  const owner = state.players.find((player) => player.id === bomb.ownerId)
  if (owner && owner.activeBombs > 0) {
    owner.activeBombs -= 1
  }

  const cells: Cell[] = [{ ...bomb.cell }]

  for (const dir of DIRECTIONS) {
    for (let distance = 1; distance <= bomb.range; distance += 1) {
      const target = {
        x: bomb.cell.x + dir.x * distance,
        y: bomb.cell.y + dir.y * distance,
      }
      if (destroyed.has(cellKey(target))) break

      const type = getCellType(state.map, target)
      if (type === 'wall') break

      cells.push(target)

      if (type === 'crate') {
        destroyCrate(state, target, drops, destroyed)
        break
      }

      const otherBomb = findBombAt(state, target)
      if (otherBomb) {
        queue.push(otherBomb)
        break
      }

      removeItemAt(state, target)
    }
  }

  state.blasts.push({
    id: state.nextIds.blast,
    ownerId: bomb.ownerId,
    cells,
    expiresTick: state.tick + ticks(state.config.blastSeconds, state.config),
  })
  state.nextIds.blast += 1

  for (const player of state.players) {
    if (!player.alive || player.spawnProtectionTicks > 0) continue
    if (cells.some((cell) => sameCell(cell, player.cell))) {
      killPlayer(state, player, 'blast')
    }
  }
}

function destroyCrate(
  state: MatchState,
  cell: Cell,
  drops: Cell[],
  destroyed: Set<string>,
): void {
  if (getCellType(state.map, cell) !== 'crate') return
  setCellType(state.map, cell, 'empty')
  destroyed.add(cellKey(cell))
  drops.push({ ...cell })
}

function removeItemAt(state: MatchState, cell: Cell): void {
  const index = state.items.findIndex((item) => sameCell(item.cell, cell))
  if (index >= 0) state.items.splice(index, 1)
}

function spawnItem(state: MatchState, cell: Cell): void {
  if (getCellType(state.map, cell) !== 'empty') return
  if (state.items.some((item) => sameCell(item.cell, cell))) return
  if (nextRandom(state) > state.config.crateDropChance) return

  state.items.push({
    id: state.nextIds.item,
    cell: { ...cell },
    type: chooseItemType(state),
  })
  state.nextIds.item += 1
}

function chooseItemType(state: MatchState): ItemType {
  const total = ITEM_TYPES.reduce((sum, type) => sum + ITEM_WEIGHTS[type], 0)
  let roll = nextRandom(state) * total
  for (const type of ITEM_TYPES) {
    roll -= ITEM_WEIGHTS[type]
    if (roll <= 0) return type
  }
  return ITEM_TYPES[ITEM_TYPES.length - 1]
}

function updateBlasts(state: MatchState): void {
  state.blasts = state.blasts.filter((blast) => blast.expiresTick > state.tick)
}

function endRound(state: MatchState, winnerId: string | null): void {
  if (state.phase !== 'playing') return

  state.phase = 'roundEnd'
  state.roundEndTick = state.tick + ticks(state.config.roundEndSeconds, state.config)
  state.roundWinnerId = winnerId

  if (winnerId) {
    const winner = state.players.find((player) => player.id === winnerId)
    if (winner) winner.score += 1
  }
}

function findBombAt(state: MatchState, cell: Cell): BombState | undefined {
  return state.bombs.find((bomb) => !bomb.exploded && sameCell(bomb.cell, cell))
}
