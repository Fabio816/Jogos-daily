// Busca pôsteres no TMDB para perguntas de filme e série e grava src/data/images.json.
// Uso: node --env-file=.env --experimental-strip-types scripts/fetch-tmdb.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../src/data/questions.ts';

const TOKEN = process.env.TMDB_READ_TOKEN;
if (!TOKEN) {
  console.error('TMDB_READ_TOKEN não definido. Verifique o arquivo .env.');
  process.exit(1);
}

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const OUT = fileURLToPath(new URL('../src/data/images.json', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params) {
  const url = new URL(API + path);
  url.searchParams.set('language', 'pt-BR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} em ${path}`);
  return res.json();
}

/** Procura o título (com e sem ano) e devolve o primeiro resultado que tenha pôster. */
async function search(question) {
  const isMovie = question.type === 'movie';
  const endpoint = isMovie ? '/search/movie' : '/search/tv';
  const yearParam = isMovie ? 'year' : 'first_air_date_year';

  for (const title of question.answers) {
    for (const withYear of question.year ? [true, false] : [false]) {
      const params = { query: title };
      if (withYear) params[yearParam] = question.year;
      const data = await tmdb(endpoint, params);
      const hit = data.results.find((r) => r.poster_path);
      if (hit) {
        return {
          tmdbId: hit.id,
          tmdbTitle: isMovie ? hit.title : hit.name,
          year: (isMovie ? hit.release_date : hit.first_air_date)?.slice(0, 4) ?? null,
          posterUrl: IMG + hit.poster_path,
          matchedQuery: title,
        };
      }
    }
  }
  return null;
}

const targets = QUESTIONS.filter((q) => q.type === 'movie' || q.type === 'series');
const result = {};
const report = [];

for (const q of targets) {
  try {
    const hit = await search(q);
    if (hit) {
      result[q.id] = hit;
      report.push(`OK    ${q.id}  ${q.answers[0]}  ->  ${hit.tmdbTitle} (${hit.year})  [id ${hit.tmdbId}]`);
    } else {
      report.push(`FALHA ${q.id}  ${q.answers[0]}  (sem pôster encontrado)`);
    }
  } catch (err) {
    report.push(`ERRO  ${q.id}  ${q.answers[0]}  ${err.message}`);
  }
  await sleep(250); // evita limite de requisições do TMDB
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf-8');
console.log(report.join('\n'));
console.log(`\n${Object.keys(result).length}/${targets.length} pôsteres salvos em src/data/images.json`);
console.log('Confira os títulos acima: se algum casar com obra errada, ajuste a resposta oficial em questions.ts e rode de novo.');
