import { limitToLast, onValue, orderByChild, query, ref, runTransaction } from 'firebase/database';
import { db } from '../firebase';

export interface RankingEntry {
  uid: string;
  name: string;
  points: number;
  games: number;
}

/** Soma pontos ao ranking global da plataforma. As regras só deixam cada um escrever no próprio uid. */
export async function addRankingPoints(uid: string, name: string, points: number): Promise<void> {
  await runTransaction(ref(db, `ranking/${uid}`), (current) => {
    const prev = (current as RankingEntry | null) ?? { uid, name, points: 0, games: 0 };
    return { uid, name, points: (prev.points ?? 0) + points, games: (prev.games ?? 0) + 1 };
  });
}

/** Top do ranking global, em tempo real (maior pontuação primeiro). */
export function subscribeRanking(callback: (entries: RankingEntry[]) => void, limit = 20) {
  return onValue(query(ref(db, 'ranking'), orderByChild('points'), limitToLast(limit)), (snap) => {
    const list: RankingEntry[] = [];
    snap.forEach((child) => {
      list.push({ uid: child.key ?? '', ...child.val() } as RankingEntry);
    });
    callback(list.sort((a, b) => b.points - a.points));
  });
}
