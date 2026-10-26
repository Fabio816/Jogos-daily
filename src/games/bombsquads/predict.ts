import { centerCell, movePlayer, type CellType, type Dir, type MatchState, type PlayerState, type Vec2 } from './sim'
import type { Snapshot } from './messages'

/** Diferença (em células) acima da qual a posição prevista é trocada pela do servidor. */
export const SNAP_DISTANCE = 0.6

/**
 * Monta, a partir do snapshot, só o que o movimento precisa: mapa, bombas e
 * jogadores. O resto da partida não influencia o andar.
 */
export function worldFromSnapshot(snapshot: Snapshot): MatchState {
  const cells = Array.from(snapshot.map.cells, (char): CellType =>
    char === '#' ? 'wall' : char === 'C' ? 'crate' : 'empty',
  )
  const players = snapshot.players.map((player) => ({
    id: player.id,
    pos: { x: player.pos[0], y: player.pos[1] },
    cell: { x: player.cell[0], y: player.cell[1] },
    facing: player.facing,
    alive: player.alive,
    stats: { fire: player.fire, bombs: player.bombs, speed: player.speed },
  }))
  const bombs = snapshot.bombs.map((bomb) => ({
    id: bomb.id,
    ownerId: bomb.ownerId,
    cell: { x: bomb.x, y: bomb.y },
    range: bomb.range,
    type: 'normal' as const,
    explodeTick: 0,
    exploded: false,
  }))

  // Só os campos usados por movePlayer e canOccupy; o cast evita replicar a partida toda.
  return {
    config: { tickRate: 30 },
    map: { width: snapshot.map.w, height: snapshot.map.h, cells, spawns: [] },
    bombs,
    players,
  } as unknown as MatchState
}

/**
 * Predição do jogador local: anda com o mesmo movePlayer do servidor, a cada
 * tick de 30 Hz. Quando chega um snapshot, a posição prevista só é trocada se
 * estiver longe da do servidor (início de round, reconexão).
 */
export class LocalPredictor {
  private world: MatchState | null = null
  private pos: Vec2 | null = null
  private phase: Snapshot['phase'] = 'countdown'

  private readonly playerId: string

  constructor(playerId: string) {
    this.playerId = playerId
  }

  setSnapshot(snapshot: Snapshot): void {
    this.world = worldFromSnapshot(snapshot)
    this.phase = snapshot.phase
    const me = snapshot.players.find((player) => player.id === this.playerId)
    if (!me) {
      this.pos = null
      return
    }
    const server = { x: me.pos[0], y: me.pos[1] }
    if (!this.pos || !me.alive || distance(this.pos, server) > SNAP_DISTANCE) {
      this.pos = server
    }
  }

  position(): Vec2 | null {
    return this.pos
  }

  /** Um tick de movimento previsto. Não faz nada fora da partida ou se o jogador caiu. */
  step(move: Dir): Vec2 | null {
    const world = this.world
    const pos = this.pos
    if (!world || !pos || this.phase !== 'playing') return pos

    const player = world.players.find((candidate) => candidate.id === this.playerId) as
      | (PlayerState & { alive: boolean })
      | undefined
    if (!player || !player.alive) return pos

    player.pos = { ...pos }
    player.cell = centerCell(pos)
    if (move !== 'none') {
      player.facing = move
      movePlayer(world, player, move)
    }
    this.pos = { ...player.pos }
    return this.pos
  }
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
