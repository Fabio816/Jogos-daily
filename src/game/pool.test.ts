import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../data/questions';
import { ACTOR_QUESTIONS } from '../data/actorQuestions';
import { filterQuestions, pickNext } from './pool';

describe('filterQuestions', () => {
  it('filtra por tipo e dificuldade', () => {
    const pool = filterQuestions(QUESTIONS, { types: ['game'], difficulties: ['easy'] });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((q) => q.type === 'game' && q.difficulty === 'easy')).toBe(true);
  });

  it('retorna vazio quando nenhum filtro bate', () => {
    expect(filterQuestions(QUESTIONS, { types: [], difficulties: ['hard'] })).toHaveLength(0);
  });

  it('separa perguntas de obra e de ator pelo kind', () => {
    const all = [...QUESTIONS, ...ACTOR_QUESTIONS];
    const base = { types: ['movie', 'series'] as const, difficulties: ['easy', 'medium', 'hard'] as const };
    const actorsOnly = filterQuestions(all, { ...base, types: [...base.types], difficulties: [...base.difficulties], kinds: ['actor'] });
    const worksOnly = filterQuestions(all, { ...base, types: [...base.types], difficulties: [...base.difficulties], kinds: ['work'] });
    expect(actorsOnly.length).toBeGreaterThan(0);
    expect(actorsOnly.every((q) => q.kind === 'actor')).toBe(true);
    expect(worksOnly.every((q) => q.kind !== 'actor')).toBe(true);
  });
});

describe('pickNext', () => {
  const pool = QUESTIONS.slice(0, 3);

  it('nunca repete uma pergunta já usada', () => {
    const used = new Set([pool[0].id, pool[1].id]);
    expect(pickNext(pool, used)?.id).toBe(pool[2].id);
  });

  it('retorna undefined quando o pool esgota', () => {
    const used = new Set(pool.map((q) => q.id));
    expect(pickNext(pool, used)).toBeUndefined();
  });

  it('usa o gerador informado (determinístico para teste)', () => {
    expect(pickNext(pool, new Set(), () => 0)?.id).toBe(pool[0].id);
  });
});

describe('banco de perguntas', () => {
  it('todo id é único e toda pergunta tem resposta', () => {
    const all = [...QUESTIONS, ...ACTOR_QUESTIONS];
    const ids = all.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(all.every((q) => q.answers.length > 0)).toBe(true);
  });
});

describe('perguntas de ator e personagem', () => {
  it('têm personagem ou ator, obra e resposta', () => {
    expect(ACTOR_QUESTIONS.length).toBeGreaterThan(0);
    for (const q of ACTOR_QUESTIONS) {
      expect(['actor', 'character']).toContain(q.kind);
      expect(q.clue).toBeTruthy();
      expect(q.workTitle).toBeTruthy();
      expect(q.answers[0]).toBeTruthy();
    }
  });

  it('pergunta de ator mostra personagem; de personagem mostra ator', () => {
    for (const q of ACTOR_QUESTIONS) {
      expect(q.clueType).toBe(q.kind === 'actor' ? 'character' : 'actor');
    }
  });

  it('pistas não têm parênteses nem barras (restos de formatação do TMDB)', () => {
    expect(ACTOR_QUESTIONS.some((q) => /[()/]/.test(q.clue))).toBe(false);
  });
});
