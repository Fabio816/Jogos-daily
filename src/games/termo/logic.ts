export const WORD_LEN = 5;
export const MAX_TRIES = 6;

export type Mark = 'correct' | 'present' | 'absent';

/** Minúsculas, sem acento, só a-z. Palavras digitadas com "ç" ou acento continuam válidas. */
export function normalizeWord(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * Compara o palpite com a palavra secreta, letra a letra.
 * Letras repetidas: cada letra da palavra secreta só "vale" uma vez, como no jogo original.
 */
export function evaluate(guess: string, target: string): Mark[] {
  const marks: Mark[] = Array.from({ length: WORD_LEN }, () => 'absent');
  const pending: Record<string, number> = {};

  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      marks[i] = 'correct';
    } else {
      pending[target[i]] = (pending[target[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] === 'correct') continue;
    const letter = guess[i];
    if ((pending[letter] ?? 0) > 0) {
      marks[i] = 'present';
      pending[letter]--;
    }
  }
  return marks;
}

export function isValidGuess(word: string, dictionary: ReadonlySet<string>): boolean {
  return word.length === WORD_LEN && dictionary.has(word);
}

/** Escolhe uma palavra secreta que ainda não foi usada. Undefined quando o banco esgotou. */
export function pickTarget(
  targets: readonly string[],
  used: ReadonlySet<string>,
  rng: () => number = Math.random,
): string | undefined {
  const available = targets.filter((w) => !used.has(w));
  if (available.length === 0) return undefined;
  return available[Math.floor(rng() * available.length)];
}

export const MIN_TRIES = 3;
export const MIN_WORDS = 1;
export const MAX_WORDS = 10;

/** Modos de tabuleiro: 1 (simples), 2 (dueto), 4 (quarteto), 5 (quinteto), 6 (sexteto). */
export const BOARD_OPTIONS = [1, 2, 4, 5, 6] as const;
export const BOARD_LABEL: Record<number, string> = {
  1: 'Simples',
  2: 'Dueto',
  4: 'Quarteto',
  5: 'Quinteto',
  6: 'Sexteto',
};

/** Mais tabuleiros, mais tentativas: 5 + número de tabuleiros (simples = 6, quarteto = 9). */
export function maxTriesFor(boards: number): number {
  return 5 + boards;
}

export function normalizeBoards(value: number): number {
  return BOARD_OPTIONS.reduce((best, b) => (Math.abs(b - value) < Math.abs(best - value) ? b : best), 1);
}

export function clampTries(value: number, boards: number): number {
  return Math.min(maxTriesFor(boards), Math.max(MIN_TRIES, Math.round(value)));
}

/** Pontos por acerto: 10 pontos a menos por tentativa usada (1 tentativa = o máximo). Ver também o multiplicador por tabuleiro em state.ts. */
export function pointsFor(attempts: number, tries: number = MAX_TRIES): number {
  if (attempts < 1 || attempts > tries) return 0;
  return (tries + 1 - attempts) * 10;
}

export function isSolved(guess: string, target: string): boolean {
  return guess === target;
}
