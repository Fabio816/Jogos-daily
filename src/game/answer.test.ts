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

  it('equipara & e e', () => {
    expect(isCorrectGuess('Lei e Ordem', ['Lei & Ordem'])).toBe(true);
  });

  it('rejeita respostas erradas e vazias', () => {
    expect(isCorrectGuess('vingadores', answers)).toBe(false);
    expect(isCorrectGuess('   ', answers)).toBe(false);
  });
});

describe('isCorrectGuess com título principal', () => {
  const harry = ['Harry Potter e a Pedra Filosofal', "Harry Potter and the Sorcerer's Stone"];

  it('aceita apenas o título principal', () => {
    expect(isCorrectGuess('Harry Potter', harry, { titleAliases: true })).toBe(true);
    expect(isCorrectGuess('harry potter', harry, { titleAliases: true })).toBe(true);
    expect(isCorrectGuess('Hary Potter', harry, { titleAliases: true })).toBe(true);
  });

  it('mantém o título completo válido', () => {
    expect(isCorrectGuess('Harry Potter e a Pedra Filosofal', harry, { titleAliases: true })).toBe(true);
  });

  it('exige a opção para aceitar título parcial', () => {
    expect(isCorrectGuess('Harry Potter', harry)).toBe(false);
  });

  it('aceita o título antes de dois-pontos', () => {
    expect(isCorrectGuess('Vingadores', ['Vingadores: Ultimato'], { titleAliases: true })).toBe(true);
    expect(isCorrectGuess('O Senhor dos Anéis', ['O Senhor dos Anéis: O Retorno do Rei'], { titleAliases: true })).toBe(true);
  });

  it('normaliza & dentro do título principal', () => {
    expect(isCorrectGuess('Dungeons e Dragons', ['Dungeons & Dragons: Honra Entre Ladrões'], { titleAliases: true })).toBe(true);
  });

  it('não aceita base curta de conjunção', () => {
    expect(isCorrectGuess('Rick', ['Rick e Morty'], { titleAliases: true })).toBe(false);
  });

  it('aceita o título base antes de temporada, parte ou ano', () => {
    expect(isCorrectGuess('Attack on Titan', ['Attack on Titan Season 2'], { titleAliases: true })).toBe(true);
    expect(isCorrectGuess('The Last of Us', ['The Last of Us Part II'], { titleAliases: true })).toBe(true);
    expect(isCorrectGuess('Hunter x Hunter', ['Hunter x Hunter (2011)'], { titleAliases: true })).toBe(true);
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
