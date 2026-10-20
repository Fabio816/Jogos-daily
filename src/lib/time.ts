import { onValue, ref } from 'firebase/database';
import { db } from '../firebase';

// Diferença entre o relógio deste aparelho e o do servidor Firebase.
let serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
  serverOffset = (snap.val() as number | null) ?? 0;
});

/** Hora atual aproximada do servidor (ms). Usada para cronômetros e prazos. */
export const serverNow = () => Date.now() + serverOffset;
