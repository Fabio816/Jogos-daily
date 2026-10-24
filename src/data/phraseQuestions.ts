import phraseJson from './phraseQuestions.json';
import type { Question } from './questions';

export const PHRASE_QUESTIONS = phraseJson as unknown as Question[];
