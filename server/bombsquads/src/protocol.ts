import { LEVELS, MAP_SIZE_CHOICES, type MatchSettings } from '../../../src/games/bombsquads/sim'

import type { ClientMessage, Move } from '../../../src/games/bombsquads/messages'
export type { ClientMessage, Move }

export const MAX_MESSAGE_BYTES = 512
const MOVES: readonly Move[] = ['up', 'down', 'left', 'right', 'none']
const DEFAULT_NAME = 'Jogador'

/** Remove caracteres de controle e limita o nome a 16 caracteres. */
export function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16)
  return cleaned.length > 0 ? cleaned : DEFAULT_NAME
}

/**
 * Valida a mensagem recebida. Devolve null para qualquer coisa fora do
 * formato: o servidor não confia no cliente nem no tamanho do payload.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) return null

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const msg = data as Record<string, unknown>

  switch (msg.t) {
    case 'hello': {
      if (typeof msg.name !== 'string') return null
      const playerId = typeof msg.playerId === 'string' && msg.playerId.length <= 64 ? msg.playerId : undefined
      const token = typeof msg.token === 'string' && msg.token.length <= 128 ? msg.token : undefined
      return { t: 'hello', name: sanitizeName(msg.name), playerId, token }
    }
    case 'ready':
      return typeof msg.ready === 'boolean' ? { t: 'ready', ready: msg.ready } : null
    case 'start':
      return { t: 'start' }
    case 'settings': {
      const settings = parseSettings(msg.settings)
      return settings ? { t: 'settings', settings } : null
    }
    case 'input': {
      if (typeof msg.move !== 'string' || !MOVES.includes(msg.move as Move)) return null
      if (typeof msg.bomb !== 'boolean') return null
      return { t: 'input', move: msg.move as Move, bomb: msg.bomb }
    }
    case 'ping':
      return { t: 'ping' }
    default:
      return null
  }
}

/**
 * Valida as configurações do host. Todas as chaves são obrigatórias e só
 * aceitam os valores conhecidos; qualquer outra coisa recusa o pedido inteiro.
 */
export function parseSettings(value: unknown): MatchSettings | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const { mapSize, crates, itemDrop, powerCap } = raw
  if (!MAP_SIZE_CHOICES.includes(mapSize as MatchSettings['mapSize'])) return null
  if (!LEVELS.includes(crates as MatchSettings['crates'])) return null
  if (!LEVELS.includes(itemDrop as MatchSettings['itemDrop'])) return null
  if (!LEVELS.includes(powerCap as MatchSettings['powerCap'])) return null
  return {
    mapSize: mapSize as MatchSettings['mapSize'],
    crates: crates as MatchSettings['crates'],
    itemDrop: itemDrop as MatchSettings['itemDrop'],
    powerCap: powerCap as MatchSettings['powerCap'],
  }
}
