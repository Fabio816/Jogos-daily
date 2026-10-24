export const START_LIVES = 2;
export const MIN_PLAYERS = 2;
/** Menor duração de um turno, mesmo com aceleração. */
export const MIN_TURN_SECONDS = 3;
/** Valores aceitos para a aceleração (segundos a menos por acerto seguido). */
export const ACCEL_OPTIONS: readonly number[] = [0, 1, 2];
/** Quanto tempo a última tentativa fica no balão (ms). */
export const SAY_BUBBLE_MS = 1500;

export interface BombPlayer {
  name: string;
  lives: number;
  joinedAt: number;
  /** Presença: false quando a conexão cai. */
  connected?: boolean;
  /** Acertos seguidos (zera quando o tempo estoura). */
  streak?: number;
}

export interface BombSettings {
  /** Segundos a menos no turno de quem acerta seguido, por acerto seguido (0 = desligado). */
  accel: number;
}

/** O que o jogador da vez está digitando (aparece no balão acima do avatar). */
export interface BombTyping {
  uid: string;
  text: string;
  /** `turns` no momento da digitação: texto de turno anterior é ignorado. */
  turn: number;
}

/** Última tentativa enviada: sobe para o balão do jogador, certa ou errada. */
export interface BombSay {
  uid: string;
  text: string;
  ok: boolean;
  ts: number;
}

export interface BombRoom {
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  players: Record<string, BombPlayer>;
  /** Ordem dos turnos (definida no início da partida). */
  order: string[];
  /** Índice em `order` de quem está jogando. */
  turn: number;
  /** Quantos turnos já foram jogados. */
  turns: number;
  syllable: string;
  /** Prazo do turno atual (ms, relógio do servidor). */
  deadline: number;
  /** Duração do turno atual (ms). */
  turnMs?: number;
  used: Record<string, boolean>;
  settings?: BombSettings;
  typing?: BombTyping;
  say?: BombSay;
  winnerUid?: string;
  event?: { text: string; ts: number };
}

/** Tempo base do turno: 12 s no início, diminui 1 s a cada 8 turnos, mínimo de 5 s. */
export function turnSeconds(turns: number): number {
  return Math.max(5, 12 - Math.floor(turns / 8));
}

/** Duração do turno de `uid`: tempo base menos a aceleração pelos acertos seguidos dele. */
export function turnMsFor(room: BombRoom, uid: string): number {
  const accel = room.settings?.accel ?? 0;
  const streak = room.players[uid]?.streak ?? 0;
  const seconds = Math.max(MIN_TURN_SECONDS, turnSeconds(room.turns) - accel * streak);
  return seconds * 1000;
}

export function currentUid(room: BombRoom): string | undefined {
  return room.order[room.turn];
}

export function isTurnExpired(room: BombRoom, now: number): boolean {
  return room.status === 'playing' && now >= room.deadline;
}

function aliveOf(room: BombRoom): string[] {
  return room.order.filter((uid) => (room.players[uid]?.lives ?? 0) > 0);
}

/** Próximo índice de jogador vivo, a partir de `from` (exclusive). -1 se não houver ninguém. */
function nextAliveIndex(room: BombRoom, from: number): number {
  const n = room.order.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if ((room.players[room.order[idx]]?.lives ?? 0) > 0) return idx;
  }
  return -1;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Passa a vez para o próximo jogador vivo e define o prazo dele.
 * Acerto sorteia sílaba nova; tempo estourado mantém a sílaba para o próximo.
 */
function advance(
  room: BombRoom,
  now: number,
  syllables: readonly string[],
  rng: () => number,
  keepSyllable = false,
): BombRoom {
  const alive = aliveOf(room);
  if (alive.length <= 1) {
    return { ...room, status: 'finished', winnerUid: alive[0], typing: undefined };
  }
  const nextIdx = nextAliveIndex(room, room.turn);
  const next: BombRoom = { ...room, turn: nextIdx, typing: undefined };
  const ms = turnMsFor(next, room.order[nextIdx]);
  return {
    ...next,
    syllable: keepSyllable ? room.syllable : pick(syllables, rng),
    deadline: now + ms,
    turnMs: ms,
  };
}

/** Início da partida: todos com vidas cheias, ordem de entrada e primeira sílaba. */
export function applyStart(
  room: BombRoom,
  syllables: readonly string[],
  now: number,
  rng: () => number = Math.random,
): BombRoom | null {
  if (room.status === 'playing') return null;
  const order = Object.keys(room.players).sort(
    (a, b) => (room.players[a].joinedAt ?? 0) - (room.players[b].joinedAt ?? 0),
  );
  if (order.length < MIN_PLAYERS) return null;

  const players = Object.fromEntries(
    order.map((uid) => [uid, { ...room.players[uid], lives: START_LIVES, streak: 0 }]),
  );
  const started: BombRoom = {
    ...room,
    status: 'playing',
    players,
    order,
    turn: 0,
    turns: 0,
    used: {},
    winnerUid: undefined,
    typing: undefined,
  };
  const ms = turnMsFor(started, order[0]);
  return {
    ...started,
    syllable: pick(syllables, rng),
    deadline: now + ms,
    turnMs: ms,
    event: { text: `Começou! Vez de ${players[order[0]].name}.`, ts: now },
  };
}

/** Configuração de aceleração. Só o host, e só no lobby ou depois de uma partida. */
export function applySettings(room: BombRoom, uid: string, accel: number): BombRoom | null {
  if (room.hostUid !== uid) return null;
  if (room.status === 'playing') return null;
  if (!ACCEL_OPTIONS.includes(accel)) return null;
  return { ...room, settings: { accel } };
}

/** Motivo para recusar uma tentativa, ou null se a palavra pode ser enviada. */
export function attemptProblem(room: BombRoom, word: string, inDictionary: boolean): string | null {
  if (!word.includes(room.syllable)) return `A palavra precisa conter "${room.syllable.toUpperCase()}".`;
  if (!inDictionary) return 'Essa palavra não está no dicionário.';
  if (room.used[word]) return 'Essa palavra já foi usada.';
  return null;
}

/** Palavra enviada pelo jogador da vez. `valid` vem do dicionário (checado no cliente). */
export function applySubmit(
  room: BombRoom,
  uid: string,
  word: string,
  valid: boolean,
  now: number,
  syllables: readonly string[],
  rng: () => number = Math.random,
): BombRoom | null {
  if (room.status !== 'playing') return null;
  if (currentUid(room) !== uid || now >= room.deadline) return null;
  if (!valid || !word.includes(room.syllable) || room.used[word]) return null;

  const player = room.players[uid];
  const next: BombRoom = {
    ...room,
    players: { ...room.players, [uid]: { ...player, streak: (player?.streak ?? 0) + 1 } },
    used: { ...room.used, [word]: true },
    turns: room.turns + 1,
    event: { text: `${player?.name ?? '?'} disse ${word}.`, ts: now },
  };
  return advance(next, now, syllables, rng);
}

/** Tempo esgotado: o jogador da vez perde uma vida e zera a sequência de acertos. */
export function applyTimeout(
  room: BombRoom,
  now: number,
  syllables: readonly string[],
  rng: () => number = Math.random,
): BombRoom | null {
  if (!isTurnExpired(room, now)) return null;
  const uid = currentUid(room);
  if (!uid) return null;

  const player = room.players[uid];
  const lives = Math.max(0, player.lives - 1);
  const text = lives === 0 ? `${player.name} foi eliminado!` : `${player.name} perdeu uma vida.`;
  const next: BombRoom = {
    ...room,
    players: { ...room.players, [uid]: { ...player, lives, streak: 0 } },
    turns: room.turns + 1,
    event: { text, ts: now },
  };
  return advance(next, now, syllables, rng, true);
}
