import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
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
export const auth = getAuth(app);
export const db = getDatabase(app);

/** Entra anonimamente (sem conta) e devolve o usuário. Reutiliza a sessão se já existir. */
export function ensureSignedIn(): Promise<User> {
  return new Promise((resolve, reject) => {
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
  });
}
