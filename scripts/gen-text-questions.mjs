import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.TMDB_READ_TOKEN;
if (!TOKEN) {
  console.error('TMDB_READ_TOKEN não definido. Verifique o arquivo .env.');
  process.exit(1);
}

const API = 'https://api.themoviedb.org/3';
const CACHE = process.env.TMDB_CACHE ?? '/tmp/opencode/tmdb-cache';
const GEMOJI_CACHE = join(CACHE, 'gemoji.json');
const TARGET_EMOJI = Number(process.env.TARGET_EMOJI ?? 2000);
const TARGET_PHRASE = Number(process.env.TARGET_PHRASE ?? 2000);
const MAX_PER_KIND = Number(process.env.MAX_PER_KIND ?? 3600);
const CONCURRENCY = 16;
const EXCLUDED_GENRES = new Set([99, 10763, 10764, 10766, 10767]);
const DATA = (f) => fileURLToPath(new URL(`../src/data/${f}`, import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unique = (arr) => [...new Set(arr.filter(Boolean))];

mkdirSync(CACHE, { recursive: true });

let lastRequest = 0;
async function request(url) {
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));

  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = Math.max(0, 40 - (Date.now() - lastRequest));
    if (wait) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      writeFileSync(file, JSON.stringify(data));
      return data;
    }
    if (res.status === 404) throw new Error(`TMDB 404: ${url}`);
    const retryAfter = Number(res.headers.get('retry-after') ?? 0);
    await sleep(Math.max(retryAfter * 1000, 600 * (attempt + 1)));
  }
  throw new Error(`TMDB falhou: ${url}`);
}

function tmdb(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('include_adult', 'false');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return request(url.toString());
}

const EXACT = {
  'based on novel or book': '📖',
  'based on comic': '💬',
  'based on comic book': '💬',
  'based on comic strip': '💬',
  'based on manga': '📚',
  'based on video game': '🎮',
  'based on true story': '📰',
  'based on true events': '📰',
  'based on play or musical': '🎭',
  'based on tv series': '📺',
  'based on movie': '🎬',
  'based on young adult novel': '📖',
  "based on children's book": '📖',
  'based on short story': '📖',
  'based on poem': '📜',
  'based on song, poem or rhyme': '🎵',
  'based on radio drama': '📻',
  'based on magazine, newspaper or article': '📰',
  'based on toy': '🧸',
  'based on theme park ride': '🎢',
  'based on folklore': '📜',
  'based on myth or legend': '🏺',
  'based on podcast': '🎙️',
  'based on webcomic or webtoon': '💬',
  'based on light novel': '📖',
  'based on visual novel': '🎮',
  'based on anime': '🎌',
  'soap': '🧼',
  'fight': '🥊',
  'fight club': '🥊',
  'split personality': '🧠',
  'insomnia': '😴',
  'consumerism': '🛍️',
  'ring': '💍',
  'quest': '🧭',
  'fellowship': '🤝',
  'hobbit': '🧙',
  'bounty hunter': '🤠',
  'class conflict': '💰',
  'social class': '💰',
  'wealth gap': '💰',
  'basement': '🏠',
  'con artist': '🎭',
  'car race': '🏎️',
  'cars': '🚗',
  'race': '🏁',
  'grand prix': '🏁',
  'motor race': '🏁',
  'portal': '🌀',
  'alternate dimension': '🌀',
  'alternate universe': '🌀',
  'double life': '🎭',
  'alter ego': '🎭',
  'british spy': '🕵️',
  'spider bite': '🕷️',
  'teen superhero': '🦸',
  'lgbt': '🏳️‍🌈',
  'lgbtq': '🏳️‍🌈',
  'gay': '🏳️‍🌈',
  'lesbian': '🏳️‍🌈',
  'roommate': '🏠',
  'mockumentary': '🎥',
  'cliffhanger': '🧗',
  'sacrifice': '💔',
  'voice actor': '🎙️',
  '3d animation': '🎨',
  'animation': '🎨',
  'adult animation': '🎨',
  'stop motion': '🎞️',
  'cgi': '🎨',
  'based on fairy tale': '🧚',
  'based on novel': '📖',
  'based on book': '📖',
  'superhero': '🦸',
  'superhero team': '🦸',
  'super power': '⚡',
  'supernatural': '👻',
  'supernatural horror': '👻',
  'horror': '👻',
  'psychological horror': '👻',
  'body horror': '🩸',
  'slasher': '🔪',
  'zombie': '🧟',
  'vampire': '🧛',
  'werewolf': '🐺',
  'ghost': '👻',
  'demon': '😈',
  'witch': '🧙‍♀️',
  'wizard': '🧙',
  'magic': '✨',
  'fantasy world': '🐉',
  'dragon': '🐉',
  'dinosaur': '🦖',
  'shark': '🦈',
  'monster': '👹',
  'giant monster': '👹',
  'kaiju': '🦖',
  'alien': '👽',
  'alien invasion': '👽',
  'robot': '🤖',
  'artificial intelligence (a.i.)': '🤖',
  'cyborg': '🦾',
  'time travel': '⏳',
  'space': '🚀',
  'space travel': '🚀',
  'spaceship': '🚀',
  'astronaut': '👨‍🚀',
  'planet': '🪐',
  'mars': '🔴',
  'moon': '🌕',
  'wormhole': '🌀',
  'parallel universe': '🌀',
  'dystopia': '☢️',
  'post-apocalyptic future': '☢️',
  'apocalypse': '🌋',
  'pandemic': '🦠',
  'virus': '🦠',
  'new york city': '🗽',
  'los angeles, california': '🌴',
  'london, england': '🌉',
  'paris, france': '🗼',
  'tokyo, japan': '🗼',
  'chicago, illinois': '🏙️',
  'san francisco, california': '🌉',
  'miami, florida': '🌴',
  'rio de janeiro': '🇧🇷',
  'brazil': '🇧🇷',
  'italy': '🇮🇹',
  'japan': '🇯🇵',
  'france': '🇫🇷',
  'india': '🇮🇳',
  'mexico': '🇲🇽',
  'australia': '🇦🇺',
  'canada': '🇨🇦',
  'russia': '🇷🇺',
  'germany': '🇩🇪',
  'spain': '🇪🇸',
  'china': '🇨🇳',
  'south korea': '🇰🇷',
  'korea': '🇰🇷',
  'thailand': '🇹🇭',
  'egypt': '🇪🇬',
  'africa': '🌍',
  'middle east': '🏜️',
  'afghanistan': '🏔️',
  'iraq': '🏜️',
  'world war ii': '⚔️',
  'world war i': '⚔️',
  'vietnam war': '🌴',
  'cold war': '🧊',
  'war': '⚔️',
  'soldier': '🪖',
  'battle': '⚔️',
  'battlefield': '⚔️',
  'medieval': '🏰',
  'medieval times': '🏰',
  'castle': '🏰',
  'king': '👑',
  'queen': '👸',
  'princess': '👸',
  'prince': '🤴',
  'knight': '🛡️',
  'pirate': '🏴‍☠️',
  'pirate ship': '🏴‍☠️',
  'ninja': '🥷',
  'samurai': '⚔️',
  'cowboy': '🤠',
  'western': '🤠',
  'mafia': '🕴️',
  'gangster': '🕴️',
  'organized crime': '🕴️',
  'crime family': '🕴️',
  'yakuza': '🕴️',
  'crime boss': '🕴️',
  'spy': '🕵️',
  'espionage': '🕵️',
  'assassin': '🔫',
  'hitman': '🔫',
  'serial killer': '🔪',
  'murder': '🔪',
  'murder investigation': '🔍',
  'detective': '🕵️',
  'police': '👮',
  'police officer': '👮',
  'police detective': '🕵️',
  'fbi': '🕵️',
  'cia': '🕵️',
  'prison': '⛓️',
  'courtroom': '⚖️',
  'courtroom drama': '⚖️',
  'legal drama': '⚖️',
  'lawyer': '⚖️',
  'judge': '⚖️',
  'trial': '⚖️',
  'hospital': '🏥',
  'medical drama': '🏥',
  'doctor': '👨‍⚕️',
  'nurse': '👩‍⚕️',
  'scientist': '🧑‍🔬',
  'laboratory': '🧪',
  'experiment': '🧪',
  'school': '🏫',
  'high school': '🎓',
  'college': '🎓',
  'university': '🎓',
  'teacher': '👩‍🏫',
  'student': '🎒',
  'wedding': '💍',
  'marriage': '💍',
  'christmas': '🎄',
  'halloween': '🎃',
  'music': '🎵',
  'musical': '🎵',
  'musician': '🎸',
  'singer': '🎤',
  'band': '🎸',
  'dance': '💃',
  'dancer': '💃',
  'painting': '🎨',
  'artist': '🎨',
  'photography': '📷',
  'photographer': '📷',
  'writer': '✍️',
  'journalism': '📰',
  'journalist': '📰',
  'politics': '🏛️',
  'president': '🏛️',
  'election': '🗳️',
  'revolution': '✊',
  'gun': '🔫',
  'shootout': '🔫',
  'sword': '🗡️',
  'katana': '🗡️',
  'bomb': '💣',
  'explosion': '💥',
  'car': '🚗',
  'racing': '🏎️',
  'motorcycle': '🏍️',
  'train': '🚂',
  'airplane': '✈️',
  'pilot': '👨‍✈️',
  'ship': '🚢',
  'ocean': '🌊',
  'sea': '🌊',
  'submarine': '🚢',
  'desert': '🏜️',
  'jungle': '🌴',
  'island': '🏝️',
  'snow': '❄️',
  'winter': '❄️',
  'forest': '🌲',
  'mountain': '⛰️',
  'volcano': '🌋',
  'earthquake': '🌋',
  'storm': '⛈️',
  'tornado': '🌪️',
  'fire': '🔥',
  'firefighter': '👨‍🚒',
  'boxing': '🥊',
  'football': '🏈',
  'soccer': '⚽',
  'basketball': '🏀',
  'baseball': '⚾',
  'golf': '⛳',
  'tennis': '🎾',
  'surfing': '🏄',
  'skateboarding': '🛹',
  'wrestling': '🤼',
  'sports': '🏆',
  'food': '🍽️',
  'cooking': '🍳',
  'chef': '👨‍🍳',
  'restaurant': '🍴',
  'coffee': '☕',
  'alcoholism': '🍺',
  'alcohol': '🍺',
  'drug addiction': '💊',
  'smoking': '🚬',
  'dog': '🐕',
  'cat': '🐈',
  'horse': '🐎',
  'lion': '🦁',
  'tiger': '🐅',
  'bear': '🐻',
  'elephant': '🐘',
  'monkey': '🐒',
  'bird': '🐦',
  'penguin': '🐧',
  'fish': '🐟',
  'whale': '🐋',
  'spider': '🕷️',
  'snake': '🐍',
  'rat': '🐀',
  'mouse': '🐁',
  'bee': '🐝',
  'butterfly': '🦋',
  'toy': '🧸',
  'video game': '🎮',
  'gamer': '🎮',
  'comic book': '💬',
  'clown': '🤡',
  'circus': '🎪',
  'casino': '🎰',
  'gambling': '🎲',
  'road trip': '🚗',
  'camping': '🏕️',
  'competition': '🏆',
  'revenge': '😠',
  'love': '❤️',
  'romance': '❤️',
  'friendship': '🤝',
  'family': '👪',
  'father': '👨',
  'mother': '👩',
  'child': '👶',
  'teenager': '🧑',
  'grief': '😢',
  'death': '⚰️',
  'loss of loved one': '💔',
  'kidnapping': '🚨',
  'robbery': '💰',
  'heist': '💰',
  'money': '💵',
  'poverty': '🏚️',
  'wealth': '💰',
  'corruption': '💼',
  'slavery': '⛓️',
  'religion': '✝️',
  'god': '☁️',
  'devil': '😈',
  'hell': '🔥',
  'heaven': '☁️',
  'afterlife': '👻',
  'memory': '🧠',
  'memory loss': '🧠',
  'identity': '🪞',
  'secret identity': '🪞',
  'mirror': '🪞',
  'clock': '🕰️',
  'key': '🔑',
  'treasure': '💎',
  'treasure hunt': '💎',
  'gold': '🪙',
  'crown': '👑',
  'mask': '🎭',
  'fashion': '👗',
  'makeup': '💄',
  'beauty': '💅',
  'model': '📸',
  'actor': '🎭',
  'film': '🎬',
  'director': '🎬',
  'cinema': '🎬',
  'hollywood': '🎬',
  'celebrity': '⭐',
  'concert': '🎤',
  'guitar': '🎸',
  'piano': '🎹',
  'drums': '🥁',
  'violin': '🎻',
  'dj': '🎧',
  'radio': '📻',
  'podcast': '🎙️',
  'news': '📰',
  'fairy tale': '🧚',
  'fairy': '🧚',
  'mermaid': '🧜',
  'angel': '😇',
  'godzilla': '🦖',
  'titanic': '🚢',
  'shipwreck': '🚢',
  'iceberg': '🧊',
  'disaster': '🌋',
  'natural disaster': '🌋',
  'survival': '🏕️',
  'wilderness': '🌲',
  'hiking': '🥾',
  'farm': '🚜',
  'village': '🏘️',
  'city': '🏙️',
  'small town': '🏡',
  'haunted house': '🏚️',
  'asylum': '🏥',
  'museum': '🏛️',
  'library': '📚',
  'book': '📖',
  'letter': '✉️',
  'diary': '📓',
  'telephone': '☎️',
  'computer': '💻',
  'hacker': '👨‍💻',
  'internet': '🌐',
  'social media': '📱',
  'virtual reality': '🥽',
  'dream': '💭',
  'reincarnation': '🔄',
  'immortality': '♾️',
  'coming of age': '🌱',
  'bullying': '😢',
  'mental illness': '🧠',
  'disability': '♿',
  'cancer': '🎗️',
  'addiction': '💉',
  'prostitution': '💋',
  'torture': '🔗',
  'gore': '🩸',
  'blood': '🩸',
  'flood': '🌊',
  'tsunami': '🌊',
  'biography': '📖',
  'historical fiction': '🏛️',
  'period drama': '🏛️',
  'ancient world': '🏺',
  'greek mythology': '🏺',
  'mythology': '🏺',
  'norse mythology': '⚔️',
  'pyramid': '🔺',
  'viking': '⚔️',
  'gladiator': '⚔️',
  'roman empire': '🏛️',
  'edo period': '🏯',
  'kung fu': '🥋',
  'martial arts': '🥋',
  'karate': '🥋',
  'boxer': '🥊',
  'dance competition': '💃',
  'singing competition': '🎤',
  'cooking competition': '🍳',
  'game show': '🎙️',
  'tv show': '📺',
  'sitcom': '😂',
  'stand-up comedy': '🎤',
  'dark comedy': '😂',
  'parody': '😂',
  'spoof': '😂',
  'satire': '😏',
  'slapstick comedy': '🤣',
  'romantic comedy': '❤️',
  'buddy comedy': '😂',
  'teen comedy': '🎒',
  'road movie': '🚗',
  'heist movie': '💰',
  'war drama': '⚔️',
  'political thriller': '🏛️',
  'spy thriller': '🕵️',
  'psychological thriller': '🧠',
  'serial killer thriller': '🔪',
  'supernatural thriller': '👻',
  'disaster movie': '🌋',
  'zombie apocalypse': '🧟',
  'vampire hunter': '🧛',
  'witch hunt': '🧙‍♀️',
  'exorcism': '✝️',
  'possession': '😈',
  'cult': '🕯️',
  'satanism': '😈',
  'occult': '🕯️',
  'ghost story': '👻',
  'time loop': '🔁',
  'multiverse': '🌀',
  'masked vigilante': '🦸',
  'vigilante': '🦸',
  'antihero': '😎',
  'drug cartel': '💰',
  'cartel': '💰',
  'drug dealer': '💊',
  'dea': '🕵️',
  'nuclear war': '☢️',
  'nuclear bomb': '☢️',
  'terrorism': '💣',
  'hostage': '🚨',
  'rescue': '🚁',
  'helicopter': '🚁',
  'tank': '🪖',
  'army': '🪖',
  'navy': '🚢',
  'marine': '🪖',
  'special forces': '🪖',
  'sniper': '🔫',
  'civil war': '⚔️',
  'american civil war': '⚔️',
  'gladiator combat': '⚔️',
  'adventure': '🧭',
  'exploration': '🧭',
  'expedition': '🧭',
  'safari': '🦁',
  'wildlife': '🦁',
  'nature': '🌿',
  'environment': '🌿',
  'climate change': '🌍',
  'pollution': '🏭',
  'factory': '🏭',
  'business': '💼',
  'corporate': '💼',
  'office': '💼',
  'workplace': '💼',
  'job': '💼',
  'unemployment': '🏚️',
  'stock market': '📈',
  'wall street': '📈',
  'bank': '🏦',
  'thief': '🦹',
  'pickpocket': '🦹',
  'burglar': '🦹',
  'police chase': '🚔',
  'car chase': '🚔',
  'chase': '🏃',
  'escape': '🏃',
  'prison escape': '⛓️',
  'court': '⚖️',
  'jury': '⚖️',
  'prosecutor': '⚖️',
  'defense attorney': '⚖️',
  'law firm': '⚖️',
  'detective agency': '🕵️',
  'private investigator': '🕵️',
  'murder mystery': '🔍',
  'whodunit': '🔍',
  'mystery': '🔍',
  'puzzle': '🧩',
  'riddle': '🧩',
  'escape room': '🔐',
  'game': '🎮',
  'board game': '🎲',
  'chess': '♟️',
  'cards': '🃏',
  'poker': '🃏',
  'casino heist': '🎰',
  'lottery': '🎰',
  'bar': '🍺',
  'nightclub': '🍸',
  'party': '🎉',
  'prom': '🎓',
  'birthday': '🎂',
  'holiday': '🏖️',
  'vacation': '🏖️',
  'beach': '🏖️',
  'summer': '☀️',
  'spring': '🌸',
  'autumn': '🍂',
  'rain': '🌧️',
  'fog': '🌫️',
  'desert island': '🏝️',
  'tropical': '🌴',
  'hurricane': '🌀',
  'drought': '🏜️',
  'famine': '🍞',
  'orphan': '👶',
  'orphanage': '🏠',
  'adoption': '👪',
  'pregnancy': '🤰',
  'birth': '👶',
  'infertility': '💔',
  'single mother': '👩‍👧',
  'single father': '👨‍👧',
  'divorce': '💔',
  'breakup': '💔',
  'unrequited love': '💔',
  'love triangle': '💔',
  'affair': '💔',
  'jealousy': '😒',
  'obsession': '🫀',
  'stalking': '👀',
  'betrayal': '🗡️',
  'best friend': '🤝',
  'female friendship': '👭',
  'male friendship': '👬',
  'sibling relationship': '👫',
  'brotherhood': '👬',
  'sisterhood': '👭',
  'mother son relationship': '👩‍👦',
  'father son relationship': '👨‍👦',
  'mother daughter relationship': '👩‍👧',
  'father daughter relationship': '👨‍👧',
  'husband wife relationship': '💑',
  'parent child relationship': '👪',
  'dysfunctional family': '👪',
  'family conflict': '👪',
  'family secrets': '🤫',
  'secret': '🤫',
  'lies': '🤥',
  'deception': '🎭',
  'conspiracy': '🕵️',
  'cover-up': '🕵️',
  'investigation': '🔍',
  'reporter': '📰',
  'newspaper': '📰',
  'magazine': '📰',
  'television': '📺',
  'tv': '📺',
  'film industry': '🎬',
  'movie star': '⭐',
  'fan': '👏',
  'fandom': '👏',
  'cosplay': '🎭',
  'convention': '🎪',
  'award': '🏆',
  'oscar': '🏆',
  'championship': '🏆',
  'athlete': '🏅',
  'olympics': '🥇',
  'marathon': '🏃',
  'boxing match': '🥊',
  'football team': '🏈',
  'soccer team': '⚽',
  'basketball team': '🏀',
  'baseball team': '⚾',
  'coach': '📋',
  'underdog': '🐕',
  'training': '💪',
  'gym': '🏋️',
  'bodybuilding': '💪',
  'ballet': '🩰',
  'orchestra': '🎻',
  'choir': '🎤',
  'rock band': '🎸',
  'hip hop': '🎤',
  'rap': '🎤',
  'jazz': '🎷',
  'country music': '🤠',
  'pop music': '🎤',
  'classical music': '🎻',
  'opera': '🎭',
  'theater': '🎭',
  'broadway': '🎭',
  'stage': '🎭',
  'poet': '📜',
  'poetry': '📜',
  'novel': '📖',
  'literature': '📚',
  'bookstore': '📚',
  'elf': '🧝',
  'dwarf': '🧔',
  'orc': '👹',
  'goblin': '👺',
  'troll': '🧌',
  'giant': '🗿',
  'unicorn': '🦄',
  'phoenix': '🔥',
  'centaur': '🐴',
  'pegasus': '🐴',
  'sea monster': '🦑',
  'kraken': '🦑',
  'octopus': '🐙',
  'crab': '🦀',
  'dolphin': '🐬',
  'turtle': '🐢',
  'frog': '🐸',
  'lizard': '🦎',
  'crocodile': '🐊',
  'alligator': '🐊',
  'panda': '🐼',
  'koala': '🐨',
  'kangaroo': '🦘',
  'giraffe': '🦒',
  'zebra': '🦓',
  'rhino': '🦏',
  'camel': '🐪',
  'donkey': '🫏',
  'pig': '🐖',
  'cow': '🐄',
  'sheep': '🐑',
  'goat': '🐐',
  'chicken': '🐔',
  'duck': '🦆',
  'owl': '🦉',
  'eagle': '🦅',
  'parrot': '🦜',
  'flamingo': '🦩',
  'swan': '🦢',
  'peacock': '🦚',
  'bat': '🦇',
  'fox': '🦊',
  'deer': '🦌',
  'rabbit': '🐇',
  'squirrel': '🐿️',
  'hedgehog': '🦔',
  'otter': '🦦',
  'seal': '🦭',
  'polar bear': '🐻‍❄️',
  'jellyfish': '🪼',
  'starfish': '⭐',
  'coral': '🪸',
  'shell': '🐚',
  'tree': '🌳',
  'flower': '🌸',
  'rose': '🌹',
  'sunflower': '🌻',
  'tulip': '🌷',
  'cactus': '🌵',
  'mushroom': '🍄',
  'leaf': '🍃',
  'fruit': '🍎',
  'apple': '🍎',
  'banana': '🍌',
  'orange': '🍊',
  'grape': '🍇',
  'strawberry': '🍓',
  'watermelon': '🍉',
  'pineapple': '🍍',
  'lemon': '🍋',
  'cherry': '🍒',
  'peach': '🍑',
  'pear': '🍐',
  'coconut': '🥥',
  'avocado': '🥑',
  'eggplant': '🍆',
  'carrot': '🥕',
  'broccoli': '🥦',
  'corn': '🌽',
  'potato': '🥔',
  'tomato': '🍅',
  'onion': '🧅',
  'garlic': '🧄',
  'pepper': '🌶️',
  'bread': '🍞',
  'cheese': '🧀',
  'egg': '🥚',
  'rice': '🍚',
  'pasta': '🍝',
  'pizza': '🍕',
  'burger': '🍔',
  'hot dog': '🌭',
  'taco': '🌮',
  'sushi': '🍣',
  'ramen': '🍜',
  'cake': '🍰',
  'cookie': '🍪',
  'chocolate': '🍫',
  'candy': '🍬',
  'ice cream': '🍨',
  'tea': '🍵',
  'beer': '🍺',
  'wine': '🍷',
  'cocktail': '🍸',
  'whiskey': '🥃',
  'champagne': '🍾',
  'water': '💧',
  'smoke': '💨',
  'lightning': '⚡',
  'thunder': '⛈️',
  'rainbow': '🌈',
  'star': '⭐',
  'sun': '☀️',
  'cloud': '☁️',
  'heart': '❤️',
  'broken heart': '💔',
  'kiss': '💋',
  'ring': '💍',
  'diamond': '💎',
  'map': '🗺️',
  'compass': '🧭',
  'binoculars': '🔭',
  'telescope': '🔭',
  'camera': '📷',
  'video camera': '📹',
  'microphone': '🎤',
  'headphones': '🎧',
  'laptop': '💻',
  'phone': '📱',
  'smartphone': '📱',
  'tablet': '📱',
  'keyboard': '⌨️',
  'mouse': '🖱️',
  'battery': '🔋',
  'light bulb': '💡',
  'flashlight': '🔦',
  'candle': '🕯️',
  'hourglass': '⌛',
  'calendar': '📅',
  'mailbox': '📬',
  'package': '📦',
  'gift': '🎁',
  'balloon': '🎈',
  'party popper': '🎉',
  'fireworks': '🎆',
  'christmas tree': '🎄',
  'jack-o-lantern': '🎃',
  'skull': '💀',
  'coffin': '⚰️',
  'cross': '✝️',
  'prayer': '🙏',
  'church': '⛪',
  'mosque': '🕌',
  'synagogue': '🕍',
  'temple': '🛕',
  'throne': '🪑',
  'tower': '🗼',
  'bridge': '🌉',
  'house': '🏠',
  'mansion': '🏚️',
  'apartment': '🏢',
  'office building': '🏢',
  'warehouse': '🏭',
  'airport': '✈️',
  'station': '🚉',
  'subway': '🚇',
  'bus': '🚌',
  'truck': '🚚',
  'taxi': '🚕',
  'police car': '🚔',
  'ambulance': '🚑',
  'fire truck': '🚒',
  'bicycle': '🚲',
  'scooter': '🛴',
  'boat': '⛵',
  'sailboat': '⛵',
  'cruise ship': '🛳️',
  'yacht': '🛥️',
  'rocket': '🚀',
  'ufo': '🛸',
  'satellite': '🛰️',
  'globe': '🌍',
  'world': '🌍',
  'earth': '🌍',
  'ice': '🧊',
  'lava': '🌋',
  'sand': '🏖️',
};

const PATTERNS = [
  [/^based on (a )?(novel|book)/, '📖'],
  [/^based on (a )?(comic|graphic novel)/, '💬'],
  [/^based on (a )?manga/, '📚'],
  [/^based on (a )?(video game|game)/, '🎮'],
  [/^based on (a )?(true story|true events)/, '📰'],
  [/^based on (a )?(play|musical)/, '🎭'],
  [/^based on (a )?(tv|television)/, '📺'],
  [/^based on (a )?(movie|film)/, '🎬'],
  [/^based on (a )?(toy|theme park)/, '🧸'],
  [/^based on (a )?(magazine|newspaper|article)/, '📰'],
  [/world war/, '⚔️'],
  [/vietnam war/, '🌴'],
  [/cold war/, '🧊'],
  [/new york/, '🗽'],
  [/los angeles/, '🌴'],
  [/san francisco/, '🌉'],
  [/london/, '🌉'],
  [/paris/, '🗼'],
  [/tokyo/, '🗼'],
  [/chicago/, '🏙️'],
  [/miami/, '🌴'],
  [/rio de janeiro/, '🇧🇷'],
  [/space travel|spaceship|outer space|astronaut/, '🚀'],
  [/time travel/, '⏳'],
  [/artificial intelligence/, '🤖'],
  [/serial killer/, '🔪'],
  [/martial arts|kung fu|karate/, '🥋'],
  [/high school|college|university/, '🎓'],
  [/mother daughter|mother son/, '👩‍👧'],
  [/father daughter|father son/, '👨‍👧'],
  [/husband wife/, '💑'],
  [/brother brother|brother sister|sister sister/, '👫'],
  [/coming of age/, '🌱'],
  [/haunted house/, '🏚️'],
  [/post.apocalyptic/, '☢️'],
  [/dystopian/, '☢️'],
  [/dinosaur/, '🦖'],
  [/vampire/, '🧛'],
  [/zombie/, '🧟'],
  [/pirate/, '🏴‍☠️'],
  [/superhero/, '🦸'],
];

const GENERIC = new Set([
  'based on novel or book',
  'based on comic',
  'based on comic book',
  'based on manga',
  'based on video game',
  'based on true story',
  'based on play or musical',
  'sequel',
  'remake',
  'reboot',
  'spin off',
  'aftercreditsstinger',
  'duringcreditsstinger',
  'friendship',
  'best friend',
  'female friendship',
  'sports',
  'love',
  'family',
  'murder',
  'death',
  'revenge',
  'survival',
  'dramatic',
  'hilarious',
  'amused',
  'satire',
  'parody',
  'spoof',
  'dark comedy',
  'buddy comedy',
  'romantic comedy',
  'slapstick comedy',
  'teen comedy',
  'psychological',
  'macabre',
  'whimsical',
  'nostalgic',
  'playful',
  'excited',
  'joyful',
  'comforting',
  'celebratory',
  'ambiguous',
  'complex',
  'bold',
  'blunt',
  'aggressive',
  'assertive',
  'frantic',
  'absurd',
  'audacious',
  'admiring',
  'embarrassed',
  'exuberant',
  'irreverent',
  'cautionary',
]);

const LOW = new Set([
  'court',
  'loss of loved one',
  'dying and death',
  'professor',
  'scholar',
  'ministry',
  'prophecy',
  'occult',
  'black magic',
  'sorcery',
  'child hero',
  'cliché',
  'ambiguous',
  'vibrant',
  'enthusiastic',
  'arrogant',
  'cheerful',
  'disdainful',
  'frustrated',
  'depressing',
  'tragic',
  'angry',
  'slow burn romance',
  'fish out of water',
  'gossip',
  'clique',
  'public humiliation',
  'math teacher',
  'math genius',
  'mean girls',
  'mean girl',
  'teenage life',
  'teenage girl',
  'teenage friendship',
  'teenage romance',
  'new girl at school',
  'high school rivalry',
  'manipulative friend',
  'female bully',
  'exploitation of friendship',
  'former best friend',
]);

const GENRE_EMOJI = {
  28: '💥',
  12: '🧭',
  16: '🎨',
  35: '😂',
  80: '🕵️',
  99: '🎥',
  18: '🎭',
  10751: '👨‍👩‍👧',
  14: '🧙',
  36: '🏛️',
  27: '👻',
  10402: '🎵',
  9648: '🔍',
  10749: '❤️',
  878: '🚀',
  10770: '📺',
  53: '🔪',
  10752: '⚔️',
  37: '🤠',
  10762: '🧸',
  10759: '💥',
  10765: '🚀',
  10768: '⚔️',
};

const PT_WORDS = /\b(não|uma|um|para|com|que|você|ele|ela|eles|elas|isso|este|esta|seu|sua|dos|das|por|mais|como|mas|foi|são|está|ser|ter|quando|onde|quem|mundo|vida|amor|noite|dia|história|depois|antes|sobre|entre|pelo|pela|ao|aos|às|nós|nos|na|no|nas|nos|em|de|do|da|os|as|se|é|já|nunca|sempre|também|muito|pouco|só|aqui|ali|então|porque|enquanto|até|sem|sob|contra|desde|durante|após)\b/gi;
const EN_WORDS = /\b(the|and|of|to|in|is|are|for|with|that|this|you|he|she|they|his|her|from|on|at|as|by|it|its|not|but|what|who|when|where|how|was|were|be|been|has|have|had|will|would|can|could|should|their|our|your|we|us|them|there|here|just|about|into|over|after|before|more|than|then|than|these|those)\b/gi;

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an|o|a|os|as|um|uma)\s+/, '');
}

function clean(text) {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"“”'‘’]+|[\s"“”'‘’]+$/g, '')
    .trim();
}

function looksPortuguese(text) {
  const pt = (text.match(PT_WORDS) ?? []).length;
  const en = (text.match(EN_WORDS) ?? []).length;
  if (/[ãõçáéíóúâêôà]/i.test(text)) return pt >= 1 || en === 0;
  return pt >= 1 && pt >= en;
}

function isLatin(text) {
  return /[A-Za-zÀ-ÿ]/.test(text) && !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
}

const stopTokens = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'de', 'da', 'do', 'das', 'dos']);

async function loadGemoji() {
  try {
    if (!existsSync(GEMOJI_CACHE)) {
      const res = await fetch('https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json');
      if (!res.ok) return null;
      writeFileSync(GEMOJI_CACHE, await res.text());
    }
    const data = JSON.parse(readFileSync(GEMOJI_CACHE, 'utf8'));
    const index = new Map();
    for (const e of data) {
      if (!e.emoji || ['Smileys & Emotion'].includes(e.category)) continue;
      for (const key of [...(e.aliases ?? []), ...(e.tags ?? [])]) {
        const k = String(key).toLowerCase();
        if (!index.has(k)) index.set(k, e.emoji);
      }
    }
    return index;
  } catch {
    return null;
  }
}

const gemoji = await loadGemoji();

function mapKeyword(raw) {
  const k = raw.toLowerCase().trim();
  if (EXACT[k]) return EXACT[k];
  for (const [re, emoji] of PATTERNS) if (re.test(k)) return emoji;
  if (gemoji) {
    if (gemoji.has(k)) return gemoji.get(k);
    const words = k.split(' ').filter((w) => w.length >= 3 && !stopTokens.has(w));
    if (words.length === 1 && gemoji.has(words[0])) return gemoji.get(words[0]);
  }
  return null;
}

function words(text) {
  return text.split(/\s+/).filter(Boolean);
}

function phraseMentionsTitle(text, titles) {
  const n = normalize(text);
  for (const title of titles) {
    const t = normalize(title);
    if (!t) continue;
    if (t.length < 4) {
      if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n)) return true;
    } else if (n.includes(t)) return true;
    const base = t.split(' ').slice(0, 2).join(' ');
    if (base.length >= 6 && n.includes(base) && /[:!?-]/.test(title)) return true;
    const parts = title
      .split(/\s*:\s*|\s+[-–—]\s+/)
      .map((p) => normalize(p))
      .filter((p) => p.length >= 5);
    if (parts.some((p) => n.includes(p))) return true;
  }
  return false;
}

function isTruncated(s) {
  const last = s.split(/\s+/).pop() ?? '';
  return /(?:\b[A-Z]\.){1,3}$/.test(last) || /^(sr|sra|dr|dra|mr|mrs|ms|st|prof|etc)\.$/i.test(last);
}

function unbalanced(s) {
  const quotes = (s.match(/[\"“”]/g) ?? []).length;
  const open = (s.match(/\(/g) ?? []).length;
  const close = (s.match(/\)/g) ?? []).length;
  return quotes % 2 === 1 || open !== close;
}

function isMetadata(s) {
  return (
    /\(\s*\d+\s*\)\s*epis[óo]dios?/i.test(s) ||
    /\b\d+\s*epis[óo]dios?\b/i.test(s) ||
    /\b(?:temporada|epis[óo]dio)\s*\d+\b/i.test(s) ||
    /\bS\d{1,2}\s*E\d{1,3}\b/i.test(s) ||
    /^(?:s[ée]rie|anima[çc][ãa]o|document[áa]rio|miniss[ée]rie|reality(?:\s+show)?|talk\s+show|programa|novela)\b/i.test(s)
  );
}

function pickPhrase(detail) {
  const titles = unique([detail.title, detail.original, ...detail.aliases]);
  const isTitle = (text) => (detail.allTitles ?? []).some((t) => normalize(t) === normalize(text));
  const tagline = clean(detail.tagline);
  if (
    tagline.length >= 15 &&
    tagline.length <= 160 &&
    words(tagline).length >= 4 &&
    !isTruncated(tagline) &&
    !isMetadata(tagline) &&
    !unbalanced(tagline) &&
    !phraseMentionsTitle(tagline, titles) &&
    !isTitle(tagline) &&
    looksPortuguese(tagline)
  ) {
    return tagline;
  }
  const overview = clean(detail.overview);
  if (!overview) return null;
  const sentences = overview.split(/(?<=[.!?])\s+/).slice(0, 3);
  for (const sentence of sentences) {
    const s = clean(sentence);
    if (
      s.length >= 30 &&
      s.length <= 160 &&
      words(s).length >= 5 &&
      !isTruncated(s) &&
      !isMetadata(s) &&
      !unbalanced(s) &&
      !/^[a-zà-ÿ]/.test(s) &&
      !phraseMentionsTitle(s, titles) &&
      !isTitle(s) &&
      looksPortuguese(s) &&
      !/https?:|www\./i.test(s)
    ) {
      return s;
    }
  }
  return null;
}

function buildEmoji(detail, freq) {
  const seen = new Map();
  for (const raw of detail.keywords) {
    const emoji = mapKeyword(raw);
    if (!emoji) continue;
    const n = normalize(raw);
    if (!seen.has(emoji)) seen.set(emoji, { emoji, keyword: n, generic: GENERIC.has(n), freq: freq.get(n) ?? 1 });
  }
  const mapped = [...seen.values()];
  const high = mapped.filter((m) => !m.generic && !LOW.has(m.keyword));
  const low = mapped.filter((m) => !m.generic && LOW.has(m.keyword));
  const generic = mapped.filter((m) => m.generic);
  const picked = [];
  const used = new Set();
  const push = (m) => {
    if (picked.length >= 4 || used.has(m.emoji)) return;
    picked.push(m);
    used.add(m.emoji);
  };
  for (const g of detail.genres) {
    if (picked.length >= 2) break;
    const emoji = GENRE_EMOJI[g.id];
    if (emoji) push({ emoji, generic: true });
  }
  for (const m of high) {
    if (picked.length >= 4) break;
    push(m);
  }
  for (const m of low) push(m);
  for (const m of generic) push(m);
  const specific = picked.filter((m) => !m.generic).length;
  if (specific < 2 || picked.length < 3) return null;
  return picked.map((m) => m.emoji).join('');
}

function score(detail) {
  return Math.log10(1 + detail.vote_count) * 2 + Math.log10(1 + detail.popularity);
}

async function collectCandidates(kind) {
  const excluded = kind === 'movie' ? '99' : '99,10763,10764,10766,10767';
  const pages = [
    { path: `/${kind}/popular`, count: 160 },
    { path: `/${kind}/top_rated`, count: 130 },
    { path: `/discover/${kind}`, count: 130, params: { sort_by: 'vote_count.desc', 'vote_count.gte': 150, without_genres: excluded } },
  ];
  const items = new Map();
  for (const { path, count, params } of pages) {
    for (let page = 1; page <= count; page++) {
      let data;
      try {
        data = await tmdb(path, { page, ...params });
      } catch {
        break;
      }
      for (const r of data.results ?? []) {
        if (!r?.id || r.adult) continue;
        if ((r.genre_ids ?? []).some((g) => EXCLUDED_GENRES.has(g))) continue;
        if (!(r.title ?? r.name)) continue;
        items.set(r.id, r);
        if (items.size >= MAX_PER_KIND) break;
      }
      if (items.size >= MAX_PER_KIND) break;
    }
    if (items.size >= MAX_PER_KIND) break;
  }
  return [...items.values()].slice(0, MAX_PER_KIND);
}

async function fetchDetail(kind, id, englishOriginal) {
  const append = englishOriginal ? 'keywords,alternative_titles' : 'keywords,alternative_titles,translations';
  return tmdb(`/${kind}/${id}`, { append_to_response: append });
}

function toWork(kind, detail) {
  const isMovie = kind === 'movie';
  const title = clean(isMovie ? detail.title : detail.name);
  const original = clean(isMovie ? detail.original_title : detail.original_name);
  const allAlt = (detail.alternative_titles?.titles ?? detail.alternative_titles?.results ?? [])
    .map((x) => clean(x.title))
    .filter(Boolean);
  const alt = (detail.alternative_titles?.titles ?? detail.alternative_titles?.results ?? [])
    .filter((x) => ['US', 'GB', 'BR'].includes(x.iso_3166_1) && x.title && isLatin(x.title))
    .map((x) => clean(x.title));
  const translated = (detail.translations?.translations ?? [])
    .filter((x) => x.iso_639_1 === 'en')
    .map((x) => clean(x.data?.title ?? x.data?.name))
    .filter((x) => x && isLatin(x));
  const keywords = (detail.keywords?.keywords ?? detail.keywords?.results ?? []).map((k) => k.name);
  const date = isMovie ? detail.release_date : detail.first_air_date;
  return {
    id: detail.id,
    type: isMovie ? 'movie' : 'series',
    title,
    original,
    aliases: unique([original, ...translated, ...alt]).filter((a) => normalize(a) !== normalize(title)),
    allTitles: unique([title, original, ...allAlt, ...translated]),
    year: date ? Number(date.slice(0, 4)) : undefined,
    overview: clean(detail.overview),
    tagline: clean(detail.tagline),
    keywords,
    genres: detail.genres ?? [],
    voteCount: detail.vote_count ?? 0,
    popularity: detail.popularity ?? 0,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

console.log('Coletando candidatos no TMDB...');
const [movieCandidates, tvCandidates] = await Promise.all([collectCandidates('movie'), collectCandidates('tv')]);
console.log(`Candidatos: ${movieCandidates.length} filmes, ${tvCandidates.length} séries`);

const known = new Set();
if (existsSync(DATA('works.json'))) {
  const works = JSON.parse(readFileSync(DATA('works.json'), 'utf8'));
  for (const w of works) {
    if (w.tmdbId) known.add(w.tmdbId);
    if (w.title) known.add(`title:${normalize(w.title)}`);
  }
}
if (existsSync(DATA('images.json'))) {
  const images = JSON.parse(readFileSync(DATA('images.json'), 'utf8'));
  for (const v of Object.values(images)) if (v.tmdbId) known.add(v.tmdbId);
}
for (const q of (await import('../src/data/questions.ts')).QUESTIONS) {
  if (q.answers?.[0]) known.add(`title:${normalize(q.answers[0])}`);
}

const candidates = [...movieCandidates.map((r) => ['movie', r]), ...tvCandidates.map((r) => ['tv', r])].filter(
  ([, r]) => !known.has(r.id),
);
console.log(`Buscando detalhes de ${candidates.length} obras...`);

let done = 0;
const details = [];
await mapLimit(candidates, CONCURRENCY, async ([kind, item]) => {
  try {
    const detail = await fetchDetail(kind, item.id, item.original_language === 'en');
    if (detail?.id && (detail.title ?? detail.name)) details.push(toWork(kind, detail));
  } catch {
  }
  done++;
  if (done % 200 === 0) console.log(`  detalhes: ${done}/${candidates.length}`);
});

console.log(`Detalhes carregados: ${details.length}`);
const freq = new Map();
for (const w of details) {
  for (const k of new Set(w.keywords)) {
    const n = normalize(k);
    freq.set(n, (freq.get(n) ?? 0) + 1);
  }
}

const emojiCandidates = [];
const phraseCandidates = [];
for (const w of details) {
  const clue = buildEmoji(w, freq);
  if (clue) emojiCandidates.push({ w, clue });
  const phrase = pickPhrase(w);
  if (phrase) phraseCandidates.push({ w, clue: phrase });
}

console.log(`Candidatos: ${emojiCandidates.length} emojis, ${phraseCandidates.length} frases`);

function answersOf(w) {
  return unique([w.title, ...w.aliases]).slice(0, 6);
}

const usedWorks = new Set();
const usedTitles = new Set(
  [...known]
    .filter((k) => typeof k === 'string' && k.startsWith('title:'))
    .map((k) => k.slice('title:'.length)),
);
const usedClues = new Set();
const emojiQuestions = [];
const phraseQuestions = [];

function canUse(c, clueType) {
  const n = normalize(c.w.title);
  const clueKey = clueType === 'emoji' ? c.clue : normalize(c.clue);
  return !usedWorks.has(c.w.id) && !usedTitles.has(n) && !usedClues.has(clueKey);
}

function add(c, clueType, out) {
  const n = normalize(c.w.title);
  const clueKey = clueType === 'emoji' ? c.clue : normalize(c.clue);
  usedWorks.add(c.w.id);
  usedTitles.add(n);
  usedClues.add(clueKey);
  out.push({
    id: `${clueType === 'emoji' ? 'emoji' : 'frase'}-${c.w.id}`,
    type: c.w.type,
    difficulty: 'medium',
    clueType,
    clue: c.clue,
    answers: answersOf(c.w),
    year: c.w.year,
  });
}

const phraseSorted = [...phraseCandidates].sort((a, b) => score({ vote_count: b.w.voteCount, popularity: b.w.popularity }) - score({ vote_count: a.w.voteCount, popularity: a.w.popularity }));
for (const c of phraseSorted) {
  if (phraseQuestions.length >= TARGET_PHRASE) break;
  if (canUse(c, 'phrase')) add(c, 'phrase', phraseQuestions);
}

const emojiSorted = [...emojiCandidates].sort((a, b) => score({ vote_count: b.w.voteCount, popularity: b.w.popularity }) - score({ vote_count: a.w.voteCount, popularity: a.w.popularity }));
for (const c of emojiSorted) {
  if (emojiQuestions.length >= TARGET_EMOJI) break;
  if (canUse(c, 'emoji')) add(c, 'emoji', emojiQuestions);
}

if (emojiQuestions.length < TARGET_EMOJI || phraseQuestions.length < TARGET_PHRASE) {
  for (const c of phraseSorted) {
    if (phraseQuestions.length >= TARGET_PHRASE) break;
    if (canUse(c, 'phrase')) add(c, 'phrase', phraseQuestions);
  }
}

if (emojiQuestions.length < TARGET_EMOJI || phraseQuestions.length < TARGET_PHRASE) {
  for (const c of emojiSorted) {
    if (emojiQuestions.length >= TARGET_EMOJI) break;
    if (canUse(c, 'emoji')) add(c, 'emoji', emojiQuestions);
  }
}

console.log(`Geradas: ${emojiQuestions.length} emojis, ${phraseQuestions.length} frases`);
if (emojiQuestions.length < TARGET_EMOJI) console.warn(`Faltaram ${TARGET_EMOJI - emojiQuestions.length} emojis`);
if (phraseQuestions.length < TARGET_PHRASE) console.warn(`Faltaram ${TARGET_PHRASE - phraseQuestions.length} frases`);

const markDifficulty = (arr) => {
  const easy = Math.round(arr.length * 0.3);
  const medium = Math.round(arr.length * 0.7);
  arr.forEach((q, i) => {
    q.difficulty = i < easy ? 'easy' : i < medium ? 'medium' : 'hard';
  });
};
markDifficulty(phraseQuestions);
markDifficulty(emojiQuestions);

writeFileSync(DATA('emojiQuestions.json'), JSON.stringify(emojiQuestions, null, 2) + '\n', 'utf8');
writeFileSync(DATA('phraseQuestions.json'), JSON.stringify(phraseQuestions, null, 2) + '\n', 'utf8');

console.log('Arquivos gravados em src/data/emojiQuestions.json e src/data/phraseQuestions.json');
console.log('\nAmostra de emojis:');
for (const q of emojiQuestions.slice(0, 8)) console.log(`  ${q.clue}  ->  ${q.answers[0]} (${q.year ?? 's/ano'})`);
console.log('\nAmostra de frases:');
for (const q of phraseQuestions.slice(0, 8)) console.log(`  ${q.clue}  ->  ${q.answers[0]} (${q.year ?? 's/ano'})`);
