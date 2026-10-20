// Busca capas de jogos na IGDB (via Twitch) e acrescenta em src/data/images.json.
// Uso: node --env-file=.env --experimental-strip-types scripts/fetch-igdb.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../src/data/questions.ts';

const { TWITCH_CLIENT_ID: CLIENT_ID, TWITCH_CLIENT_SECRET: CLIENT_SECRET } = process.env;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET não definido. Verifique o .env.');
  process.exit(1);
}

const OUT = fileURLToPath(new URL('../src/data/images.json', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`Twitch ${res.status} ao obter token`);
  return (await res.json()).access_token;
}

async function igdb(token, query) {
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
    body: query,
  });
  if (!res.ok) throw new Error(`IGDB ${res.status}: ${await res.text()}`);
  return res.json();
}

const norm = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Procura pelo título oficial e aliases. Aceita somente nome exatamente igual
 * (o campo `category` da IGDB vem vazio para muitos jogos, então não dá para filtrar por ele).
 */
async function search(token, question) {
  for (const title of question.answers) {
    const safe = title.replace(/"/g, '');
    const games = await igdb(
      token,
      `search "${safe}"; fields name,first_release_date,cover.image_id; limit 10;`,
    );
    const hit = games.find((g) => norm(g.name) === norm(safe) && g.cover?.image_id);
    if (hit) {
      return {
        igdbId: hit.id,
        tmdbTitle: hit.name,
        year: hit.first_release_date
          ? new Date(hit.first_release_date * 1000).getUTCFullYear()
          : null,
        posterUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${hit.cover.image_id}.jpg`,
        matchedQuery: safe,
      };
    }
    await sleep(300);
  }
  return null;
}

const targets = QUESTIONS.filter((q) => q.type === 'game');
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {};
for (const q of targets) delete existing[q.id]; // remove resultados de execuções anteriores
const token = await getToken();
const report = [];

for (const q of targets) {
  try {
    const hit = await search(token, q);
    if (hit) {
      existing[q.id] = hit;
      report.push(`OK    ${q.id}  ${q.answers[0]}  ->  ${hit.tmdbTitle} (${hit.year})  [igdb ${hit.igdbId}]`);
    } else {
      report.push(`FALHA ${q.id}  ${q.answers[0]}  (sem capa encontrada)`);
    }
  } catch (err) {
    report.push(`ERRO  ${q.id}  ${q.answers[0]}  ${err.message}`);
  }
  await sleep(300); // limite da IGDB: 4 requisições por segundo
}

writeFileSync(OUT, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
console.log(report.join('\n'));
const saved = targets.filter((q) => existing[q.id]).length;
console.log(`\n${saved}/${targets.length} capas de jogos salvas em src/data/images.json`);
