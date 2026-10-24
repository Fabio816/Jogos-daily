import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA = fileURLToPath(new URL('../src/data/works.json', import.meta.url));
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
if (!TWITCH_ID || !TWITCH_SECRET) {
  console.error('Faltam TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET no .env');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const force = process.env.FORCE === '1';

async function json(url, init) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${url} -> ${res.status}`);
    await sleep(1000 * (attempt + 1));
  }
  throw new Error(`${url} falhou após 4 tentativas`);
}

async function twitchToken() {
  const data = await json('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' }),
  });
  return data.access_token;
}

const works = JSON.parse(readFileSync(DATA, 'utf8'));
const gameWorks = works.filter((w) => w.type === 'game' && w.igdbId && (force || !w.clearImageUrl));
const animeWorks = works.filter((w) => w.type === 'anime' && w.anilistId && (force || !w.clearImageUrl));

if (gameWorks.length) {
  const token = await twitchToken();
  let found = 0;
  for (let i = 0; i < gameWorks.length; i += 50) {
    const chunk = gameWorks.slice(i, i + 50);
    const body = `fields id,screenshots.image_id; where id = (${chunk.map((w) => w.igdbId).join(',')}); limit 50;`;
    const games = await json('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` },
      body,
    });
    const byId = new Map(games.map((g) => [g.id, g]));
    for (const work of chunk) {
      const shot = byId.get(work.igdbId)?.screenshots?.find((s) => s.image_id);
      if (shot) {
        work.clearImageUrl = `https://images.igdb.com/igdb/image/upload/t_1080p/${shot.image_id}.jpg`;
        found++;
      }
    }
    console.log(`  jogos: ${Math.min(i + 50, gameWorks.length)}/${gameWorks.length}`);
    await sleep(300);
  }
  console.log(`Jogos: ${found}/${gameWorks.length} com screenshot.`);
}

if (animeWorks.length) {
  const query = `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id bannerImage } } }`;
  let found = 0;
  for (let i = 0; i < animeWorks.length; i += 50) {
    const chunk = animeWorks.slice(i, i + 50);
    const data = await json('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, variables: { ids: chunk.map((w) => w.anilistId) } }),
    });
    const byId = new Map(data.data.Page.media.map((m) => [m.id, m]));
    for (const work of chunk) {
      const banner = byId.get(work.anilistId)?.bannerImage;
      if (banner) {
        work.clearImageUrl = banner;
        found++;
      }
    }
    console.log(`  animes: ${Math.min(i + 50, animeWorks.length)}/${animeWorks.length}`);
    await sleep(800);
  }
  console.log(`Animes: ${found}/${animeWorks.length} com banner.`);
}

writeFileSync(DATA, JSON.stringify(works, null, 2) + '\n', 'utf8');
console.log(`clearImageUrl salvo em ${works.length} obras.`);
