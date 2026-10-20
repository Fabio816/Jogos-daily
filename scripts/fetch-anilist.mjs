// Busca capas de animes na AniList (API pública, sem chave) e acrescenta em src/data/images.json.
// Uso: node --env-file=.env --experimental-strip-types scripts/fetch-anilist.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../src/data/questions.ts';

const OUT = fileURLToPath(new URL('../src/data/images.json', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english native }
      startDate { year }
      coverImage { large }
    }
  }
}`;

const norm = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function anilist(search) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { search } }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  return json.data.Page.media;
}

/** Aceita somente título exatamente igual (romaji, inglês ou nativo) a algum alias da pergunta. */
async function search(question) {
  const aliases = new Set(question.answers.map(norm));
  for (const title of question.answers) {
    const media = await anilist(title);
    const hit = media.find(
      (m) =>
        m.coverImage?.large &&
        [m.title.romaji, m.title.english, m.title.native].some((t) => t && aliases.has(norm(t))),
    );
    if (hit) {
      return {
        anilistId: hit.id,
        tmdbTitle: hit.title.english ?? hit.title.romaji,
        year: hit.startDate.year,
        posterUrl: hit.coverImage.large,
        matchedQuery: title,
      };
    }
    await sleep(700); // a AniList limita em torno de 90 requisições por minuto
  }
  return null;
}

const targets = QUESTIONS.filter((q) => q.type === 'anime');
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {};
for (const q of targets) delete existing[q.id];
const report = [];

for (const q of targets) {
  try {
    const hit = await search(q);
    if (hit) {
      existing[q.id] = hit;
      report.push(`OK    ${q.id}  ${q.answers[0]}  ->  ${hit.tmdbTitle} (${hit.year})  [anilist ${hit.anilistId}]`);
    } else {
      report.push(`FALHA ${q.id}  ${q.answers[0]}  (sem correspondência exata)`);
    }
  } catch (err) {
    report.push(`ERRO  ${q.id}  ${q.answers[0]}  ${err.message}`);
  }
}

writeFileSync(OUT, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
console.log(report.join('\n'));
const saved = targets.filter((q) => existing[q.id]).length;
console.log(`\n${saved}/${targets.length} capas de animes salvas em src/data/images.json`);
