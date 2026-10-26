export const GATE_KEY = 'qeo:gate';

const PASSWORD = 'beatles';

/** Porteira simples: guarda a liberação no navegador. Não é segurança de verdade. */
export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(GATE_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlock(password: string): boolean {
  if (password.trim().toLowerCase() !== PASSWORD) return false;
  try {
    localStorage.setItem(GATE_KEY, '1');
  } catch {
    // modo privado sem localStorage: segue liberado só nesta navegação
  }
  return true;
}

/** Atalho de dev: ?devgate=1 libera o navegador de teste. Em produção não faz nada. */
export function unlockFromQuery(): boolean {
  if (!import.meta.env.DEV) return false;
  if (!new URLSearchParams(location.search).has('devgate')) return false;
  return unlock(PASSWORD);
}
