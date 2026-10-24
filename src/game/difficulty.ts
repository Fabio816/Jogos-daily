import { DIFFICULTIES, type Difficulty } from '../data/questions';

export { DIFFICULTIES };

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

export type DifficultyMix = Record<Difficulty, number>;

export const DEFAULT_DIFFICULTY_MIX: DifficultyMix = { easy: 30, medium: 40, hard: 30 };
