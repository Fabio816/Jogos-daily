import { describe, expect, it } from 'vitest';
import { FULL_REVEAL_AT, MAX_BLUR_PX, blurPx } from './reveal';

describe('blurPx', () => {
  it('começa com o desfoque máximo', () => {
    expect(blurPx(0)).toBe(MAX_BLUR_PX);
  });

  it('fica nítido ao atingir o ponto de revelação total', () => {
    expect(blurPx(FULL_REVEAL_AT)).toBe(0);
    expect(blurPx(1)).toBe(0);
  });

  it('diminui de forma monotônica', () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8].map(blurPx);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
  });

  it('nunca sai do intervalo', () => {
    expect(blurPx(-1)).toBe(MAX_BLUR_PX);
    expect(blurPx(5)).toBe(0);
  });
});
