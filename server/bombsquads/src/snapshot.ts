import { centerCell, type GameEvent, type MatchState } from '../../../src/games/bombsquads/sim'
import type { Snapshot } from '../../../src/games/bombsquads/messages'

export type { ServerMessage, Snapshot } from '../../../src/games/bombsquads/messages'

const round3 = (value: number) => Math.round(value * 1000) / 1000

/** Snapshot completo do estado. Os eventos são os desde o último snapshot. */
export function buildSnapshot(state: MatchState, events: GameEvent[]): Snapshot {
  const cells = state.map.cells
    .map((cell) => (cell === 'wall' ? '#' : cell === 'crate' ? 'C' : '.'))
    .join('')

  return {
    tick: state.tick,
    phase: state.phase,
    round: state.round,
    timeLeft: Math.ceil(state.timeLeftTicks / state.config.tickRate),
    hurry: state.hurry,
    sudden: state.sudden,
    roundWinnerId: state.roundWinnerId,
    scores: Object.fromEntries(state.players.map((player) => [player.id, player.score])),
    map: { w: state.map.width, h: state.map.height, cells },
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      pos: [round3(player.pos.x), round3(player.pos.y)],
      cell: [centerCell(player.pos).x, centerCell(player.pos).y],
      facing: player.facing,
      alive: player.alive,
      connected: player.connected,
      fire: player.stats.fire,
      bombs: player.stats.bombs,
      speed: player.stats.speed,
      shield: player.spawnProtectionTicks > 0,
    })),
    bombs: state.bombs.map((bomb) => ({
      id: bomb.id,
      x: bomb.cell.x,
      y: bomb.cell.y,
      ownerId: bomb.ownerId,
      range: bomb.range,
    })),
    blasts: state.blasts.map((blast) => ({ cells: blast.cells.map((cell) => [cell.x, cell.y]) })),
    items: state.items.map((item) => ({ id: item.id, x: item.cell.x, y: item.cell.y, type: item.type })),
    closing: {
      active: state.closing.active,
      next: state.closing.nextIndex,
      total: state.closing.order.length,
      warning: state.closing.warning.map((cell) => [cell.x, cell.y]),
    },
    events,
  }
}
