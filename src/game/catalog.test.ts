import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS, DEFAULT_SETTINGS, buildPool } from './catalog';
import { EMOJI_QUESTIONS } from '../data/emojiQuestions';
import { PHRASE_QUESTIONS } from '../data/phraseQuestions';
import { WORKS } from '../data/works';
import { normalize } from './answer';

describe('catálogo completo', () => {
  it('tem ids únicos em todas as perguntas', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tem pelo menos 200 obras de cada categoria', () => {
    for (const type of ['movie', 'series', 'game', 'anime'] as const) {
      expect(WORKS.filter((w) => w.type === type).length).toBeGreaterThanOrEqual(200);
    }
  });

  it('toda obra tem título e capa', () => {
    expect(WORKS.every((w) => w.title && w.posterUrl.startsWith('https://'))).toBe(true);
  });

  it('perguntas de ator e personagem têm a capa da obra', () => {
    const actorQs = ALL_QUESTIONS.filter((q) => q.kind === 'actor' || q.kind === 'character');
    expect(actorQs.length).toBeGreaterThan(1000);
    const withPoster = actorQs.filter((q) => q.imageUrl?.startsWith('https://'));
    expect(withPoster.length / actorQs.length).toBeGreaterThan(0.95);
  });
});

describe('perguntas de texto geradas', () => {
  it('tem pelo menos 2000 perguntas de emoji e 2000 de frase', () => {
    expect(EMOJI_QUESTIONS.length).toBeGreaterThanOrEqual(2000);
    expect(PHRASE_QUESTIONS.length).toBeGreaterThanOrEqual(2000);
  });

  it('toda pergunta de texto tem pista, respostas e nenhuma imagem', () => {
    const all = [...EMOJI_QUESTIONS, ...PHRASE_QUESTIONS];
    expect(all.every((q) => q.clue.trim().length > 0)).toBe(true);
    expect(all.every((q) => q.answers.length > 0 && q.answers[0].trim().length > 0)).toBe(true);
    expect(all.every((q) => q.imageUrl === undefined)).toBe(true);
    expect(all.every((q) => q.type === 'movie' || q.type === 'series')).toBe(true);
  });

  it('não repete obras entre as perguntas de emoji e de frase', () => {
    const titles = [...EMOJI_QUESTIONS, ...PHRASE_QUESTIONS].map((q) => normalize(q.answers[0]));
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('buildPool', () => {
  it('filtra por tipo de obra', () => {
    const pool = buildPool({ ...DEFAULT_SETTINGS, types: ['game'] });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((q) => q.type === 'game')).toBe(true);
  });

  it('o pool inclui todos os tipos de rodada (o peso é aplicado depois)', () => {
    const pool = buildPool(DEFAULT_SETTINGS);
    expect(pool.some((q) => q.clueType === 'image')).toBe(true);
    expect(pool.some((q) => q.kind === 'actor')).toBe(true);
    expect(pool.some((q) => q.kind === 'character')).toBe(true);
    expect(pool.some((q) => q.clueType === 'emoji')).toBe(true);
    expect(pool.some((q) => q.clueType === 'phrase')).toBe(true);
  });

  it('filtra pelas dificuldades com peso maior que zero', () => {
    const pool = buildPool({ ...DEFAULT_SETTINGS, difficultyMix: { easy: 0, medium: 0, hard: 100 } });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((q) => q.difficulty === 'hard')).toBe(true);
  });
});

describe('três níveis de dificuldade', () => {
  it('as perguntas geradas cobrem fácil, médio e difícil', () => {
    for (const list of [EMOJI_QUESTIONS, PHRASE_QUESTIONS]) {
      expect(list.some((q) => q.difficulty === 'easy')).toBe(true);
      expect(list.some((q) => q.difficulty === 'medium')).toBe(true);
      expect(list.some((q) => q.difficulty === 'hard')).toBe(true);
    }
  });

  it('cada categoria tem obras nos três níveis', () => {
    for (const type of ['movie', 'series', 'game', 'anime'] as const) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        expect(WORKS.some((w) => w.type === type && w.difficulty === difficulty)).toBe(true);
      }
    }
  });
});
