export interface Cell {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(a: Cell, b: Cell): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const MAX_POINTS = 5000;
const DECAY_KM = 2000;

/** Pontos por rodada: 5000 se acertou em cheio, caindo com a distância. */
export function scoreFor(km: number): number {
  return Math.round(MAX_POINTS * Math.exp(-Math.max(0, km) / DECAY_KM));
}

/**
 * Regiões com boa cobertura de fotos de rua. O sorteio parte de uma delas
 * e espalha um pouco o ponto, para não cair sempre no mesmo lugar.
 */
export const AREAS: Cell[] = [
  // Brasil
  { lat: -23.55, lon: -46.63 }, { lat: -22.9, lon: -43.2 }, { lat: -15.79, lon: -47.88 },
  { lat: -25.43, lon: -49.27 }, { lat: -30.03, lon: -51.22 }, { lat: -12.97, lon: -38.5 },
  { lat: -8.05, lon: -34.9 }, { lat: -3.73, lon: -38.52 }, { lat: -19.92, lon: -43.94 },
  // Europa
  { lat: 48.86, lon: 2.35 }, { lat: 52.52, lon: 13.4 }, { lat: 40.42, lon: -3.7 },
  { lat: 41.9, lon: 12.5 }, { lat: 52.37, lon: 4.9 }, { lat: 38.72, lon: -9.14 },
  { lat: 51.5, lon: -0.12 }, { lat: 52.23, lon: 21.01 }, { lat: 41.0, lon: 28.97 },
  // Américas
  { lat: 40.71, lon: -74.0 }, { lat: 41.88, lon: -87.63 }, { lat: 34.05, lon: -118.24 },
  { lat: 25.76, lon: -80.19 }, { lat: 43.65, lon: -79.38 }, { lat: 19.43, lon: -99.13 },
  { lat: -34.6, lon: -58.38 }, { lat: -33.45, lon: -70.67 }, { lat: 4.71, lon: -74.07 },
  { lat: -12.05, lon: -77.04 },
  // Ásia, Oceania e África
  { lat: 35.68, lon: 139.69 }, { lat: 37.57, lon: 126.98 }, { lat: 13.75, lon: 100.5 },
  { lat: 19.08, lon: 72.88 }, { lat: 28.61, lon: 77.21 }, { lat: -33.87, lon: 151.21 },
  { lat: -37.81, lon: 144.96 }, { lat: -26.2, lon: 28.04 }, { lat: 30.04, lon: 31.24 },
  { lat: -1.29, lon: 36.82 },
];

/** Ponto aleatório perto de uma das regiões (espalhamento de até ~0,25 grau). */
export function jitteredAround(area: Cell, rng: () => number = Math.random): Cell {
  return {
    lat: area.lat + (rng() - 0.5) * 0.5,
    lon: area.lon + (rng() - 0.5) * 0.5,
  };
}
