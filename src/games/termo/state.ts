import { applyGame, isLost, isWon, type GameState } from './game';
import { MAX_TRIES, MAX_WORDS, MIN_WORDS, clampTries, normalizeBoards, pickTarget, pointsFor } from './logic';

export interface TermoSettings {
  /** Palavras (rodadas) por partida. */
  words: number;
  /** Tentativas para resolver os tabuleiros. */
  tries: number;
  /** Quantas palavras são jogadas ao mesmo tempo: 1, 2, 4, 5 ou 6. */
  boards: number;
}

export const DEFAULT_TERMO_SETTINGS: TermoSettings = { words: 3, tries: MAX_TRIES, boards: 1 };

export interface TermoPlayer {
  name: string;
  guesses: string[];
  solved: boolean;
  /** Pontos acumulados na partida. */
  score: number;
}

export interface TermoRound {
  n: number;
  words: string[];
  status: 'playing' | 'done';
  winnerUid?: string;
}

export interface TermoRoom {
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: TermoSettings;
  players: Record<string, TermoPlayer>;
  round: TermoRound | null;
  used: Record<string, boolean>;
}

function toArray<T = string>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return Object.values(value) as T[];
  return [];
}

export function clampSettings(s: Partial<TermoSettings>): TermoSettings {
  const words = Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(s.words ?? DEFAULT_TERMO_SETTINGS.words)));
  const boards = normalizeBoards(s.boards ?? DEFAULT_TERMO_SETTINGS.boards);
  const tries = clampTries(s.tries ?? DEFAULT_TERMO_SETTINGS.tries, boards);
  return { words, tries, boards };
}

/** O Realtime Database omite listas e mapas vazios. Esta função devolve a forma completa. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeTermoRoom(raw: any): TermoRoom {
  const players: Record<string, TermoPlayer> = {};
  for (const [uid, p] of Object.entries<any>(raw.players ?? {})) { // eslint-disable-line @typescript-eslint/no-explicit-any
    players[uid] = { name: p.name ?? '?', guesses: toArray(p.guesses), solved: !!p.solved, score: p.score ?? 0 };
  }
  let round: TermoRound | null = null;
  if (raw.round) {
    round = {
      n: raw.round.n,
      words: toArray(raw.round.words ?? (raw.round.word ? [raw.round.word] : [])),
      status: raw.round.status,
      winnerUid: raw.round.winnerUid ?? undefined,
    };
  }
  return {
    hostUid: raw.hostUid,
    status: raw.status ?? 'lobby',
    settings: clampSettings(raw.settings ?? {}),
    players,
    round,
    used: raw.used ?? {},
  };
}

/** Jogo de um jogador na rodada atual. */
export function gameOf(room: TermoRoom, player: TermoPlayer): GameState | null {
  if (!room.round) return null;
  return { words: room.round.words, guesses: player.guesses, tries: room.settings.tries };
}

/** A rodada termina quando alguém resolve tudo ou quando todos esgotaram as tentativas. */
export function isEveryoneDone(room: TermoRoom): boolean {
  const players = Object.values(room.players);
  if (players.length === 0 || !room.round) return false;
  return players.every((p) => {
    const g = gameOf(room, p);
    return !!g && (isWon(g) || isLost(g));
  });
}

/** Pontos de um jogador na rodada: 10 por tentativa a menos, multiplicado pelo número de tabuleiros. */
export function pointsOf(player: TermoPlayer, tries: number = MAX_TRIES, boards = 1): number {
  return player.solved ? pointsFor(player.guesses.length, tries) * boards : 0;
}

/** Zera placares e histórico para começar uma nova partida na mesma sala. */
function resetMatch(room: TermoRoom): TermoRoom {
  const players = Object.fromEntries(
    Object.entries(room.players).map(([uid, p]) => [uid, { ...p, guesses: [], solved: false, score: 0 }]),
  );
  return { ...room, status: 'lobby', players, round: null, used: {} };
}

/** Escolhe `count` palavras distintas que ainda não foram usadas nesta sala. */
export function pickWords(
  targets: readonly string[],
  used: Record<string, boolean>,
  count: number,
  rng: () => number = Math.random,
): string[] | undefined {
  const taken = new Set(Object.keys(used));
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    const w = pickTarget(targets, taken, rng);
    if (!w) return undefined;
    words.push(w);
    taken.add(w);
  }
  return words;
}

/** Inicia a próxima palavra (ou o próximo conjunto de tabuleiros). Encerra a partida ao fim das rodadas. */
export function applyNewRound(room: TermoRoom, targets: readonly string[], rng: () => number = Math.random): TermoRoom | null {
  if (room.round && room.round.status !== 'done') return null;
  const base = room.status === 'finished' ? resetMatch(room) : room;
  if (base.round && base.round.n >= base.settings.words) {
    return { ...base, status: 'finished' };
  }

  const words = pickWords(targets, base.used, base.settings.boards, rng);
  if (!words) return null;
  const players = Object.fromEntries(
    Object.entries(base.players).map(([uid, p]) => [uid, { ...p, guesses: [], solved: false }]),
  );
  const used = { ...base.used };
  for (const w of words) used[w] = true;
  return {
    ...base,
    status: 'playing',
    players,
    round: { n: (base.round?.n ?? 0) + 1, words, status: 'playing' },
    used,
  };
}

/** Registra um palpite do jogador. Retorna null se não puder ser aceito. */
export function applyGuess(room: TermoRoom, uid: string, guess: string, dictionary: ReadonlySet<string>): TermoRoom | null {
  const round = room.round;
  const player = room.players[uid];
  if (!round || round.status !== 'playing' || !player) return null;
  const game = gameOf(room, player);
  if (!game) return null;
  const nextGame = applyGame(game, guess, dictionary);
  if (!nextGame) return null;

  const solved = isWon(nextGame);
  const next: TermoRoom = {
    ...room,
    players: {
      ...room.players,
      [uid]: { ...player, guesses: nextGame.guesses, solved },
    },
  };

  if (solved || isEveryoneDone(next)) {
    // Soma os pontos da rodada no placar de cada jogador (uma única vez, ao encerrar).
    next.players = Object.fromEntries(
      Object.entries(next.players).map(([id, p]) => [
        id,
        { ...p, score: p.score + pointsOf(p, room.settings.tries, room.settings.boards) },
      ]),
    );
    next.round = { ...round, status: 'done', ...(solved ? { winnerUid: uid } : {}) };
  }
  return next;
}


