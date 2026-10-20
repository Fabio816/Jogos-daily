import { get, onDisconnect, onValue, orderByChild, endAt, limitToFirst, query, ref, set, update } from 'firebase/database';
import { db } from '../firebase';
import { serverNow } from './time';

// Sem I, O, 0 e 1 para não confundir na hora de ditar o código.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

/** Marca o jogador como online em `${base}/${code}/players/${uid}` e volta a marcar após reconexão. */
export function keepPresence(base: string, code: string, uid: string): () => void {
  const connRef = ref(db, `${base}/${code}/players/${uid}/connected`);
  return onValue(ref(db, '.info/connected'), async (snap) => {
    if (snap.val() !== true) return;
    await onDisconnect(connRef).set(false);
    await set(connRef, true);
  });
}

/**
 * Apaga salas com `createdAt` mais antigo que `ttlMs` (até 20 por vez).
 * Depende do índice `createdAt` nas regras do banco.
 */
export async function cleanupOldRooms(base: string, ttlMs: number): Promise<void> {
  const cutoff = serverNow() - ttlMs;
  const snap = await get(query(ref(db, base), orderByChild('createdAt'), endAt(cutoff), limitToFirst(20)));
  const removals: Record<string, null> = {};
  snap.forEach((child) => {
    removals[`${base}/${child.key}`] = null;
  });
  if (Object.keys(removals).length > 0) await update(ref(db), removals);
}

export const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Remove chaves `undefined`: o Realtime Database recusa transações com esses valores. */
export function cleanForRtdb<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
