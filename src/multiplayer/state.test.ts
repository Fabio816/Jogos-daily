import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../data/questions';
import { DEFAULT_SETTINGS, buildPool } from '../game/catalog';
import {
  REVEAL_MS,
  applyAdvance,
  applyClaim,
  applyStart,
  isAdvanceDue,
  normalizeRoom,
  type RoomState,
} from './state';

const pool = buildPool(DEFAULT_SETTINGS);
const first = () => () => 0; // sempre escolhe a primeira pergunta disponível

function baseRoom(overrides: Partial<RoomState> = {}): RoomState {
  return {
    hostUid: 'host',
    status: 'playing',
    settings: { ...DEFAULT_SETTINGS, durationSec: 20, targetPoints: 100 },
    players: {
      host: { name: 'Fábio', score: 0, connected: true },
      ana: { name: 'Ana', score: 0, connected: true },
    },
    round: null,
    used: {},
    ...overrides,
  };
}

describe('applyStart', () => {
  it('muda para playing e zera placares', () => {
    const room = baseRoom({
      status: 'lobby',
      players: { host: { name: 'Fábio', score: 50, connected: true } },
    });
    const started = applyStart(room)!;
    expect(started.status).toBe('playing');
    expect(started.players.host.score).toBe(0);
    expect(started.round).toBeNull();
  });

  it('não reinicia uma partida em andamento', () => {
    expect(applyStart(baseRoom())).toBeNull();
  });
});

describe('applyAdvance', () => {
  it('inicia a rodada 1 quando não há rodada', () => {
    const next = applyAdvance(baseRoom(), 1000, pool, first())!;
    expect(next.round?.n).toBe(1);
    expect(next.round?.status).toBe('clue');
    expect(next.round?.startedAt).toBe(1000);
    expect(next.used[next.round!.qid]).toBe(true);
  });

  it('não repete perguntas já usadas', () => {
    let room = applyAdvance(baseRoom(), 0, pool, first())!;
    const seen = new Set<string>([room.round!.qid]);
    for (let i = 0; i < 5; i++) {
      room = applyAdvance(room, room.round!.startedAt + room.round!.durationMs, pool, first())!; // para reveal
      room = applyAdvance(room, room.round!.revealAt! + REVEAL_MS, pool, first())!; // próxima rodada
      expect(seen.has(room.round!.qid)).toBe(false);
      seen.add(room.round!.qid);
    }
  });

  it('passa de pista para revelação quando o tempo acaba', () => {
    const room = applyAdvance(baseRoom(), 0, pool, first())!;
    const endAt = room.round!.durationMs;
    expect(applyAdvance(room, endAt - 1, pool, first())).toBeNull();
    const revealed = applyAdvance(room, endAt, pool, first())!;
    expect(revealed.round?.status).toBe('reveal');
    expect(revealed.round?.winnerUid).toBeUndefined();
  });

  it('só avança para a próxima rodada depois de REVEAL_MS', () => {
    const revealed = applyAdvance(
      applyAdvance(baseRoom(), 0, pool, first())!,
      20_000,
      pool,
      first(),
    )!;
    const revealAt = revealed.round!.revealAt!;
    expect(applyAdvance(revealed, revealAt + REVEAL_MS - 1, pool, first())).toBeNull();
    expect(applyAdvance(revealed, revealAt + REVEAL_MS, pool, first())?.round?.n).toBe(2);
  });

  it('termina a partida quando alguém atinge o alvo', () => {
    const room = baseRoom({
      players: { host: { name: 'Fábio', score: 100, connected: true } },
      round: { n: 3, qid: QUESTIONS[0].id, startedAt: 0, durationMs: 20000, status: 'reveal', revealAt: 0 },
      used: { [QUESTIONS[0].id]: true },
    });
    expect(applyAdvance(room, REVEAL_MS, pool, first())?.status).toBe('finished');
  });

  it('é idempotente: não faz nada se não há prazo vencido', () => {
    const room = applyAdvance(baseRoom(), 0, pool, first())!;
    expect(applyAdvance(room, 100, pool, first())).toBeNull();
    expect(isAdvanceDue(room, 100)).toBe(false);
  });
});

describe('applyClaim', () => {
  it('dá pontos ao primeiro que acerta', () => {
    const room = applyAdvance(baseRoom(), 0, pool, first())!;
    const claimed = applyClaim(room, 'ana', 5000)!;
    expect(claimed.round?.winnerUid).toBe('ana');
    expect(claimed.round?.status).toBe('reveal');
    expect(claimed.players.ana.score).toBe(claimed.round!.winnerPoints);
    expect(claimed.players.ana.score).toBeGreaterThan(0);
  });

  it('rejeita o segundo acerto da mesma rodada', () => {
    const claimed = applyClaim(applyAdvance(baseRoom(), 0, pool, first())!, 'ana', 5000)!;
    expect(applyClaim(claimed, 'host', 6000)).toBeNull();
  });

  it('rejeita acerto depois do tempo', () => {
    const room = applyAdvance(baseRoom(), 0, pool, first())!;
    expect(applyClaim(room, 'ana', 20_000)).toBeNull();
  });

  it('rejeita acerto de quem não está na sala', () => {
    const room = applyAdvance(baseRoom(), 0, pool, first())!;
    expect(applyClaim(room, 'intruso', 1000)).toBeNull();
  });

  it('dá mais pontos para quem responde antes', () => {
    const room = applyAdvance(baseRoom(), 0, pool, first())!;
    const fast = applyClaim(room, 'ana', 1000)!;
    const slow = applyClaim(room, 'ana', 15000)!;
    expect(fast.players.ana.score).toBeGreaterThan(slow.players.ana.score);
  });
});

describe('normalizeRoom', () => {
  it('preenche listas e mapas que o Realtime Database omite quando vazios', () => {
    const room = normalizeRoom({
      hostUid: 'h',
      status: 'lobby',
      settings: { targetPoints: 50, durationSec: 15 },
    });
    expect(room.players).toEqual({});
    expect(room.used).toEqual({});
    expect(room.round).toBeNull();
    expect(room.settings.types).toEqual([]);
    expect(room.settings.targetPoints).toBe(50);
  });

  it('converte listas que chegam como objeto', () => {
    const room = normalizeRoom({
      hostUid: 'h',
      settings: { types: { 0: 'movie', 1: 'game' } },
    });
    expect(room.settings.types).toEqual(['movie', 'game']);
  });
});
