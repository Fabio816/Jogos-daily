import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Carrega o módulo com token e fetch simulados; devolve as URLs chamadas. */
async function setup() {
  vi.stubEnv('VITE_MAPILLARY_TOKEN', 'token-teste');
  const urls: URL[] = [];
  vi.stubGlobal('fetch', async (url: URL) => {
    urls.push(new URL(String(url)));
    return new Response(
      JSON.stringify({
        data: [{ id: 1, is_pano: true, thumb_2048_url: 'u.jpg', geometry: { coordinates: [0, 0] }, creator: { username: 'x' } }],
      }),
    );
  });
  const mod = await import('./photo');
  return { mod, urls };
}

function bboxCenter(url: URL) {
  const [w, s, e, n] = url.searchParams.get('bbox')!.split(',').map(Number);
  return { lon: (w + e) / 2, lat: (s + n) / 2 };
}

describe('findPhoto', () => {
  it('sorteia dentro da região escolhida (Brasil → Porto Alegre com rng 0.5)', async () => {
    const { mod, urls } = await setup();
    await mod.findPhoto({ region: 'brasil', spread: 'bairro' }, () => 0.5);
    const c = bboxCenter(urls[0]);
    expect(c.lat).toBeCloseTo(-30.03, 2);
    expect(c.lon).toBeCloseTo(-51.22, 2);
  });

  it('espalhamento: com rng 0.9 o ponto desloca 0,4 do espalhamento (cidade 0,2 grau, bairro 0,02)', async () => {
    const { mod, urls } = await setup();
    // rng 0.9 → área índice 8 do Brasil (Belo Horizonte: -19.92, -43.94)
    await mod.findPhoto({ region: 'brasil', spread: 'cidade' }, () => 0.9);
    await mod.findPhoto({ region: 'brasil', spread: 'bairro' }, () => 0.9);
    const cidade = bboxCenter(urls[0]);
    const bairro = bboxCenter(urls[1]);
    expect(cidade.lat).toBeCloseTo(-19.92 + 0.2, 3);
    expect(cidade.lon).toBeCloseTo(-43.94 + 0.2, 3);
    expect(bairro.lat).toBeCloseTo(-19.92 + 0.02, 3);
    expect(bairro.lon).toBeCloseTo(-43.94 + 0.02, 3);
  });
});
