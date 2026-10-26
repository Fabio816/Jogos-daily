/**
 * Sessão guardada no navegador: sem ela, uma queda de conexão vira "saiu da
 * partida". O token é o segredo que o servidor pede para reconectar.
 */
const KEY = 'bombsquads:session'
const NAME_KEY = 'bombsquads:name'

export type Session = {
  code: string
  playerId: string
  token: string
  name: string
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<Session>
    if (typeof data.code === 'string' && typeof data.playerId === 'string' && typeof data.token === 'string') {
      return { code: data.code, playerId: data.playerId, token: data.token, name: String(data.name ?? '') }
    }
    return null
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // modo privado: a reconexão só funciona enquanto a página estiver aberta
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a limpar
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // sem persistência de nome
  }
}
