import type { ClientMessage, ServerMessage } from './messages'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

type ConnectionOptions = {
  url: string
  /** Mensagem de entrada enviada a cada conexão (inclui a sessão, se houver). */
  hello: () => ClientMessage
  onMessage: (msg: ServerMessage) => void
  onStatus: (status: ConnectionStatus) => void
  /** Quando o servidor fecha por motivo permanente, não tenta de novo. */
  onFatal?: (code: number, reason: string) => void
}

const MAX_DELAY_MS = 8000
/** Códigos do servidor que não adianta reconectar: sessão recusada ou substituída. */
const FATAL_CODES = new Set([4001, 4003])

/** WebSocket com reconexão e backoff exponencial. */
export class Connection {
  private readonly options: ConnectionOptions
  private socket: WebSocket | null = null
  private attempt = 0
  private stopped = true
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(options: ConnectionOptions) {
    this.options = options
  }

  start(): void {
    this.stopped = false
    this.open()
  }

  stop(): void {
    this.stopped = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.socket?.close(1000, 'left')
    this.socket = null
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg))
  }

  private open(): void {
    this.options.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    const socket = new WebSocket(this.options.url)
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.options.onStatus('open')
      this.send(this.options.hello())
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        this.options.onMessage(JSON.parse(event.data) as ServerMessage)
      } catch {
        // mensagem malformada do servidor: ignora
      }
    }

    socket.onclose = (event) => {
      if (import.meta.env.DEV) console.debug('[bombsquads] close', event.code, event.reason || '-', 'stopped=', this.stopped)
      if (this.stopped) {
        this.options.onStatus('closed')
        return
      }
      if (FATAL_CODES.has(event.code)) {
        this.stopped = true
        this.options.onStatus('closed')
        this.options.onFatal?.(event.code, event.reason)
        return
      }
      this.attempt += 1
      const delay = Math.min(MAX_DELAY_MS, 500 * 2 ** Math.min(this.attempt, 4))
      this.options.onStatus('reconnecting')
      this.timer = setTimeout(() => this.open(), delay)
    }
  }
}
