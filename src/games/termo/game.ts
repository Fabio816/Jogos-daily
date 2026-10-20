import { evaluate, isValidGuess, type Mark } from './logic';

/**
 * Uma partida de tabuleiros: todas as palavras são resolvidas com os mesmos palpites.
 * Vence quem acerta todas as palavras antes de acabar as tentativas.
 */
export interface GameState {
  words: string[];
  guesses: string[];
  tries: number;
}

export function solvedBoards(g: GameState): boolean[] {
  return g.words.map((w) => g.guesses.includes(w));
}

export function isWon(g: GameState): boolean {
  return g.words.length > 0 && g.words.every((w) => g.guesses.includes(w));
}

export function isLost(g: GameState): boolean {
  return !isWon(g) && g.guesses.length >= g.tries;
}

/** Registra um palpite. Retorna null se a partida acabou ou o palpite não é aceito. */
export function applyGame(g: GameState, guess: string, dictionary: ReadonlySet<string>): GameState | null {
  if (isWon(g) || isLost(g)) return null;
  if (!isValidGuess(guess, dictionary)) return null;
  return { ...g, guesses: [...g.guesses, guess] };
}

/** Marcas de um palpite em cada tabuleiro (uma lista de letras por tabuleiro). */
export function marksPerBoard(guess: string, words: readonly string[]): Mark[][] {
  return words.map((w) => evaluate(guess, w));
}
