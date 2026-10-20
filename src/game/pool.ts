import type { Difficulty, Question, QuestionKind, WorkType } from '../data/questions';

export interface PoolFilter {
  types: WorkType[];
  difficulties: Difficulty[];
  /** Tipos de pergunta aceitos. Omitido = todos. */
  kinds?: QuestionKind[];
}

export function filterQuestions(questions: readonly Question[], filter: PoolFilter): Question[] {
  return questions.filter(
    (q) =>
      filter.types.includes(q.type) &&
      filter.difficulties.includes(q.difficulty) &&
      (!filter.kinds || filter.kinds.includes(q.kind ?? 'work')),
  );
}

/** Escolhe uma pergunta ainda não usada. Retorna undefined quando o pool esgota. */
export function pickNext(
  pool: readonly Question[],
  usedIds: ReadonlySet<string>,
  random: () => number = Math.random,
): Question | undefined {
  const available = pool.filter((q) => !usedIds.has(q.id));
  if (available.length === 0) return undefined;
  return available[Math.floor(random() * available.length)];
}
