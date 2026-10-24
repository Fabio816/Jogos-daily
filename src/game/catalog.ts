import { QUESTIONS, type Question, type WorkType } from '../data/questions';
import { ACTOR_QUESTIONS } from '../data/actorQuestions';
import { EMOJI_QUESTIONS } from '../data/emojiQuestions';
import { PHRASE_QUESTIONS } from '../data/phraseQuestions';
import { WORKS } from '../data/works';
import images from '../data/images.json';
import { filterQuestions } from './pool';
import { DEFAULT_DIFFICULTY_MIX, DIFFICULTIES, type DifficultyMix } from './difficulty';
import { DEFAULT_MIX, type Mix } from './mix';

/** Configurações de uma partida (definidas pelo host e compartilhadas com todos). */
export interface RoomSettings {
  targetPoints: number;
  durationSec: number;
  types: WorkType[];
  /** Peso (%) de cada dificuldade. Não precisa somar 100: os pesos são proporcionais. */
  difficultyMix: DifficultyMix;
  /** Peso (%) de cada tipo de rodada. Não precisa somar 100: os pesos são proporcionais. */
  mix: Mix;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  targetPoints: 100,
  durationSec: 20,
  types: ['movie', 'series', 'game', 'anime'],
  difficultyMix: DEFAULT_DIFFICULTY_MIX,
  mix: DEFAULT_MIX,
};

/** Capa de cada obra, por id da obra (catálogo gerado + obras feitas à mão). */
const POSTER_BY_WORK = new Map<string, string>([
  ...WORKS.map((w): [string, string] => [w.id, w.posterUrl]),
  ...Object.entries(images as Record<string, { posterUrl: string }>).map(
    ([id, v]): [string, string] => [id, v.posterUrl],
  ),
]);

/** "ator-w-movie-123-2" -> "w-movie-123"; "pers-m01-1" -> "m01". */
function workIdOf(questionId: string): string {
  return questionId.replace(/^(ator|pers)-/, '').replace(/-\d+$/, '');
}

/** Perguntas de ator e personagem mostram a capa da obra. */
const ACTOR_WITH_POSTER: Question[] = ACTOR_QUESTIONS.map((q) => ({
  ...q,
  imageUrl: POSTER_BY_WORK.get(workIdOf(q.id)),
}));

/** Perguntas "qual é a obra" a partir das capas do catálogo. */
const WORK_QUESTIONS: Question[] = WORKS.map((w) => ({
  id: w.id,
  kind: 'work',
  type: w.type,
  difficulty: w.difficulty,
  clueType: 'image',
  clue: '',
  imageUrl: w.posterUrl,
  clearImageUrl: w.clearImageUrl,
  answers: [w.title, ...w.aliases],
  year: w.year,
}));

export const ALL_QUESTIONS: Question[] = [
  ...QUESTIONS,
  ...EMOJI_QUESTIONS,
  ...PHRASE_QUESTIONS,
  ...WORK_QUESTIONS,
  ...ACTOR_WITH_POSTER,
];

/** Perguntas elegíveis conforme tipo e dificuldade. O sorteio por tipo de rodada é feito em mix.ts. */
export function buildPool(settings: RoomSettings): Question[] {
  const weights = settings.difficultyMix ?? DEFAULT_DIFFICULTY_MIX;
  const difficulties = DIFFICULTIES.filter((d) => (weights[d] ?? 0) > 0);
  return filterQuestions(ALL_QUESTIONS, { types: settings.types, difficulties });
}
