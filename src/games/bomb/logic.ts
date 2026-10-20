export const START_LIVES = 2;
export const MIN_PLAYERS = 2;

export interface BombPlayer {
  name: string;
  lives: number;
  joinedAt: number;
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
  used: Record<string, boolean>;
  winnerUid?: string;
  event?: { text: string; ts: number };
}

/** Tempo do turno: 12 s no início, diminui 1 s a cada 8 turnos, mínimo de 5 s. */
export function turnSeconds(turns: number): number {
  return Math.max(5, 12 - Math.floor(turns / 8));
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

/** Passa a vez para o próximo jogador vivo e sorteia nova sílaba. */
function advance(room: BombRoom, now: number, syllables: readonly string[], rng: () => number): BombRoom {
  const alive = aliveOf(room);
  if (alive.length <= 1) {
    return { ...room, status: 'finished', winnerUid: alive[0] };
  }
  const nextIdx = nextAliveIndex(room, room.turn);
  return {
    ...room,
    turn: nextIdx,
    syllable: pick(syllables, rng),
    deadline: now + turnSeconds(room.turns) * 1000,
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
    order.map((uid) => [uid, { ...room.players[uid], lives: START_LIVES }]),
  );
  return {
    ...room,
    status: 'playing',
    players,
    order,
    turn: 0,
    turns: 0,
    syllable: pick(syllables, rng),
    deadline: now + turnSeconds(0) * 1000,
    used: {},
    winnerUid: undefined,
    event: { text: `Começou! Vez de ${players[order[0]].name}.`, ts: now },
  };
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

  const name = room.players[uid]?.name ?? '?';
  const next: BombRoom = {
    ...room,
    used: { ...room.used, [word]: true },
    turns: room.turns + 1,
    event: { text: `${name} disse ${word}.`, ts: now },
  };
  return advance(next, now, syllables, rng);
}

/** Tempo esgotado: o jogador da vez perde uma vida. */
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
    players: { ...room.players, [uid]: { ...player, lives } },
    turns: room.turns + 1,
    event: { text, ts: now },
  };
  return advance(next, now, syllables, rng);
}
