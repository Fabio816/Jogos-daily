import { InputSender, moveFromKeys } from './input'
import { SnapshotBuffer } from './interp'
import type { ClientMessage, Snapshot } from './messages'
import { LocalPredictor } from './predict'
import type { Vec2 } from './sim'

const TICK_MS = 1000 / 30
/** Quanto tempo um bloco caindo fica visível (ms). Igual ao DROP_LIFETIME_MS do protótipo. */
export const DROP_LIFETIME_MS = 600

export type DropView = { key: string; x: number; y: number; time: number }

/**
 * Estado do cliente numa partida: snapshots recebidos, predição do jogador
 * local, interpolação dos remotos e envio de input. Não depende do Vue, então
 * pode ser testado sem navegador.
 */
export class MatchClient {
  readonly buffer = new SnapshotBuffer(100)
  readonly predictor: LocalPredictor
  latest: Snapshot | null = null

  private drops: DropView[] = []
  private readonly inputs: InputSender
  private accumulator = 0
  private last: number | null = null

  readonly playerId: string

  constructor(playerId: string, send: (msg: ClientMessage) => void) {
    this.playerId = playerId
    this.predictor = new LocalPredictor(playerId)
    this.inputs = new InputSender(send)
  }

  onSnapshot(snapshot: Snapshot, now: number): void {
    this.latest = snapshot
    this.buffer.push(snapshot, now)
    this.predictor.setSnapshot(snapshot)

    for (const event of snapshot.events) {
      if (event.type === 'cellDropped') {
        this.drops.push({ key: `${event.x}-${event.y}`, x: event.x, y: event.y, time: now })
      }
    }
    this.drops = this.drops.filter((drop) => now - drop.time < DROP_LIFETIME_MS)
  }

  /** Blocos ainda caindo ou recém-pousados, para a arena esconder a parede estática desses pontos. */
  activeDrops(now: number): DropView[] {
    return this.drops.filter((drop) => now - drop.time < DROP_LIFETIME_MS)
  }

  /** Avança o relógio local em ticks de 30 Hz: predição e envio do input. */
  advance(now: number, keys: ReadonlySet<string>): void {
    if (this.last === null) this.last = now
    this.accumulator += Math.min(now - this.last, 250)
    this.last = now

    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS
      this.predictor.step(moveFromKeys(keys))
    }
    this.inputs.update(keys)
  }

  /** Posição a desenhar: prevista para o jogador local, interpolada para os outros. */
  positionOf(id: string, now: number): Vec2 | null {
    if (id === this.playerId) {
      return this.predictor.position() ?? this.buffer.positionOf(id, now)
    }
    return this.buffer.positionOf(id, now)
  }

  /** Chamado ao reconectar, para o input atual ser reenviado. */
  resetInput(): void {
    this.inputs.reset()
    this.last = null
  }
}
