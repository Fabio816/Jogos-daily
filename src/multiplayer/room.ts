import {
  endAt,
  get,
  limitToFirst,
  limitToLast,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import { db, ensureSignedIn } from '../firebase';
import { cleanForRtdb } from '../lib/rooms';
import { buildPool, type RoomSettings } from '../game/catalog';
import {
  applyAdvance,
  applyClaim,
  applyStart,
  normalizeRoom,
  type RoomState,
} from './state';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1 para evitar confusão

import { serverNow } from '../lib/time';
export { serverNow };

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** Marca o jogador como online e volta a marcar após reconexões. */
export function keepPresence(code: string, uid: string): () => void {
  const connRef = ref(db, `rooms/${code}/players/${uid}/connected`);
  return onValue(ref(db, '.info/connected'), async (snap) => {
    if (snap.val() !== true) return;
    await onDisconnect(connRef).set(false);
    await set(connRef, true);
  });
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // salas com mais de 6 horas são apagadas
const CLEANUP_BATCH = 20;

/**
 * Apaga salas antigas (até CLEANUP_BATCH por vez). Usa o índice `createdAt` das regras;
 * sem ele o Firebase baixaria todas as salas para filtrar.
 */
async function cleanupOldRooms(): Promise<void> {
  const cutoff = serverNow() - ROOM_TTL_MS;
  const snap = await get(query(ref(db, 'rooms'), orderByChild('createdAt'), endAt(cutoff), limitToFirst(CLEANUP_BATCH)));
  const removals: Record<string, null> = {};
  snap.forEach((child) => {
    removals[`rooms/${child.key}`] = null;
  });
  if (Object.keys(removals).length > 0) await update(ref(db), removals);
}

export async function createRoom(name: string, settings: RoomSettings): Promise<string> {
  const user = await ensureSignedIn();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await runTransaction(ref(db, `rooms/${code}`), (current) => {
      if (current !== null) return undefined; // código já usado: aborta
      return {
        hostUid: user.uid,
        status: 'lobby',
        settings,
        createdAt: serverNow(),
        players: { [user.uid]: { name, score: 0, connected: true } },
      };
    });
    if (result.committed) {
      keepPresence(code, user.uid);
      cleanupOldRooms().catch(() => {}); // em segundo plano: não atrasa a criação da sala
      return code;
    }
  }
  throw new Error('Não consegui criar a sala. Tente de novo.');
}

export async function joinRoom(code: string, name: string): Promise<void> {
  const user = await ensureSignedIn();
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) throw new Error('Sala não encontrada. Confira o código.');

  const room = normalizeRoom(snap.val());
  const existing = room.players[user.uid];
  if (!existing && room.status !== 'lobby') {
    throw new Error('A partida já começou. Peça para o host criar outra sala.');
  }

  await set(ref(db, `rooms/${code}/players/${user.uid}`), {
    name,
    score: existing?.score ?? 0,
    connected: true,
  });
  keepPresence(code, user.uid);
}

export function subscribeRoom(code: string, callback: (room: RoomState | null) => void) {
  return onValue(ref(db, `rooms/${code}`), (snap) => {
    callback(snap.exists() ? normalizeRoom(snap.val()) : null);
  });
}

/**
 * Aplica uma regra pura dentro de uma transação. Se a regra retornar null,
 * a transação é abortada e nada muda no banco.
 */
function mutateRoom(code: string, rule: (room: RoomState) => RoomState | null) {
  return runTransaction(ref(db, `rooms/${code}`), (raw) => {
    // Sem cache local o SDK chama com null primeiro. Devolver null faz o servidor
    // comparar com o valor real e refazer a transação; devolver undefined abortaria.
    if (raw === null) return null;
    const next = rule(normalizeRoom(raw));
    return next ? cleanForRtdb(next) : undefined;
  });
}

export function startGame(code: string) {
  return mutateRoom(code, applyStart);
}

/** Qualquer jogador pode chamar; a transação garante que só uma chamada faz a mudança. */
export function tickRoom(code: string) {
  return mutateRoom(code, (room) => applyAdvance(room, serverNow(), buildPool(room.settings)));
}

/** Registra o acerto do jogador. `committed` indica se ele foi o primeiro. */
export function claimRound(code: string, uid: string) {
  return mutateRoom(code, (room) => applyClaim(room, uid, serverNow()));
}

/** Só o host deve chamar (a regra de segurança no banco vai impor isso depois). */
export async function updateSettings(code: string, settings: RoomSettings): Promise<void> {
  await update(ref(db, `rooms/${code}/settings`), settings);
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  /** 'chat': mensagem livre. 'guess': tentativa errada de resposta (visível para a sala). */
  kind: 'chat' | 'guess';
  ts: number;
}

const MAX_MESSAGES = 50;
const MAX_TEXT = 200;

/** Acompanha as últimas mensagens da sala (chat e tentativas). */
export function subscribeMessages(code: string, callback: (messages: ChatMessage[]) => void) {
  return onValue(query(ref(db, `rooms/${code}/messages`), limitToLast(MAX_MESSAGES)), (snap) => {
    const list: ChatMessage[] = [];
    snap.forEach((child) => {
      list.push({ id: child.key ?? '', ...child.val() } as ChatMessage);
    });
    callback(list);
  });
}

/** Envia uma mensagem. Tentativas erradas usam kind 'guess'; nunca envie acertos com o texto. */
export async function sendMessage(code: string, uid: string, name: string, text: string, kind: 'chat' | 'guess') {
  const clean = text.trim().slice(0, MAX_TEXT);
  if (!clean) return;
  await push(ref(db, `rooms/${code}/messages`), {
    uid,
    name,
    text: clean,
    kind,
    ts: serverNow(),
  });
}
