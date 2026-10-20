export const MAX_BLUR_PX = 28;
/** Fração do tempo em que a imagem já está totalmente nítida. */
export const FULL_REVEAL_AT = 0.8;

/**
 * Desfoque da imagem conforme o tempo da rodada passa.
 * @param progress 0 = início da rodada, 1 = fim do tempo
 */
export function blurPx(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  const t = Math.min(p / FULL_REVEAL_AT, 1);
  return Math.round(MAX_BLUR_PX * (1 - t) * 10) / 10;
}
