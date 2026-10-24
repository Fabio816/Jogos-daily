// Gera o catálogo do jogo a partir de APIs públicas:
//   - src/data/works.json        obras com capa (200 filmes, 200 séries, 200 jogos, 200 animes)
//   - src/data/actorQuestions.json  perguntas "quem interpreta X" e "qual personagem interpreta Y"
// Uso: node --env-file=.env --experimental-strip-types scripts/build-catalog.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../src/data/questions.ts';

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
if (!TMDB_TOKEN || !TWITCH_ID || !TWITCH_SECRET) {
  console.error('Faltam TMDB_READ_TOKEN, TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET no .env');
  process.exit(1);
}

const PER_TYPE = 200;
const EASY_TOP = 40;
const MEDIUM_TOP = 80;
const tierFor = (index) => (index < EASY_TOP ? 'easy' : index < MEDIUM_TOP ? 'medium' : 'hard');
const CAST_PER_WORK = 2;
const TMDB = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const SKIP_CHARACTERS = /^(himself|herself|themselves|self|narrator|voice|various|uncredited)$/i;

const DATA = (f) => fileURLToPath(new URL(`../src/data/${f}`, import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unique = (arr) => [...new Set(arr.filter(Boolean))];

const images = existsSync(DATA('images.json')) ? JSON.parse(readFileSync(DATA('images.json'), 'utf-8')) : {};
const handcraftedTmdb = new Set(Object.values(images).map((v) => v.tmdbId).filter(Boolean));
const handcraftedIgdb = new Set(Object.values(images).map((v) => v.igdbId).filter(Boolean));
const handcraftedAnilist = new Set(Object.values(images).map((v) => v.anilistId).filter(Boolean));
const previousWorks = existsSync(DATA('works.json')) ? JSON.parse(readFileSync(DATA('works.json'), 'utf-8')) : [];
const clearImageById = new Map(previousWorks.filter((w) => w.clearImageUrl).map((w) => [w.id, w.clearImageUrl]));

async function tmdb(path, params = {}) {
  const url = new URL(TMDB + path);
  url.searchParams.set('language', 'pt-BR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB ${res.status} em ${path}`);
  await sleep(120);
  return res.json();
}

// ---------- 1. Obras populares ----------

// Gêneros do TMDB que não são obras de ficção/entretenimento conhecido (talk show, reality, notícias, documentário).
const EXCLUDED_GENRES = new Set([10767, 10764, 10763, 99]);

async function tmdbPopular(kind) {
  // Map por id: a lista "popular" repete títulos entre páginas.
  const items = new Map();
  for (let page = 1; items.size < PER_TYPE + 40 && page <= 30; page++) {
    const data = await tmdb(`/${kind}/popular`, { page });
    for (const r of data.results) {
      if (r.poster_path && !(r.genre_ids ?? []).some((g) => EXCLUDED_GENRES.has(g))) {
        items.set(r.id, r);
      }
    }
  }
  return [...items.values()];
}

// Nomes típicos de DLC, pacotes e edições (a IGDB lista tudo como "jogo").
const NOT_A_GAME = /\b(bundle|pack|dlc|season pass|skin|soundtrack|expansion|collection|demo)\b/i;

function toTmdbWork(r, type, index) {
  const isMovie = type === 'movie';
  const title = isMovie ? r.title : r.name;
  const original = isMovie ? r.original_title : r.original_name;
  const date = isMovie ? r.release_date : r.first_air_date;
  return {
    id: `w-${type}-${r.id}`,
    type,
    difficulty: tierFor(index),
    title,
    aliases: unique([original]).filter((a) => a !== title),
    year: date ? Number(date.slice(0, 4)) : undefined,
    posterUrl: TMDB_IMG + r.poster_path,
    tmdbId: r.id,
  };
}

async function igdbGames() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' }),
  });
  const token = (await res.json()).access_token;
  const body =
    `fields name,first_release_date,cover.image_id,total_rating_count; ` +
    `where cover != null & total_rating_count > 20; sort total_rating_count desc; limit 300;`;
  const games = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` },
    body,
  }).then((r) => {
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    return r.json();
  });
  return [...new Map(games.map((g) => [g.id, g])).values()]
    .filter((g) => g.cover?.image_id && !handcraftedIgdb.has(g.id) && !NOT_A_GAME.test(g.name))
    .slice(0, PER_TYPE)
    .map((g, index) => ({
      id: `w-game-${g.id}`,
      type: 'game',
      difficulty: tierFor(index),
      title: g.name,
      aliases: [],
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
      posterUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`,
      igdbId: g.id,
    }));
}

const ANIME_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id title { romaji english native } startDate { year } coverImage { large }
    }
  }
}`;

async function anilistPopular() {
  const items = new Map();
  for (let page = 1; items.size < PER_TYPE + 20 && page <= 10; page++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: ANIME_QUERY, variables: { page } }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    for (const m of (await res.json()).data.Page.media) {
      if (m.coverImage?.large) items.set(m.id, m);
    }
    await sleep(800);
  }
  return [...items.values()]
    .filter((m) => !handcraftedAnilist.has(m.id))
    .slice(0, PER_TYPE)
    .map((m, index) => ({
      id: `w-anime-${m.id}`,
      type: 'anime',
      difficulty: tierFor(index),
      title: m.title.english ?? m.title.romaji,
      aliases: unique([m.title.romaji, m.title.native]).filter((a) => a !== (m.title.english ?? m.title.romaji)),
      year: m.startDate.year ?? undefined,
      posterUrl: m.coverImage.large,
      anilistId: m.id,
    }));
}

console.log('Coletando obras populares...');
const movies = (await tmdbPopular('movie'))
  .filter((r) => !handcraftedTmdb.has(r.id))
  .slice(0, PER_TYPE)
  .map((r, i) => toTmdbWork(r, 'movie', i));
const series = (await tmdbPopular('tv'))
  .filter((r) => !handcraftedTmdb.has(r.id))
  .slice(0, PER_TYPE)
  .map((r, i) => toTmdbWork(r, 'series', i));
const games = await igdbGames();
const anime = await anilistPopular();
const works = [...movies, ...series, ...games, ...anime].map((w) => {
  const clearImageUrl = clearImageById.get(w.id);
  return clearImageUrl ? { ...w, clearImageUrl } : w;
});
console.log(`Obras: ${movies.length} filmes, ${series.length} séries, ${games.length} jogos, ${anime.length} animes`);

writeFileSync(DATA('works.json'), JSON.stringify(works, null, 2) + '\n', 'utf-8');

// ---------- 2. Elenco: ator e personagem ----------

/** "Spider-Man / Peter Parker" -> ["Spider-Man", "Peter Parker"]; limpa "(voice)" e apelidos entre aspas. */
function characterNames(raw) {
  return raw
    .split('/')
    .map((p) => p.replace(/\(.*?\)/g, '').replace(/'[^']*'/g, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p && !SKIP_CHARACTERS.test(p));
}

/**
 * Aceita o nome completo e, para nomes de duas palavras, o primeiro ou o último nome
 * ("Jack Dawson" -> "Jack", "Dawson"). Nomes maiores ("Don Vito Corleone") só aceitam o completo,
 * para não aceitar palavras genéricas como "Don".
 */
function characterAliases(name) {
  const tokens = name.split(/\s+/);
  return tokens.length === 2 ? [name, tokens[0], tokens[1]] : [name];
}

async function castOf(kind, tmdbId) {
  const endpoint = kind === 'movie' ? `/movie/${tmdbId}/credits` : `/tv/${tmdbId}/credits`;
  const data = await tmdb(endpoint);
  return (data.cast ?? []).filter((c) => c.character && c.name).slice(0, 6);
}

// Obras que têm TMDB: as feitas à mão (com tmdbId) e as geradas.
const tmdbWorks = [
  ...Object.entries(images)
    .filter(([id, v]) => v.tmdbId && QUESTIONS.some((q) => q.id === id))
    .map(([id, v]) => ({
      wid: id,
      type: QUESTIONS.find((q) => q.id === id).type,
      tmdbId: v.tmdbId,
      title: v.tmdbTitle,
      difficulty: QUESTIONS.find((q) => q.id === id).difficulty,
    })),
  ...works
    .filter((w) => w.tmdbId)
    .map((w) => ({ wid: w.id, type: w.type, tmdbId: w.tmdbId, title: w.title, difficulty: w.difficulty })),
];

const actorQs = [];
const seen = new Set();
let done = 0;
for (const w of tmdbWorks) {
  if (seen.has(w.tmdbId)) continue; // mesma obra em duas perguntas
  seen.add(w.tmdbId);
  done++;
  try {
    const cast = (await castOf(w.type === 'movie' ? 'movie' : 'tv', w.tmdbId))
      .map((c) => ({ name: c.name.trim(), chars: characterNames(c.character) }))
      .filter((c) => c.chars.length > 0)
      .slice(0, CAST_PER_WORK);

    cast.forEach((c, i) => {
      const parts = c.name.split(/\s+/);
      const actorAnswers = unique([c.name, parts.length > 1 ? parts[parts.length - 1] : null]);
      const base = { type: w.type, difficulty: w.difficulty, workTitle: w.title };

      // Pergunta: "Quem interpreta X em Y?" -> ator
      actorQs.push({
        id: `ator-${w.wid}-${i + 1}`,
        kind: 'actor',
        ...base,
        clueType: 'character',
        clue: c.chars[0],
        answers: actorAnswers,
      });

      // Pergunta: "Quem é o ator de X em Y?" -> personagem
      actorQs.push({
        id: `pers-${w.wid}-${i + 1}`,
        kind: 'character',
        ...base,
        clueType: 'actor',
        clue: c.name,
        answers: unique(c.chars.flatMap(characterAliases)),
      });
    });
    if (done % 25 === 0) console.log(`  elenco: ${done}/${seen.size} obras`);
  } catch (err) {
    console.log(`  ERRO ${w.wid} (${w.title}): ${err.message}`);
  }
}

writeFileSync(DATA('actorQuestions.json'), JSON.stringify(actorQs, null, 2) + '\n', 'utf-8');
console.log(`\n${works.length} obras salvas em works.json`);
console.log(`${actorQs.length} perguntas de ator/personagem salvas em actorQuestions.json`);
