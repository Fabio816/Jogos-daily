import worksJson from './works.json';
import type { WorkType, Difficulty } from './questions';

/** Obra com capa, gerada por scripts/build-catalog.mjs a partir de TMDB, IGDB e AniList. */
export interface WorkEntry {
  id: string;
  type: WorkType;
  difficulty: Difficulty;
  title: string;
  aliases: string[];
  year?: number;
  posterUrl: string;
  /** Arte sem o título impresso, usada na capa nítida. */
  clearImageUrl?: string;
  tmdbId?: number;
  igdbId?: number;
  anilistId?: number;
}

export const WORKS = worksJson as unknown as WorkEntry[];
