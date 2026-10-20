import type { Question } from '../data/questions';
import { pointsFor } from '../game/scoring';
import { DEFAULT_MIX, pickRound } from '../game/mix';
import type { RoomSettings } from '../game/catalog';

/** Tempo que a resposta fica visível antes da próxima rodada. */
export const REVEAL_MS = 4000;

export interface PlayerState {
  name: string;
  score: number;
  connected: boolean;
}

export interface RoundState {
  n: number;
  qid: string;
  startedAt: number;
  durationMs: number;
  status: 'clue' | 'reveal';
  /** Só existe em rodadas com capa: true = desfocada, false = nítida. */
  blur?: boolean;
  revealAt?: number;
  winnerUid?: string;
  winnerPoints?: number;
}

export interface RoomState {
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  players: Record<string, PlayerState>;
  round: RoundState | null;
  used: Record<string, boolean>;
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return Object.values(value) as T[];
  return [];
}

/**
 * O Realtime Database omite listas e mapas vazios e pode devolver arrays como objetos.
 * Esta função devolve sempre a forma completa.
 */
export function normalizeRoom(raw: any): RoomState {
  const s = raw.settings ?? {};
  return {
    hostUid: raw.hostUid,
    status: raw.status ?? 'lobby',
    settings: {
      targetPoints: s.targetPoints ?? 100,
      durationSec: s.durationSec ?? 20,
      types: toArray(s.types),
      difficulties: toArray(s.difficulties),
      mix: { ...DEFAULT_MIX, ...(s.mix ?? {}) },
    },
    players: raw.players ?? {},
    round: raw.round ?? null,
    used: raw.used ?? {},
  };
}

const reachedTarget = (room: RoomState) =>
  Object.values(room.players).some((p) => p.score >= room.settings.targetPoints);

function startNextRound(room: RoomState, now: number, pool: Question[], rng: () => number): RoomState {
  const pick = pickRound(pool, new Set(Object.keys(room.used)), room.settings.mix, rng);
  if (!pick) return { ...room, status: 'finished' };

  const q = pick.question;
  return {
    ...room,
    round: {
      n: (room.round?.n ?? 0) + 1,
      qid: q.id,
      startedAt: now,
      durationMs: room.settings.durationSec * 1000,
      status: 'clue',
      // Omitido (e não undefined) sem capa: o Realtime Database rejeita undefined.
      ...(q.imageUrl ? { blur: pick.blur } : {}),
    },
    used: { ...room.used, [q.id]: true },
  };
}

/** Indica se `applyAdvance` teria alguma mudança a fazer agora. */
export function isAdvanceDue(room: RoomState, now: number): boolean {
  if (room.status !== 'playing') return false;
  const r = room.round;
  if (!r) return true;
  if (r.status === 'clue') return now >= r.startedAt + r.durationMs;
  return now >= (r.revealAt ?? now) + REVEAL_MS;
}

/**
 * Avança a partida quando o tempo da pista acabou ou a revelação terminou.
 * Retorna null quando não há nada a fazer (é seguro chamar de vários clientes ao mesmo tempo).
 */
export function applyAdvance(
  room: RoomState,
  now: number,
  pool: Question[],
  rng: () => number = Math.random,
): RoomState | null {
  if (!isAdvanceDue(room, now)) return null;
  const r = room.round;
  if (!r) return startNextRound(room, now, pool, rng);

  if (r.status === 'clue') {
    return { ...room, round: { ...r, status: 'reveal', revealAt: now } };
  }
  if (reachedTarget(room)) return { ...room, status: 'finished' };
  return startNextRound(room, now, pool, rng);
}

/**
 * Registra o primeiro acerto da rodada. Quem chega antes leva os pontos;
 * os demais recebem null (a transação é abortada).
 */
export function applyClaim(room: RoomState, uid: string, now: number): RoomState | null {
  if (room.status !== 'playing' || !room.round) return null;
  const r = room.round;
  if (r.status !== 'clue' || now >= r.startedAt + r.durationMs) return null;

  const player = room.players[uid];
  if (!player) return null;

  const points = pointsFor(now - r.startedAt, r.durationMs);
  return {
    ...room,
    round: { ...r, status: 'reveal', revealAt: now, winnerUid: uid, winnerPoints: points },
    players: { ...room.players, [uid]: { ...player, score: player.score + points } },
  };
}

/** Inicia (ou reinicia) a partida: zera placares e histórico de perguntas. */
export function applyStart(room: RoomState): RoomState | null {
  if (room.status === 'playing') return null;
  const players = Object.fromEntries(
    Object.entries(room.players).map(([uid, p]) => [uid, { ...p, score: 0 }]),
  );
  return { ...room, status: 'playing', round: null, used: {}, players };
}
