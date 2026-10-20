import imagesJson from './images.json';

export interface PosterInfo {
  posterUrl: string;
  tmdbTitle?: string;
  tmdbId?: number;
  igdbId?: number;
  year: string | number | null;
}

/** Pôsteres/capas gerados pelos scripts fetch-tmdb e fetch-igdb, indexados pelo id da pergunta. */
const POSTERS = imagesJson as unknown as Record<string, PosterInfo>;

export function posterFor(questionId: string): PosterInfo | undefined {
  return POSTERS[questionId];
}
