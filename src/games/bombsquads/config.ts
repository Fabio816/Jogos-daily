/** Endereço do servidor de partidas (Cloudflare Workers). Pode ser trocado por variável de build. */
export const PROD_WS_BASE = 'wss://bombsquads-server.bombsquads.workers.dev'

export const WS_BASE: string = (() => {
  // Ajuda de dev: ?wss=prod força o servidor público (navegador de teste local).
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('wss') === 'prod') return PROD_WS_BASE
  return (import.meta.env.VITE_BOMBSQUADS_WS_URL as string | undefined)?.replace(/\/$/, '') ?? PROD_WS_BASE
})()

export const HTTP_BASE: string = WS_BASE.replace(/^ws/, 'http')

export function roomUrl(code: string): string {
  return `${WS_BASE}/room/${code}`
}

/** Pede um código de sala novo ao servidor. */
export async function createRoomCode(): Promise<string> {
  const response = await fetch(`${HTTP_BASE}/new`)
  if (!response.ok) throw new Error('Não foi possível criar a sala agora.')
  const data = (await response.json()) as { code?: unknown }
  if (typeof data.code !== 'string') throw new Error('Resposta inesperada do servidor.')
  return data.code
}
