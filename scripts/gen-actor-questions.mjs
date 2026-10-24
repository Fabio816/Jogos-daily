// Gera perguntas "Quem interpreta X em Y?" a partir do elenco no TMDB.
// Usa os ids de filmes/séries já presentes em src/data/images.json.
// Uso: node --env-file=.env --experimental-strip-types scripts/gen-actor-questions.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../src/data/questions.ts';

const TOKEN = process.env.TMDB_READ_TOKEN;
if (!TOKEN) {
  console.error('TMDB_READ_TOKEN não definido. Verifique o .env.');
  process.exit(1);
}

const API = 'https://api.themoviedb.org/3';
const IMAGES = fileURLToPath(new URL('../src/data/images.json', import.meta.url));
const OUT = fileURLToPath(new URL('../src/data/actorQuestions.json', import.meta.url));
const CAST_PER_WORK = 2;
const SKIP_CHARACTERS = /^(himself|herself|themselves|self|narrator|voice|various|uncredited)$/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function credits(type, tmdbId) {
  const endpoint = type === 'movie' ? `/movie/${tmdbId}/credits` : `/tv/${tmdbId}/credits`;
  const res = await fetch(`${API}${endpoint}?language=pt-BR`, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} em ${endpoint}`);
  return res.json();
}

/** "Spider-Man / Peter Parker" -> "Spider-Man"; "Woody (voice)" -> "Woody"; "Tyrion 'The Halfman' Lannister" -> "Tyrion Lannister". */
function cleanCharacter(raw) {
  return raw
    .split('/')[0]
    .replace(/\(.*?\)/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const images = JSON.parse(readFileSync(IMAGES, 'utf-8'));
const works = QUESTIONS.filter((q) => (q.type === 'movie' || q.type === 'series') && images[q.id]?.tmdbId);
const out = [];
const report = [];
const seenWorks = new Set(); // evita perguntas duplicadas quando duas perguntas apontam para a mesma obra

for (const work of works) {
  const { tmdbId, tmdbTitle, year } = images[work.id];
  if (seenWorks.has(tmdbId)) {
    report.push(`PULA  ${work.id}  ${tmdbTitle}  (obra já incluída)`);
    continue;
  }
  seenWorks.add(tmdbId);

  try {
    const data = await credits(work.type, tmdbId);
    const cast = (data.cast ?? [])
      .map((c) => ({ ...c, character: cleanCharacter(c.character ?? '') }))
      .filter((c) => c.character && !SKIP_CHARACTERS.test(c.character))
      .slice(0, CAST_PER_WORK);
    cast.forEach((c, i) => {
      const parts = c.name.trim().split(/\s+/);
      const answers = parts.length > 1 ? [c.name, parts[parts.length - 1]] : [c.name];
      out.push({
        id: `ator-${work.id}-${i + 1}`,
        kind: 'actor',
        type: work.type,
        difficulty: work.difficulty,
        clueType: 'character',
        clue: c.character,
        workTitle: tmdbTitle,
        answers,
        year: year ? Number(year) : undefined,
      });
    });
    report.push(`OK    ${work.id}  ${tmdbTitle}: ${cast.map((c) => `${c.character} -> ${c.name}`).join(' | ') || 'sem elenco utilizável'}`);
  } catch (err) {
    report.push(`ERRO  ${work.id}  ${tmdbTitle}  ${err.message}`);
  }
  await sleep(250);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf-8');
console.log(report.join('\n'));
console.log(`\n${out.length} perguntas de ator salvas em src/data/actorQuestions.json`);
