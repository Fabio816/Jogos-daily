import { haversineKm, scoreFor, type Cell } from './geo';

export interface OndeSettings {
  rounds: number;
  seconds: number;
}

export const DEFAULT_ONDE_SETTINGS: OndeSettings = { rounds: 5, seconds: 90 };
export const REVEAL_SHOW_MS = 10_000;

export interface OndePlayer {
  name: string;
  score: number;
  joinedAt: number;
}

export interface OndeResult {
  km: number;
  pts: number;
}

export interface OndeRound {
  n: number;
  lat: number;
  lon: number;
  imageId: string;
  imageUrl: string;
  isPano?: boolean;
  creator: string;
  startedAt: number;
  durationMs: number;
  status: 'playing' | 'reveal';
  revealAt?: number;
  guesses: Record<string, Cell>;
  results: Record<string, OndeResult>;
}

export interface OndeRoom {
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: OndeSettings;
  players: Record<string, OndePlayer>;
  round: OndeRound | null;
  used: Record<string, boolean>;
}

export interface Pick {
  id: string;
  lat: number;
  lon: number;
  url: string;
  creator: string;
  isPano: boolean;
}

export function clampSettings(s: Partial<OndeSettings>): OndeSettings {
  const rounds = Math.min(10, Math.max(1, Math.round(s.rounds ?? DEFAULT_ONDE_SETTINGS.rounds)));
  const seconds = Math.min(180, Math.max(30, Math.round(s.seconds ?? DEFAULT_ONDE_SETTINGS.seconds)));
  return { rounds, seconds };
}

/** O Realtime Database omite mapas vazios. Esta função devolve a forma completa. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeOndeRoom(raw: any): OndeRoom {
  const players: Record<string, OndePlayer> = {};
  for (const [uid, p] of Object.entries<any>(raw.players ?? {})) { // eslint-disable-line @typescript-eslint/no-explicit-any
    players[uid] = { name: p.name ?? '?', score: p.score ?? 0, joinedAt: p.joinedAt ?? 0 };
  }
  const r = raw.round;
  return {
    hostUid: raw.hostUid,
    status: raw.status ?? 'lobby',
    settings: clampSettings(raw.settings ?? {}),
    players,
    round: r
      ? {
          ...r,
          guesses: r.guesses ?? {},
          results: r.results ?? {},
        }
      : null,
    used: raw.used ?? {},
  };
}

export function deadlineOf(round: OndeRound): number {
  return round.startedAt + round.durationMs;
}

/** Fecha a rodada: calcula distância e pontos de quem palpitou e soma no placar. */
export function reveal(room: OndeRoom, now: number): OndeRoom {
  const round = room.round!;
  const results: Record<string, OndeResult> = {};
  const players = { ...room.players };
  for (const [uid, g] of Object.entries(round.guesses)) {
    const km = haversineKm(g, { lat: round.lat, lon: round.lon });
    const pts = scoreFor(km);
    results[uid] = { km: Math.round(km * 10) / 10, pts };
    if (players[uid]) players[uid] = { ...players[uid], score: players[uid].score + pts };
  }
  const finished = round.n >= room.settings.rounds;
  return {
    ...room,
    status: finished ? 'finished' : 'playing',
    players,
    round: { ...round, status: 'reveal', revealAt: now, results },
  };
}

/** Começa uma nova rodada com a foto escolhida. Após a última, a partida termina. */
export function applyStartRound(room: OndeRoom, pick: Pick, now: number): OndeRoom | null {
  if (room.round && room.round.status !== 'reveal') return null;
  if (room.round && room.round.n >= room.settings.rounds) return null;
  if (room.used[pick.id]) return null;
  const n = (room.round?.n ?? 0) + 1;
  return {
    ...room,
    status: 'playing',
    used: { ...room.used, [pick.id]: true },
    round: {
      n,
      lat: pick.lat,
      lon: pick.lon,
      imageId: pick.id,
      imageUrl: pick.url,
      isPano: pick.isPano,
      creator: pick.creator,
      startedAt: now,
      durationMs: room.settings.seconds * 1000,
      status: 'playing',
      guesses: {},
      results: {},
    },
  };
}

/** Registra o palpite. Se todos palpitaram, a rodada fecha na hora. */
export function applyGuess(room: OndeRoom, uid: string, cell: Cell, now: number): OndeRoom | null {
  const round = room.round;
  if (!round || round.status !== 'playing' || !room.players[uid]) return null;
  if (now >= deadlineOf(round) || round.guesses[uid]) return null;
  const next: OndeRoom = { ...room, round: { ...round, guesses: { ...round.guesses, [uid]: cell } } };
  const everyone = Object.keys(room.players).every((id) => next.round!.guesses[id]);
  return everyone ? reveal(next, now) : next;
}

/** Tempo esgotado: fecha a rodada com quem palpitou até agora. */
export function applyTick(room: OndeRoom, now: number): OndeRoom | null {
  const round = room.round;
  if (!round || round.status !== 'playing' || now < deadlineOf(round)) return null;
  return reveal(room, now);
}

/** Quem está pronto para a próxima rodada (o host confirma depois de ver o resultado). */
export function canStartNext(room: OndeRoom, now: number): boolean {
  const round = room.round;
  if (!round) return room.status === 'lobby';
  return round.status === 'reveal' && round.n < room.settings.rounds && now >= (round.revealAt ?? 0) + REVEAL_SHOW_MS;
}

export function standings(room: OndeRoom): { uid: string; name: string; score: number }[] {
  return Object.entries(room.players)
    .map(([uid, p]) => ({ uid, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}
