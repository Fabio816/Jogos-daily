export const MAX_POINTS = 100;
export const MIN_POINTS = 20;

/**
 * Pontuação de um acerto: quanto mais cedo, mais pontos.
 * Vai linearmente de MAX_POINTS (resposta imediata) até MIN_POINTS (no último instante).
 */
export function pointsFor(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return MIN_POINTS;
  const ratio = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * ratio);
}
