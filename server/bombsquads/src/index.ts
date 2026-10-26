export { Room } from './room'

/** Sem I, O, 0 e 1: o código pode ser ditado sem confusão. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5
const ROOM_PATH = /^\/room\/([A-HJ-NP-Z2-9]{5})$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'bombsquads-server' }, { headers: CORS })
    }

    if (url.pathname === '/new') {
      return Response.json({ code: randomCode() }, { headers: CORS })
    }

    const match = url.pathname.match(ROOM_PATH)
    if (match) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 })
      }
      const id = env.ROOM.idFromName(match[1])
      return env.ROOM.get(id).fetch(request)
    }

    return new Response('Not found', { status: 404, headers: CORS })
  },
}
