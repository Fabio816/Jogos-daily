import { areasFor, jitteredAround, SPREAD_DEG, type RegionChoice, type Spread } from './geo';
import type { Pick } from './state';

const TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined;
const BBOX_HALF = 0.005; // caixa de 0,01 grau (limite da API do Mapillary)
const ATTEMPTS = 25;

export class PhotoError extends Error {}

export interface PhotoOptions {
  region: RegionChoice;
  spread: Spread;
}

interface MapillaryImage {
  id: string | number;
  geometry?: { coordinates?: [number, number] };
  thumb_2048_url?: string;
  is_pano?: boolean;
  creator?: { username?: string };
}

/**
 * Sorteia uma foto 360° do Mapillary perto de uma área da região escolhida.
 * A API filtra com `is_pano=true`; fotos comuns não entram.
 */
export async function findPhoto(
  options: PhotoOptions = { region: 'mundo', spread: 'cidade' },
  rng: () => number = Math.random,
): Promise<Pick> {
  if (!TOKEN) throw new PhotoError('Falta VITE_MAPILLARY_TOKEN no arquivo .env.');
  const areas = areasFor(options.region);
  const spreadDeg = SPREAD_DEG[options.spread];

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const area = areas[Math.floor(rng() * areas.length)];
    const c = jitteredAround(area, rng, spreadDeg);
    const bbox = [c.lon - BBOX_HALF, c.lat - BBOX_HALF, c.lon + BBOX_HALF, c.lat + BBOX_HALF].join(',');

    const url = new URL('https://graph.mapillary.com/images');
    url.searchParams.set('access_token', TOKEN);
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('fields', 'id,geometry,thumb_2048_url,is_pano,creator');
    url.searchParams.set('is_pano', 'true');
    url.searchParams.set('limit', '50');

    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) throw new PhotoError('Token do Mapillary inválido.');
    if (!res.ok) continue;

    const data = ((await res.json()).data ?? []) as MapillaryImage[];
    const usable = data.filter((i) => i.is_pano && i.thumb_2048_url && i.geometry?.coordinates);
    if (usable.length === 0) continue;

    const img = usable[Math.floor(rng() * usable.length)];
    const [lon, lat] = img.geometry!.coordinates!;
    return {
      id: String(img.id),
      lat,
      lon,
      url: img.thumb_2048_url!,
      creator: img.creator?.username ?? 'desconhecido',
      isPano: true,
    };
  }
  throw new PhotoError('Não encontrei fotos 360° suficientes agora. Tente de novo.');
}
