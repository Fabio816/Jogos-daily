import { initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(config);

/**
 * Em desenvolvimento cada aba tem a própria sessão anônima, para testar salas
 * com vários jogadores no mesmo navegador. Em produção a sessão continua salva
 * no navegador (a mesma pessoa em qualquer aba).
 */
function createAuth(): Auth {
  if (!import.meta.env.DEV) return getAuth(app);
  try {
    return initializeAuth(app, { persistence: browserSessionPersistence });
  } catch {
    // HMR: o Auth já foi inicializado nesta página.
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getDatabase(app);

let signingIn: Promise<User> | null = null;

/**
 * Entra anonimamente (sem conta) e devolve o usuário. Reutiliza a sessão se já existir.
 * Chamadas simultâneas compartilham a mesma promessa: sem isso, cada uma podia criar um
 * usuário anônimo novo, e o host de uma sala não batia com o uid da tela.
 */
export function ensureSignedIn(): Promise<User> {
  signingIn ??= new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        unsubscribe();
        if (user) return resolve(user);
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (err) {
          reject(err);
        }
      },
      reject,
    );
  }).finally(() => {
    signingIn = null;
  });
  return signingIn;
}
