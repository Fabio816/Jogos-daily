import { describe, expect, it } from 'vitest'
import {
  addPlayer,
  canStart,
  MAX_PLAYERS,
  newLobby,
  removePlayer,
  resetReady,
  setReady,
} from '../src/lobby'

function join(lobby: ReturnType<typeof newLobby>, n: number) {
  return addPlayer(lobby, { id: `p${n}`, token: `t${n}`, name: `P${n}` })
}

describe('lobby', () => {
  it('makes the first player the host and reassigns when the host leaves', () => {
    const lobby = newLobby('ABCDE')
    join(lobby, 1)
    join(lobby, 2)
    expect(lobby.hostId).toBe('p1')

    removePlayer(lobby, 'p1')
    expect(lobby.hostId).toBe('p2')

    removePlayer(lobby, 'p2')
    expect(lobby.hostId).toBeNull()
  })

  it('caps the room at 10 players', () => {
    const lobby = newLobby('ABCDE')
    for (let i = 1; i <= MAX_PLAYERS; i += 1) expect(join(lobby, i).ok).toBe(true)
    expect(join(lobby, 99)).toEqual({ ok: false, error: 'room_full' })
  })

  it('refuses new players while a match is running', () => {
    const lobby = newLobby('ABCDE')
    join(lobby, 1)
    lobby.status = 'playing'
    expect(join(lobby, 2)).toEqual({ ok: false, error: 'match_in_progress' })
  })

  it('starts only for the host, with at least 2 players, all ready', () => {
    const lobby = newLobby('ABCDE')
    join(lobby, 1)
    expect(canStart(lobby, 'p1')).toEqual({ ok: false, error: 'not_enough_players' })

    join(lobby, 2)
    expect(canStart(lobby, 'p2')).toEqual({ ok: false, error: 'not_host' })
    expect(canStart(lobby, 'p1')).toEqual({ ok: false, error: 'not_ready' })

    setReady(lobby, 'p1', true)
    setReady(lobby, 'p2', true)
    expect(canStart(lobby, 'p1')).toEqual({ ok: true })
  })

  it('resets ready flags after a match', () => {
    const lobby = newLobby('ABCDE')
    join(lobby, 1)
    join(lobby, 2)
    setReady(lobby, 'p1', true)
    setReady(lobby, 'p2', true)
    resetReady(lobby)
    expect(lobby.players.every((player) => !player.ready)).toBe(true)
  })
})
