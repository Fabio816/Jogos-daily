import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS, DEFAULT_SETTINGS, buildPool } from './catalog';
import { WORKS } from '../data/works';

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
    expect(pool.some((q) => q.clueType === 'emoji' || q.clueType === 'phrase')).toBe(true);
  });
});
