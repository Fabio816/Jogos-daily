import type { ClientMessage } from './messages'
import type { Dir } from './sim'

/** Teclas de movimento. Setas e WASD valem os dois, para teclado único. */
export const MOVE_KEYS: Record<Exclude<Dir, 'none'>, string[]> = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
}

export const BOMB_KEYS = ['Space', 'KeyF']

/** Todas as teclas do jogo, para bloquear a rolagem da página enquanto joga. */
export const GAME_KEYS: string[] = [...Object.values(MOVE_KEYS).flat(), ...BOMB_KEYS]

const PRIORITY: Array<Exclude<Dir, 'none'>> = ['up', 'down', 'left', 'right']

export function moveFromKeys(keys: ReadonlySet<string>): Dir {
  for (const dir of PRIORITY) {
    if (MOVE_KEYS[dir].some((key) => keys.has(key))) return dir
  }
  return 'none'
}

export function bombFromKeys(keys: ReadonlySet<string>): boolean {
  return BOMB_KEYS.some((key) => keys.has(key))
}

/** Envia ao servidor só quando o estado muda (movimento ou bomba). */
export class InputSender {
  private readonly send: (msg: ClientMessage) => void
  private last: { move: Dir; bomb: boolean } | null = null

  constructor(send: (msg: ClientMessage) => void) {
    this.send = send
  }

  update(keys: ReadonlySet<string>): void {
    const move = moveFromKeys(keys)
    const bomb = bombFromKeys(keys)
    if (this.last && this.last.move === move && this.last.bomb === bomb) return
    this.last = { move, bomb }
    this.send({ t: 'input', move, bomb })
  }

  /** Depois de reconectar, o próximo estado é reenviado mesmo que não tenha mudado. */
  reset(): void {
    this.last = null
  }
}
