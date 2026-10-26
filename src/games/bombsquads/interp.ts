import type { Snapshot } from './messages'
import type { Vec2 } from './sim'

type Entry = { at: number; snapshot: Snapshot }

/** Mais de uma célula de diferença entre dois snapshots: é teletransporte, não passo. */
const TELEPORT_CELLS = 2

/**
 * Guarda os últimos snapshots e devolve a posição de um jogador remoto
 * `delayMs` atrás, interpolada entre os dois snapshots que cercam esse instante.
 * Atrasar um pouco esconde a variação de chegada dos pacotes.
 */
export class SnapshotBuffer {
  private entries: Entry[] = []

  private readonly delayMs: number
  private readonly keepMs: number

  constructor(delayMs = 100, keepMs = 1000) {
    this.delayMs = delayMs
    this.keepMs = keepMs
  }

  push(snapshot: Snapshot, at: number): void {
    this.entries.push({ at, snapshot })
    const cutoff = at - this.keepMs
    while (this.entries.length > 2 && this.entries[0].at < cutoff) this.entries.shift()
  }

  latest(): Snapshot | null {
    return this.entries.at(-1)?.snapshot ?? null
  }

  positionOf(id: string, now: number): Vec2 | null {
    const entries = this.entries
    if (entries.length === 0) return null
    const t = now - this.delayMs

    if (t <= entries[0].at) return toVec(findPlayer(entries[0].snapshot, id))
    const last = entries[entries.length - 1]
    if (t >= last.at) return toVec(findPlayer(last.snapshot, id))

    let a = entries[0]
    let b = entries[1]
    for (let i = 0; i < entries.length - 1; i += 1) {
      if (entries[i].at <= t && t < entries[i + 1].at) {
        a = entries[i]
        b = entries[i + 1]
        break
      }
    }

    const pa = findPlayer(a.snapshot, id)
    const pb = findPlayer(b.snapshot, id)
    if (!pa || !pb) return toVec(pb ?? pa)

    const jump = Math.abs(pa.cell[0] - pb.cell[0]) + Math.abs(pa.cell[1] - pb.cell[1]) > TELEPORT_CELLS
    if (jump) return toVec(pb)

    const k = (t - a.at) / (b.at - a.at)
    return {
      x: pa.pos[0] + (pb.pos[0] - pa.pos[0]) * k,
      y: pa.pos[1] + (pb.pos[1] - pa.pos[1]) * k,
    }
  }
}

type PlayerSnap = Snapshot['players'][number]

function findPlayer(snapshot: Snapshot, id: string): PlayerSnap | undefined {
  return snapshot.players.find((player) => player.id === id)
}

function toVec(player: PlayerSnap | undefined): Vec2 | null {
  return player ? { x: player.pos[0], y: player.pos[1] } : null
}
