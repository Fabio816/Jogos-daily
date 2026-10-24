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

/** Regiões do sorteio. `mundo` (escolha da sala) usa todas. */
export type Region = 'brasil' | 'europa' | 'americas' | 'outros';
export type RegionChoice = 'mundo' | Region;

export const REGION_LABELS: Record<RegionChoice, string> = {
  mundo: 'Mundo inteiro',
  brasil: 'Brasil',
  europa: 'Europa',
  americas: 'Américas (sem Brasil)',
  outros: 'Ásia, Oceania e África',
};
export const REGION_CHOICES = Object.keys(REGION_LABELS) as RegionChoice[];

/** Espalhamento do sorteio em volta do centro da área: `cidade` ~25 km, `bairro` ~3 km. */
export type Spread = 'cidade' | 'bairro';
export const SPREADS: Spread[] = ['cidade', 'bairro'];
export const SPREAD_DEG: Record<Spread, number> = { cidade: 0.5, bairro: 0.05 };
export const SPREAD_LABELS: Record<Spread, string> = {
  cidade: 'Cidade (~25 km)',
  bairro: 'Bairro (~3 km)',
};

export interface Area extends Cell {
  region: Region;
}

/**
 * Regiões com boa cobertura de fotos de rua. O sorteio parte de uma delas
 * e espalha um pouco o ponto, para não cair sempre no mesmo lugar.
 */
export const AREAS: Area[] = [
  // Brasil
  { lat: -23.55, lon: -46.63, region: 'brasil' }, { lat: -22.9, lon: -43.2, region: 'brasil' },
  { lat: -15.79, lon: -47.88, region: 'brasil' }, { lat: -25.43, lon: -49.27, region: 'brasil' },
  { lat: -30.03, lon: -51.22, region: 'brasil' }, { lat: -12.97, lon: -38.5, region: 'brasil' },
  { lat: -8.05, lon: -34.9, region: 'brasil' }, { lat: -3.73, lon: -38.52, region: 'brasil' },
  { lat: -19.92, lon: -43.94, region: 'brasil' },
  // Europa
  { lat: 48.86, lon: 2.35, region: 'europa' }, { lat: 52.52, lon: 13.4, region: 'europa' },
  { lat: 40.42, lon: -3.7, region: 'europa' }, { lat: 41.9, lon: 12.5, region: 'europa' },
  { lat: 52.37, lon: 4.9, region: 'europa' }, { lat: 38.72, lon: -9.14, region: 'europa' },
  { lat: 51.5, lon: -0.12, region: 'europa' }, { lat: 52.23, lon: 21.01, region: 'europa' },
  { lat: 41.0, lon: 28.97, region: 'europa' },
  // Américas (sem Brasil)
  { lat: 40.71, lon: -74.0, region: 'americas' }, { lat: 41.88, lon: -87.63, region: 'americas' },
  { lat: 34.05, lon: -118.24, region: 'americas' }, { lat: 25.76, lon: -80.19, region: 'americas' },
  { lat: 43.65, lon: -79.38, region: 'americas' }, { lat: 19.43, lon: -99.13, region: 'americas' },
  { lat: -34.6, lon: -58.38, region: 'americas' }, { lat: -33.45, lon: -70.67, region: 'americas' },
  { lat: 4.71, lon: -74.07, region: 'americas' }, { lat: -12.05, lon: -77.04, region: 'americas' },
  // Ásia, Oceania e África
  { lat: 35.68, lon: 139.69, region: 'outros' }, { lat: 37.57, lon: 126.98, region: 'outros' },
  { lat: 13.75, lon: 100.5, region: 'outros' }, { lat: 19.08, lon: 72.88, region: 'outros' },
  { lat: 28.61, lon: 77.21, region: 'outros' }, { lat: -33.87, lon: 151.21, region: 'outros' },
  { lat: -37.81, lon: 144.96, region: 'outros' }, { lat: -26.2, lon: 28.04, region: 'outros' },
  { lat: 30.04, lon: 31.24, region: 'outros' }, { lat: -1.29, lon: 36.82, region: 'outros' },
];

/** Áreas de uma escolha de região (`mundo` = todas). */
export function areasFor(region: RegionChoice): Area[] {
  return region === 'mundo' ? AREAS : AREAS.filter((a) => a.region === region);
}

/** Ponto aleatório perto de uma área (espalhamento total de `spreadDeg` graus). */
export function jitteredAround(area: Cell, rng: () => number = Math.random, spreadDeg = SPREAD_DEG.cidade): Cell {
  return {
    lat: area.lat + (rng() - 0.5) * spreadDeg,
    lon: area.lon + (rng() - 0.5) * spreadDeg,
  };
}
