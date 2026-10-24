// Adiciona capas sem título (textless) às obras de filme/série usando a API do TMDB.
// Uso: npm run fetch:textless
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.TMDB_READ_TOKEN;
if (!TOKEN) {
  console.error('TMDB_READ_TOKEN não definido. Verifique o .env.');
  process.exit(1);
}

const DATA = fileURLToPath(new URL('../src/data/works.json', import.meta.url));
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${TMDB}${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
    });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) return null;
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

function pickTextless(data) {
  const posters = (data?.posters ?? [])
    .filter((p) => p.file_path && !p.iso_639_1)
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0) || (b.width ?? 0) - (a.width ?? 0));
  return posters[0]?.file_path ? IMG + posters[0].file_path : undefined;
}

const works = JSON.parse(readFileSync(DATA, 'utf8'));
const force = process.env.FORCE === '1';
let found = 0;
let missing = 0;
let skipped = 0;

for (const [index, work] of works.entries()) {
  if (!work.tmdbId || (work.type !== 'movie' && work.type !== 'series')) continue;
  if (!force && work.clearImageUrl) {
    skipped++;
    continue;
  }
  const kind = work.type === 'movie' ? 'movie' : 'tv';
  const data = await get(`/${kind}/${work.tmdbId}/images?include_image_language=null`);
  const url = pickTextless(data);
  if (url) {
    work.clearImageUrl = url;
    found++;
  } else {
    missing++;
  }
  if ((found + missing) % 25 === 0) console.log(`  capas: ${found + missing}/400`);
  await sleep(130);
}

writeFileSync(DATA, JSON.stringify(works, null, 2) + '\n', 'utf8');
console.log(`Textless: ${found} encontradas, ${missing} sem capa sem texto, ${skipped} já preenchidas.`);
