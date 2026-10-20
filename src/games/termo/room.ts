import { get, onValue, ref, runTransaction } from 'firebase/database';
import { db, ensureSignedIn } from '../../firebase';
import { randomCode, keepPresence, cleanupOldRooms, cleanForRtdb, SIX_HOURS } from '../../lib/rooms';
import { serverNow } from '../../lib/time';
import { applyGuess, applyNewRound, clampSettings, normalizeTermoRoom, type TermoRoom, type TermoSettings } from './state';

const BASE = 'termo/rooms';

/** Aplica uma regra pura numa transação. null da regra = nada muda. */
function mutate(code: string, rule: (room: TermoRoom) => TermoRoom | null) {
  return runTransaction(ref(db, `${BASE}/${code}`), (raw) => {
    if (raw === null) return null; // sem cache local: o servidor devolve o valor real
    const next = rule(normalizeTermoRoom(raw));
    return next ? cleanForRtdb(next) : undefined;
  });
}

export async function createTermoRoom(name: string, settings: TermoSettings): Promise<string> {
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
        players: { [user.uid]: { name, solved: false, guesses: [], score: 0 } },
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

export async function joinTermoRoom(code: string, name: string): Promise<void> {
  const user = await ensureSignedIn();
  const snap = await get(ref(db, `${BASE}/${code}`));
  if (!snap.exists()) throw new Error('Sala não encontrada. Confira o código.');
  const room = normalizeTermoRoom(snap.val());
  const existing = room.players[user.uid];
  await mutate(code, (r) => ({
    ...r,
    players: {
      ...r.players,
      [user.uid]: existing ? { ...existing, name } : { name, solved: false, guesses: [], score: 0 },
    },
  }));
  keepPresence(BASE, code, user.uid);
}

export function subscribeTermoRoom(code: string, callback: (room: TermoRoom | null) => void) {
  return onValue(ref(db, `${BASE}/${code}`), (snap) => {
    callback(snap.exists() ? normalizeTermoRoom(snap.val()) : null);
  });
}

export function startTermoRound(code: string, targets: readonly string[]) {
  return mutate(code, (room) => applyNewRound(room, targets));
}

export function sendTermoGuess(code: string, uid: string, guess: string, dictionary: ReadonlySet<string>) {
  return mutate(code, (room) => applyGuess(room, uid, guess, dictionary));
}

/** Só o host muda as configurações, e só no lobby (entre partidas). */
export function updateTermoSettings(code: string, settings: TermoSettings) {
  return mutate(code, (room) => (room.status === 'lobby' ? { ...room, settings: clampSettings(settings) } : null));
}
