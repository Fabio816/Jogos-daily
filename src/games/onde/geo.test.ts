import { describe, expect, it } from 'vitest';
import { AREAS, areasFor, haversineKm, jitteredAround, SPREAD_DEG } from './geo';

describe('regiões do sorteio', () => {
  it('mundo usa todas as áreas', () => {
    expect(areasFor('mundo')).toHaveLength(AREAS.length);
  });

  it('cada região filtra só as próprias áreas', () => {
    for (const region of ['brasil', 'europa', 'americas', 'outros'] as const) {
      const list = areasFor(region);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((a) => a.region === region)).toBe(true);
    }
    const total = ['brasil', 'europa', 'americas', 'outros'].reduce((n, r) => n + areasFor(r as 'brasil').length, 0);
    expect(total).toBe(AREAS.length);
  });

  it('Brasil tem só áreas no Brasil (lat/lon aproximados)', () => {
    for (const a of areasFor('brasil')) {
      expect(a.lon).toBeLessThan(-30);
      expect(a.lat).toBeLessThan(6);
      expect(a.lat).toBeGreaterThan(-35);
    }
  });
});

describe('espalhamento do sorteio', () => {
  const center = { lat: 10, lon: 20 };

  it('bairro fica dentro de ~3 km do centro em qualquer sorteio', () => {
    for (const rng of [0, 0.25, 0.5, 0.75, 0.999]) {
      const p = jitteredAround(center, () => rng, SPREAD_DEG.bairro);
      expect(haversineKm(center, p)).toBeLessThan(4);
    }
  });

  it('cidade espalha mais que bairro', () => {
    const far = jitteredAround(center, () => 0, SPREAD_DEG.cidade);
    const near = jitteredAround(center, () => 0, SPREAD_DEG.bairro);
    expect(haversineKm(center, far)).toBeGreaterThan(haversineKm(center, near));
  });
});
