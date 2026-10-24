// Teste de fumaça do Firebase: login anônimo, sala, duas disputas simultâneas e limpeza.
// Uso: node --env-file=.env scripts/smoke-rtdb.mjs
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, runTransaction, set, get, remove, push, query, limitToLast } from 'firebase/database';

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getDatabase(app);

const code = 'TEST' + Math.floor(Math.random() * 1000);
const roomRef = ref(db, `rooms/${code}`);

try {
  const host = await signInAnonymously(auth);
  console.log('1. login anônimo OK, uid:', host.user.uid.slice(0, 8) + '...');

  await set(roomRef, {
    hostUid: host.user.uid,
    status: 'playing',
    settings: { targetPoints: 100, durationSec: 20, types: ['movie'], difficultyMix: { easy: 30, medium: 40, hard: 30 }, mix: { capa: 40, 'capa-clara': 20, emoji: 8, frase: 7, ator: 15, personagem: 10 } },
    players: { a: { name: 'A', score: 0, connected: true }, b: { name: 'B', score: 0, connected: true } },
    round: { n: 1, qid: 'x', startedAt: Date.now(), durationMs: 20000, status: 'clue' },
  });
  console.log('2. sala criada');

  // Duas disputas simultâneas pela mesma rodada: só uma pode ganhar.
  const claim = (who) =>
    runTransaction(roomRef, (raw) => {
      if (raw === null) return null; // sem cache local: deixa o servidor informar o valor real
      if (raw.round?.status !== 'clue') return undefined;
      raw.round = { ...raw.round, status: 'reveal', winnerUid: who };
      return raw;
    });
  const results = await Promise.all([claim('a'), claim('b')]);
  const committed = results.filter((r) => r.committed).length;
  console.log('3. disputa simultânea: transações confirmadas =', committed, '(esperado 1)');

  // Chat: envia uma mensagem e lê de volta com a mesma consulta usada na interface.
  await push(ref(db, `rooms/${code}/messages`), { uid: host.user.uid, name: 'teste', text: 'oi', kind: 'chat', ts: Date.now() });
  const msgs = await get(query(ref(db, `rooms/${code}/messages`), limitToLast(10)));
  console.log('4. chat: mensagens lidas =', msgs.size, '(esperado >= 1)');
  if (msgs.size < 1) throw new Error('Chat não gravou/lê mensagens');

  const final = (await get(roomRef)).val();
  console.log('   vencedor gravado:', final.round.winnerUid);
  if (committed !== 1) throw new Error('Mais de um vencedor — transações não estão atômicas');
  console.log('RESULTADO: OK');
} catch (err) {
  console.error('FALHOU:', err.message);
  process.exitCode = 1;
} finally {
  await remove(roomRef).catch(() => {});
  await deleteApp(app);
  console.log('sala de teste apagada');
}
