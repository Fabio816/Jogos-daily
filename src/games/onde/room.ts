import { get, onValue, ref, runTransaction } from 'firebase/database';
import { db, ensureSignedIn } from '../../firebase';
import { randomCode, keepPresence, cleanupOldRooms, cleanForRtdb, SIX_HOURS } from '../../lib/rooms';
import { serverNow } from '../../lib/time';
import type { Cell } from './geo';
import {
  applyGuess,
  applyStartRound,
  applyTick,
  clampSettings,
  normalizeOndeRoom,
  type OndeRoom,
  type OndeSettings,
  type Pick,
} from './state';

const BASE = 'onde/rooms';

function mutate(code: string, rule: (room: OndeRoom) => OndeRoom | null) {
  return runTransaction(ref(db, `${BASE}/${code}`), (raw) => {
    if (raw === null) return null; // sem cache local: o servidor devolve o valor real
    // Remove undefined (o banco não aceita) mantendo o resto.
    const next = rule(normalizeOndeRoom(raw));
    return next ? cleanForRtdb(next) : undefined;
  });
}

export async function createOndeRoom(name: string, settings: OndeSettings): Promise<string> {
  const user = await ensureSignedIn();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await runTransaction(ref(db, `${BASE}/${code}`), (current) => {
      if (current !== null) return undefined;
      return {
        hostUid: user.uid,
        status: 'lobby',
        createdAt: serverNow(),
        settings: clampSettings(settings),
        players: { [user.uid]: { name, score: 0, joinedAt: serverNow() } },
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

export async function joinOndeRoom(code: string, name: string): Promise<void> {
  const user = await ensureSignedIn();
  const snap = await get(ref(db, `${BASE}/${code}`));
  if (!snap.exists()) throw new Error('Sala não encontrada. Confira o código.');
  const room = normalizeOndeRoom(snap.val());
  const existing = room.players[user.uid];
  if (!existing && room.status !== 'lobby') throw new Error('A partida já começou.');
  await mutate(code, (r) => ({
    ...r,
    players: {
      ...r.players,
      [user.uid]: existing ? { ...existing, name } : { name, score: 0, joinedAt: serverNow() },
    },
  }));
  keepPresence(BASE, code, user.uid);
}

export function subscribeOndeRoom(code: string, callback: (room: OndeRoom | null) => void) {
  return onValue(ref(db, `${BASE}/${code}`), (snap) => {
    callback(snap.exists() ? normalizeOndeRoom(snap.val()) : null);
  });
}

export function updateOndeSettings(code: string, settings: OndeSettings) {
  return mutate(code, (room) => (room.status === 'lobby' ? { ...room, settings: clampSettings(settings) } : null));
}

/** O host escolhe a foto antes (chamada de rede) e depois registra a rodada na sala. */
export function startOndeRound(code: string, pick: Pick) {
  return mutate(code, (room) => applyStartRound(room, pick, serverNow()));
}

export function guessOnde(code: string, uid: string, cell: Cell) {
  return mutate(code, (room) => applyGuess(room, uid, cell, serverNow()));
}

/** Qualquer jogador pode chamar quando o tempo acabou; a transação garante que só uma chamada aplica. */
export function tickOnde(code: string) {
  return mutate(code, (room) => applyTick(room, serverNow()));
}
