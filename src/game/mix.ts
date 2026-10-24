import type { Difficulty, Question } from '../data/questions';
import { DEFAULT_DIFFICULTY_MIX, DIFFICULTIES, type DifficultyMix } from './difficulty';

export type Group = 'capa' | 'capa-clara' | 'emoji' | 'frase' | 'ator' | 'personagem';
export type Mix = Record<Group, number>;

export const GROUPS: Group[] = ['capa', 'capa-clara', 'emoji', 'frase', 'ator', 'personagem'];

export const GROUP_LABEL: Record<Group, string> = {
  capa: 'Capa desfocada',
  'capa-clara': 'Capa nítida',
  emoji: 'Emoji',
  frase: 'Frase',
  ator: 'Quem interpreta? (ator)',
  personagem: 'Qual personagem? (personagem)',
};

export const DEFAULT_MIX: Mix = {
  capa: 40,
  'capa-clara': 20,
  emoji: 8,
  frase: 7,
  ator: 15,
  personagem: 10,
};

export function eligibleGroups(q: Question): Group[] {
  if (q.kind === 'actor') return ['ator'];
  if (q.kind === 'character') return ['personagem'];
  if (q.clueType === 'image') return ['capa', 'capa-clara'];
  if (q.clueType === 'emoji') return ['emoji'];
  if (q.clueType === 'phrase') return ['frase'];
  return [];
}

export interface RoundPick {
  question: Question;
  blur: boolean;
}

function pickWeighted<T extends string>(
  keys: readonly T[],
  weights: Record<T, number>,
  rng: () => number,
): T | undefined {
  const usable = keys.filter((key) => (weights[key] ?? 0) > 0);
  if (usable.length === 0) return undefined;
  const total = usable.reduce((sum, key) => sum + weights[key], 0);
  let roll = rng() * total;
  for (const key of usable) {
    roll -= weights[key];
    if (roll < 0) return key;
  }
  return usable[usable.length - 1];
}

function pickDifficulty(available: readonly Question[], difficultyMix: DifficultyMix, rng: () => number): Difficulty | undefined {
  const tiers = DIFFICULTIES.filter(
    (d) => (difficultyMix[d] ?? 0) > 0 && available.some((q) => q.difficulty === d),
  );
  return pickWeighted(tiers, difficultyMix, rng);
}

export function pickRound(
  pool: readonly Question[],
  used: ReadonlySet<string>,
  mix: Mix,
  difficultyMix: DifficultyMix = DEFAULT_DIFFICULTY_MIX,
  rng: () => number = Math.random,
): RoundPick | undefined {
  let groups = GROUPS.filter((g) => (mix[g] ?? 0) > 0);

  while (groups.length > 0) {
    const chosen = pickWeighted(groups, mix, rng);
    if (!chosen) break;

    const available = pool.filter((q) => !used.has(q.id) && eligibleGroups(q).includes(chosen));
    if (available.length > 0) {
      const tier = pickDifficulty(available, difficultyMix, rng);
      const candidates = tier ? available.filter((q) => q.difficulty === tier) : available;
      const question = candidates[Math.floor(rng() * candidates.length)];
      return { question, blur: chosen === 'capa' };
    }

    groups = groups.filter((g) => g !== chosen);
  }
  return undefined;
}
