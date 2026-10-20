import { describe, expect, it } from 'vitest';
import type { Question } from '../data/questions';
import { DEFAULT_MIX, eligibleGroups, pickRound, type Mix } from './mix';

const text: Question = { id: 't', type: 'movie', difficulty: 'mainstream', clueType: 'emoji', clue: '🚢', answers: ['Titanic'] };
const image: Question = { id: 'i', type: 'movie', difficulty: 'mainstream', clueType: 'image', clue: '', answers: ['Titanic'], imageUrl: 'x.jpg' };
const actor: Question = { id: 'a', kind: 'actor', type: 'movie', difficulty: 'mainstream', clueType: 'character', clue: 'Jack', answers: ['DiCaprio'], imageUrl: 'x.jpg' };
const character: Question = { id: 'p', kind: 'character', type: 'movie', difficulty: 'mainstream', clueType: 'actor', clue: 'DiCaprio', answers: ['Jack'], imageUrl: 'x.jpg' };
const pool = [text, image, actor, character];

const only = (g: keyof Mix): Mix => ({ capa: 0, 'capa-clara': 0, texto: 0, ator: 0, personagem: 0, [g]: 100 });

describe('eligibleGroups', () => {
  it('cada tipo de pergunta cai no grupo certo', () => {
    expect(eligibleGroups(text)).toEqual(['texto']);
    expect(eligibleGroups(image)).toEqual(['capa', 'capa-clara']);
    expect(eligibleGroups(actor)).toEqual(['ator']);
    expect(eligibleGroups(character)).toEqual(['personagem']);
  });
});

describe('pickRound', () => {
  it('respeita mix com um único grupo', () => {
    expect(pickRound(pool, new Set(), only('ator'), () => 0.5)?.question.id).toBe('a');
    expect(pickRound(pool, new Set(), only('texto'), () => 0.5)?.question.id).toBe('t');
  });

  it('capa desfocada marca blur; capa nítida não', () => {
    expect(pickRound([image], new Set(), only('capa'))?.blur).toBe(true);
    expect(pickRound([image], new Set(), only('capa-clara'))?.blur).toBe(false);
  });

  it('nunca repete pergunta já usada', () => {
    const used = new Set(['a', 'p', 't']);
    expect(pickRound(pool, used, only('ator'))).toBeUndefined();
    expect(pickRound(pool, used, DEFAULT_MIX)?.question.id).toBe('i');
  });

  it('se um tipo esgota, sorteia nos outros', () => {
    expect(pickRound(pool, new Set(['a']), only('ator'))).toBeUndefined();
    expect(pickRound(pool, new Set(['a']), { ...only('ator'), texto: 50 }, () => 0)?.question.id).toBe('t');
  });

  it('peso zero nunca é sorteado', () => {
    for (let i = 0; i < 50; i++) {
      const pick = pickRound(pool, new Set(), { ...only('texto'), ator: 0 }, Math.random);
      expect(pick?.question.id).toBe('t');
    }
  });

  it('distribui perto da porcentagem configurada', () => {
    const big: Question[] = Array.from({ length: 400 }, (_, i) => ({ ...image, id: `img${i}` }));
    const textQs: Question[] = Array.from({ length: 400 }, (_, i) => ({ ...text, id: `txt${i}` }));
    const mix: Mix = { capa: 75, 'capa-clara': 0, texto: 25, ator: 0, personagem: 0 };
    let capa = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const pick = pickRound([...big, ...textQs], new Set(), mix);
      if (pick?.question.clueType === 'image') capa++;
    }
    const share = capa / N;
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.8);
  });
});
