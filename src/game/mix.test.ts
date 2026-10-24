import { describe, expect, it } from 'vitest';
import type { Question } from '../data/questions';
import { DEFAULT_DIFFICULTY_MIX, type DifficultyMix } from './difficulty';
import { DEFAULT_MIX, GROUPS, eligibleGroups, pickRound, type Mix } from './mix';

const emoji: Question = { id: 'e', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '🚢', answers: ['Titanic'] };
const phrase: Question = { id: 'f', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Eu sou o rei do mundo!', answers: ['Titanic'] };
const image: Question = { id: 'i', type: 'movie', difficulty: 'easy', clueType: 'image', clue: '', answers: ['Titanic'], imageUrl: 'x.jpg' };
const actor: Question = { id: 'a', kind: 'actor', type: 'movie', difficulty: 'easy', clueType: 'character', clue: 'Jack', answers: ['DiCaprio'], imageUrl: 'x.jpg' };
const character: Question = { id: 'p', kind: 'character', type: 'movie', difficulty: 'easy', clueType: 'actor', clue: 'DiCaprio', answers: ['Jack'], imageUrl: 'x.jpg' };
const pool = [emoji, phrase, image, actor, character];

const only = (g: keyof Mix): Mix => ({
  capa: 0,
  'capa-clara': 0,
  emoji: 0,
  frase: 0,
  ator: 0,
  personagem: 0,
  [g]: 100,
});

const pick = (
  questions: readonly Question[],
  used: ReadonlySet<string>,
  mix: Mix,
  difficultyMix: DifficultyMix = DEFAULT_DIFFICULTY_MIX,
  rng: () => number = Math.random,
) => pickRound(questions, used, mix, difficultyMix, rng);

describe('eligibleGroups', () => {
  it('separa emoji de frase e mantém capa, ator e personagem', () => {
    expect(eligibleGroups(emoji)).toEqual(['emoji']);
    expect(eligibleGroups(phrase)).toEqual(['frase']);
    expect(eligibleGroups(image)).toEqual(['capa', 'capa-clara']);
    expect(eligibleGroups(actor)).toEqual(['ator']);
    expect(eligibleGroups(character)).toEqual(['personagem']);
  });

  it('o mix padrão cobre todos os grupos', () => {
    expect(Object.keys(DEFAULT_MIX).sort()).toEqual([...GROUPS].sort());
  });
});

describe('pickRound', () => {
  it('respeita mix com um único grupo', () => {
    expect(pick(pool, new Set(), only('ator'), DEFAULT_DIFFICULTY_MIX, () => 0.5)?.question.id).toBe('a');
    expect(pick(pool, new Set(), only('emoji'), DEFAULT_DIFFICULTY_MIX, () => 0.5)?.question.id).toBe('e');
    expect(pick(pool, new Set(), only('frase'), DEFAULT_DIFFICULTY_MIX, () => 0.5)?.question.id).toBe('f');
  });

  it('capa desfocada marca blur; capa nítida não', () => {
    expect(pick([image], new Set(), only('capa'))?.blur).toBe(true);
    expect(pick([image], new Set(), only('capa-clara'))?.blur).toBe(false);
  });

  it('nunca repete pergunta já usada', () => {
    const used = new Set(['a', 'p', 'e', 'f']);
    expect(pick(pool, used, only('ator'))).toBeUndefined();
    expect(pick(pool, used, DEFAULT_MIX)?.question.id).toBe('i');
  });

  it('se um tipo esgota, sorteia nos outros', () => {
    expect(pick(pool, new Set(['a']), only('ator'))).toBeUndefined();
    expect(pick(pool, new Set(['a']), { ...only('ator'), emoji: 50 }, DEFAULT_DIFFICULTY_MIX, () => 0)?.question.id).toBe('e');
  });

  it('peso zero nunca é sorteado', () => {
    const emojiOnly = { ...only('emoji'), ator: 0 };
    for (let i = 0; i < 50; i++) {
      expect(pick(pool, new Set(), emojiOnly)?.question.id).toBe('e');
    }
  });

  it('distribui perto da porcentagem configurada de grupos', () => {
    const images: Question[] = Array.from({ length: 400 }, (_, i) => ({ ...image, id: `img${i}` }));
    const emojis: Question[] = Array.from({ length: 400 }, (_, i) => ({ ...emoji, id: `emoji${i}` }));
    const mix: Mix = { capa: 75, 'capa-clara': 0, emoji: 25, frase: 0, ator: 0, personagem: 0 };
    let capa = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      if (pick([...images, ...emojis], new Set(), mix)?.question.clueType === 'image') capa++;
    }
    const share = capa / N;
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.8);
  });
});

describe('dificuldade', () => {
  const easy: Question = { ...image, id: 'easy', difficulty: 'easy' };
  const medium: Question = { ...image, id: 'medium', difficulty: 'medium' };
  const hard: Question = { ...image, id: 'hard', difficulty: 'hard' };
  const tiers = [easy, medium, hard];

  it('peso zero nunca é sorteado', () => {
    const difficultyMix: DifficultyMix = { easy: 100, medium: 0, hard: 0 };
    for (let i = 0; i < 100; i++) {
      expect(pick(tiers, new Set(), only('capa'), difficultyMix)?.question.id).toBe('easy');
    }
  });

  it('se o nível existe mas está esgotado, cai no nível disponível', () => {
    expect(pick([medium], new Set(), only('capa'), { easy: 100, medium: 0, hard: 0 })?.question.id).toBe('medium');
  });

  it('distribui perto dos percentuais fácil/médio/difícil', () => {
    const N = 6000;
    const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < N; i++) {
      const id = pick(tiers, new Set(), only('capa'))?.question.id;
      if (id) counts[id]++;
    }
    expect(counts.easy / N).toBeGreaterThan(0.25);
    expect(counts.easy / N).toBeLessThan(0.35);
    expect(counts.medium / N).toBeGreaterThan(0.35);
    expect(counts.medium / N).toBeLessThan(0.45);
    expect(counts.hard / N).toBeGreaterThan(0.25);
    expect(counts.hard / N).toBeLessThan(0.35);
  });
});
