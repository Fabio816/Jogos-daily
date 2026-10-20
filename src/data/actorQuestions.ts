import actorJson from './actorQuestions.json';
import type { Question } from './questions';

/** Perguntas "Quem interpreta X em Y?", geradas por scripts/gen-actor-questions.mjs. */
export const ACTOR_QUESTIONS = actorJson as unknown as Question[];
