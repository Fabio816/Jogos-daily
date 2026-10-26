import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE_BYTES, parseClientMessage, sanitizeName } from '../src/protocol'

describe('parseClientMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseClientMessage('{"t":"hello","name":"Ana"}')).toEqual({ t: 'hello', name: 'Ana', playerId: undefined, token: undefined })
    expect(parseClientMessage('{"t":"ready","ready":true}')).toEqual({ t: 'ready', ready: true })
    expect(parseClientMessage('{"t":"start"}')).toEqual({ t: 'start' })
    expect(parseClientMessage('{"t":"input","move":"up","bomb":false}')).toEqual({ t: 'input', move: 'up', bomb: false })
    expect(parseClientMessage('{"t":"ping"}')).toEqual({ t: 'ping' })
  })

  it('rejects bad JSON, unknown types and wrong field types', () => {
    expect(parseClientMessage('not json')).toBeNull()
    expect(parseClientMessage('[]')).toBeNull()
    expect(parseClientMessage('{"t":"hack"}')).toBeNull()
    expect(parseClientMessage('{"t":"ready","ready":"yes"}')).toBeNull()
    expect(parseClientMessage('{"t":"input","move":"diagonal","bomb":false}')).toBeNull()
    expect(parseClientMessage('{"t":"input","move":"up","bomb":1}')).toBeNull()
  })

  it('rejects oversized payloads', () => {
    const big = JSON.stringify({ t: 'hello', name: 'x'.repeat(MAX_MESSAGE_BYTES) })
    expect(parseClientMessage(big)).toBeNull()
  })

  it('drops overlong tokens and ids instead of trusting them', () => {
    const msg = parseClientMessage(JSON.stringify({ t: 'hello', name: 'A', playerId: 'x'.repeat(100), token: 't' }))
    expect(msg).toMatchObject({ playerId: undefined, token: 't' })
  })
})

describe('sanitizeName', () => {
  it('strips control characters, trims and limits to 16 characters', () => {
    expect(sanitizeName('  Ana\u0007  ')).toBe('Ana')
    expect(sanitizeName('a'.repeat(40))).toHaveLength(16)
  })

  it('falls back to a default name', () => {
    expect(sanitizeName('   ')).toBe('Jogador')
  })
})

describe('settings', () => {
  it('accepts a full valid settings object', () => {
    const msg = parseClientMessage(JSON.stringify({
      t: 'settings',
      settings: { mapSize: 'small', crates: 'high', itemDrop: 'low', powerCap: 'normal' },
    }))
    expect(msg).toEqual({
      t: 'settings',
      settings: { mapSize: 'small', crates: 'high', itemDrop: 'low', powerCap: 'normal' },
    })
  })

  it('rejects unknown values and missing keys', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'settings', settings: { mapSize: 'huge', crates: 'normal', itemDrop: 'normal', powerCap: 'normal' } }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'settings', settings: { mapSize: 'small' } }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'settings' }))).toBeNull()
  })
})
