import { describe, expect, it } from 'vitest';
import { evaluate, isValidGuess, normalizeWord, pickTarget, pointsFor } from './logic';

describe('normalizeWord', () => {
  it('remove acento e caixa, mantém só letras', () => {
    expect(normalizeWord('Pássaro')).toBe('passaro');
    expect(normalizeWord('AÇÃO!')).toBe('acao');
  });
});

describe('evaluate', () => {
  it('marca certo, presente e ausente', () => {
    expect(evaluate('caixa', 'cacho')).toEqual(['correct', 'correct', 'absent', 'absent', 'absent']);
    expect(evaluate('gatos', 'tosco')).toEqual(['absent', 'absent', 'present', 'present', 'present']);
  });

  it('acerto total', () => {
    expect(evaluate('fazer', 'fazer')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('letra repetida no palpite não marca mais do que existe na palavra', () => {
    // palavra "termo" tem um só "o" (última posição): palpite "ooooo" marca só essa posição
    const marks = evaluate('ooooo', 'termo');
    expect(marks.filter((m) => m !== 'absent').length).toBe(1);
    expect(marks[4]).toBe('correct');
  });

  it('letra repetida na palavra: palpite com duas cópias marca as duas', () => {
    expect(evaluate('abbaa', 'abbcd')).toEqual(['correct', 'correct', 'correct', 'absent', 'absent']);
    expect(evaluate('ababa', 'bbbba')).toEqual(['absent', 'correct', 'absent', 'correct', 'correct']);
  });
});

describe('isValidGuess', () => {
  const dict = new Set(['fazer', 'gatos']);
  it('aceita palavra de 5 letras do dicionário', () => {
    expect(isValidGuess('fazer', dict)).toBe(true);
  });
  it('rejeita tamanho errado ou palavra fora do dicionário', () => {
    expect(isValidGuess('fazen', dict)).toBe(false);
    expect(isValidGuess('fazeres', dict)).toBe(false);
    expect(isValidGuess('zzzzz', dict)).toBe(false);
  });
});

describe('pickTarget', () => {
  const targets = ['aaaaa', 'bbbbb', 'ccccc'];
  it('nunca repete uma palavra já usada', () => {
    expect(pickTarget(targets, new Set(['aaaaa', 'bbbbb']), () => 0)).toBe('ccccc');
  });
  it('retorna undefined quando esgota', () => {
    expect(pickTarget(targets, new Set(targets))).toBeUndefined();
  });
});

describe('pointsFor', () => {
  it('quanto menos tentativas, mais pontos', () => {
    expect(pointsFor(1)).toBe(60);
    expect(pointsFor(6)).toBe(10);
    expect(pointsFor(7)).toBe(0);
    expect(pointsFor(0)).toBe(0);
  });

  it('respeita o número de tentativas configurado', () => {
    expect(pointsFor(1, 3)).toBe(30);
    expect(pointsFor(3, 3)).toBe(10);
    expect(pointsFor(4, 3)).toBe(0);
  });
});
