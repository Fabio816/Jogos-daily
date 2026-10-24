import { get, onValue, ref, runTransaction, set } from 'firebase/database';
import { db, ensureSignedIn } from '../../firebase';
import { randomCode, keepPresence, cleanupOldRooms, cleanForRtdb, SIX_HOURS } from '../../lib/rooms';
import { serverNow } from '../../lib/time';
import {
  applySettings,
  applyStart,
  applySubmit,
  applyTimeout,
  type BombRoom,
  type BombSay,
  type BombTyping,
} from './logic';

const BASE = 'bomb/rooms';

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (value && typeof value === 'object') return Object.values(value) as string[];
  return [];
}

/** Completa a forma do objeto vindo do Realtime Database (que omite listas vazias). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeBombRoom(raw: any): BombRoom {
  const players: BombRoom['players'] = {};
  for (const [uid, p] of Object.entries<any>(raw.players ?? {})) { // eslint-disable-line @typescript-eslint/no-explicit-any
    players[uid] = {
      name: p.name ?? '?',
      lives: p.lives ?? 0,
      joinedAt: p.joinedAt ?? 0,
      connected: p.connected !== false,
      streak: p.streak ?? 0,
    };
  }
  return {
    hostUid: raw.hostUid,
    status: raw.status ?? 'lobby',
    players,
    order: toArray(raw.order),
    turn: raw.turn ?? 0,
    turns: raw.turns ?? 0,
    syllable: raw.syllable ?? '',
    deadline: raw.deadline ?? 0,
    turnMs: raw.turnMs ?? undefined,
    used: raw.used ?? {},
    settings: { accel: raw.settings?.accel ?? 0 },
    typing: raw.typing ? { uid: raw.typing.uid, text: raw.typing.text ?? '', turn: raw.typing.turn ?? 0 } : undefined,
    say: raw.say ? { uid: raw.say.uid, text: raw.say.text ?? '', ok: raw.say.ok !== false, ts: raw.say.ts ?? 0 } : undefined,
    winnerUid: raw.winnerUid ?? undefined,
    event: raw.event ?? undefined,
  };
}

function mutate(code: string, rule: (room: BombRoom) => BombRoom | null) {
  return runTransaction(ref(db, `${BASE}/${code}`), (raw) => {
    if (raw === null) return null;
    const next = rule(normalizeBombRoom(raw));
    return next ? cleanForRtdb(next) : undefined;
  });
}

export async function createBombRoom(name: string): Promise<string> {
  const user = await ensureSignedIn();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await runTransaction(ref(db, `${BASE}/${code}`), (current) => {
      if (current !== null) return undefined;
      return {
        hostUid: user.uid,
        status: 'lobby',
        createdAt: serverNow(),
        settings: { accel: 0 },
        players: { [user.uid]: { name, lives: 0, joinedAt: serverNow() } },
      };
    });
    if (result.committed) {
      keepPresence(BASE, code, user.uid);
      cleanupOldRooms(BASE, SIX_HOURS).catch(() => {});
      return code;
    }
  }
  throw new Error('Não consegui criar a sala. Tente de novo.');
}

export async function joinBombRoom(code: string, name: string): Promise<void> {
  const user = await ensureSignedIn();
  const snap = await get(ref(db, `${BASE}/${code}`));
  if (!snap.exists()) throw new Error('Sala não encontrada. Confira o código.');
  const room = normalizeBombRoom(snap.val());
  const existing = room.players[user.uid];
  if (!existing && room.status !== 'lobby') throw new Error('A partida já começou.');
  await mutate(code, (r) => ({
    ...r,
    players: {
      ...r.players,
      [user.uid]: existing ? { ...existing, name } : { name, lives: 0, joinedAt: serverNow() },
    },
  }));
  keepPresence(BASE, code, user.uid);
}

export function subscribeBombRoom(code: string, callback: (room: BombRoom | null) => void) {
  return onValue(ref(db, `${BASE}/${code}`), (snap) => {
    callback(snap.exists() ? normalizeBombRoom(snap.val()) : null);
  });
}

export function startBomb(code: string, syllables: readonly string[]) {
  return mutate(code, (room) => applyStart(room, syllables, serverNow()));
}

export function submitBombWord(
  code: string,
  uid: string,
  word: string,
  valid: boolean,
  syllables: readonly string[],
) {
  return mutate(code, (room) => applySubmit(room, uid, word, valid, serverNow(), syllables));
}

/** Qualquer jogador pode chamar quando o prazo venceu; a transação garante que só uma chamada aplica. */
export function expireBombTurn(code: string, syllables: readonly string[]) {
  return mutate(code, (room) => applyTimeout(room, serverNow(), syllables));
}

/** Aceleração por acerto seguido. Só o host, e só fora de partida. */
export function updateBombSettings(code: string, uid: string, accel: number) {
  return mutate(code, (room) => applySettings(room, uid, accel));
}

/** Texto digitado pelo jogador da vez (null apaga). Escrita direta: não reescreve a sala inteira. */
export function setBombTyping(code: string, typing: BombTyping | null) {
  return set(ref(db, `${BASE}/${code}/typing`), typing);
}

/** Última tentativa (certa ou errada) para aparecer no balão do jogador. */
export function setBombSay(code: string, say: BombSay) {
  return set(ref(db, `${BASE}/${code}/say`), say);
}
