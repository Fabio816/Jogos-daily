import { describe, expect, it } from 'vitest';
import { isCorrectGuess, levenshtein, normalize } from './answer';
import { pointsFor, MAX_POINTS, MIN_POINTS } from './scoring';

describe('normalize', () => {
  it('remove acento, caixa e pontuação', () => {
    expect(normalize('  Pokémon: Lendas!  ')).toBe('pokemon lendas');
  });
});

describe('levenshtein', () => {
  it('calcula distância corretamente', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
});

describe('isCorrectGuess', () => {
  const answers = ['O Poderoso Chefão', 'The Godfather'];

  it('aceita variações de caixa, acento e artigo', () => {
    expect(isCorrectGuess('poderoso chefão', answers)).toBe(true);
    expect(isCorrectGuess('PODEROSO CHEFAO', answers)).toBe(true);
    expect(isCorrectGuess('o poderoso chefao', answers)).toBe(true);
  });

  it('aceita qualquer alias da lista', () => {
    expect(isCorrectGuess('the godfather', answers)).toBe(true);
    expect(isCorrectGuess('godfather', answers)).toBe(true);
  });

  it('tolera um erro de digitação em respostas longas', () => {
    expect(isCorrectGuess('poderoso chefao', answers)).toBe(true);
    expect(isCorrectGuess('poderozo chefao', answers)).toBe(true);
  });

  it('não aceita erro de digitação em respostas curtas', () => {
    expect(isCorrectGuess('rb', ['Ra'])).toBe(false);
    expect(isCorrectGuess('ro', ['Ra'])).toBe(false);
  });

  it('rejeita respostas erradas e vazias', () => {
    expect(isCorrectGuess('vingadores', answers)).toBe(false);
    expect(isCorrectGuess('   ', answers)).toBe(false);
  });
});

describe('pointsFor', () => {
  it('dá pontuação máxima para resposta imediata', () => {
    expect(pointsFor(0, 20000)).toBe(MAX_POINTS);
  });

  it('dá pontuação mínima no último instante', () => {
    expect(pointsFor(20000, 20000)).toBe(MIN_POINTS);
  });

  it('nunca sai do intervalo', () => {
    expect(pointsFor(-5, 20000)).toBe(MAX_POINTS);
    expect(pointsFor(99999, 20000)).toBe(MIN_POINTS);
  });

  it('diminui conforme o tempo passa', () => {
    expect(pointsFor(5000, 20000)).toBeGreaterThan(pointsFor(10000, 20000));
  });
});
