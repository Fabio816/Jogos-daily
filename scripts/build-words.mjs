// Gera as listas de palavras dos jogos Termo e Bomb Party a partir de fserb/pt-br (licença MIT):
// https://github.com/fserb/pt-br  (léxico de 145 mil entradas + frequência de uso)
// Saídas em public/data/ (servidas como arquivos estáticos pelo Hosting).
// Uso: node scripts/build-words.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/fserb/pt-br/master/';
const OUT = (f) => fileURLToPath(new URL(`../public/data/${f}`, import.meta.url));

const TARGET_COUNT = 2000; // palavras secretas do Termo
const TERMO_COMMON_RANK = 2000; // daqui para baixo a frequência já traz nomes/estrangeirismos demais
const BOMB_WORDS = 60000; // palavras comuns usadas no Bomb Party
const SYLLABLE_MIN_WORDS = 400; // sílaba precisa existir em pelo menos N palavras

// Palavras funcionais que não fazem bom alvo de adivinhação
const STOP = new Set([
  'entao', 'ainda', 'apos', 'aqui', 'ali', 'onde', 'algum', 'alguma', 'outra', 'outro',
  'pelos', 'pelas', 'pelo', 'pela', 'para', 'porem', 'mesmo', 'mesma', 'cada', 'muito',
  'muita', 'tanto', 'tanta', 'quais', 'qual', 'aquele', 'aquela', 'todos', 'todas',
  'cujo', 'cuja', 'tendo', 'sendo', 'estar', 'ainda', 'pouco', 'pouca', 'nosso', 'nossa',
  'vosso', 'vossa', 'essas', 'esses', 'nesse', 'nessa', 'desse', 'dessa', 'aquilo',
  'sobre', 'entre', 'assim', 'minha', 'minhas', 'meus', 'seus', 'suas', 'isso', 'isto',
  'esta', 'este', 'esse', 'essa', 'desta', 'deste', 'nele', 'nela', 'dele', 'dela', 'numa',
  'num', 'nisso', 'disso', 'daquele', 'daquela', 'deles', 'delas', 'haver', 'houve', 'havia',
]);

// Nomes próprios, marcas, estrangeirismos e termos vulgares que não queremos nos jogos.
// A lista de frequência vem de legendas e traz muita coisa assim; o filtro manual mantém o jogo limpo.
const BLOCK = new Set(`
  maria jesus silva bruno japao goias ceara bahia piaui amapa braga sousa chico nunes moura
  abreu celso egito chile marta julio diogo joana laura mauro queen henry diana milao bauru
  simao luzia judas macau lucio siena volvo jeova lauro veiga timor elena xerox avila tarso
  cairo mafra bangu teres apolo oxala araxa tulio erica vilar romao ibero tesla urano reich
  quito oscar pirai islao leone aruba parma edipo icaro copel penha souto amaro joane fermi
  morse plato dante romeu venus nobel atena orfeu midas iansa xango paris miami dubai madri
  viena guine malta congo libia siria aires lopes lucas paulo pedro mario andre alice sofia
  julia luana lucia tiago vanda vitor renan carla lidia tania nadia sonia kelly carol alana
  tiete guacu jacui belem iemen nepal butao niger gabao chade sudao whats skype yahoo nokia
  ifood linux apple honda hindu jihad
  light black login flash suite green stand blues cover clean staff break hobby rally front
  paper pixel close lobby remix round swing coach match rugby logs drink quota strip relax
  still rouge mixer timer derby ferry buggy gnome curry input twist ethos catch drops sheik
  lycra kraft coupe blend suede crush hedge shoyu plush dolly penny drive mouse white brown
  smart style trend basic focus prime power score level click print admin email inbox debug
  coder brand agile scrum pitch check test start stop
  merda porra bunda tesao seios penis porno foder chupa bosta peido mijar cagar cagao viado
  vadia carai putas puto xota sacana trepa bugre
  trofa irina zorro conca bumba trips zinho caete rasca fucar greta ofuro squid vanda logon
  modus trace honor macom avare tutti rebel polis berta ceres ratio sinha numas canon panca
  matao dacar delia ganda acari alcar amore antao argel bessa blast blush borgo caico celio
  cesar chica color corao corsa crato cusco dunga error flame hacer jango parco parma swell
  trial train troia weber
`.trim().split(/\s+/));

/** Minúsculas, sem acento, só a-z. Retorna null para palavras com hífen, espaço, número etc. */
function normalize(word) {
  const clean = word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /^[a-z]+$/.test(clean) ? clean : null;
}

async function text(file) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`${res.status} ao baixar ${file}`);
  return res.text();
}

console.log('Baixando léxico e frequências...');
const lexicoRaw = await text('lexico');
const icfRaw = await text('icf');

// Léxico normalizado (conjunto de palavras válidas)
const lexicon = new Set();
for (const line of lexicoRaw.split('\n')) {
  const w = normalize(line.trim());
  if (w) lexicon.add(w);
}

// Frequência: a primeira ocorrência de cada palavra (lista já vem ordenada por frequência)
const ranked = [];
const seen = new Set();
for (const line of icfRaw.split('\n')) {
  const word = line.split(',')[0]?.trim();
  const w = word && normalize(word);
  if (w && lexicon.has(w) && !seen.has(w)) {
    seen.add(w);
    ranked.push(w);
  }
}
console.log(`Léxico: ${lexicon.size} palavras | ranqueadas por frequência: ${ranked.length}`);

// ---------- Termo ----------
// Universo: só as 5 letras mais frequentes. Assim nenhum alvo/palpite vem de cauda obscura.
const common5 = ranked.filter((w) => w.length === 5).slice(0, TERMO_COMMON_RANK);
const targets = common5.filter((w) => !STOP.has(w) && !BLOCK.has(w)).slice(0, TARGET_COUNT);
const termoValid = common5.filter((w) => !BLOCK.has(w)).sort();

// ---------- Bomb Party ----------
const bombWords = ranked.filter((w) => w.length >= 3).slice(0, BOMB_WORDS);
const pairCount = new Map();
for (const w of bombWords) {
  const pairs = new Set();
  for (let i = 0; i < w.length - 1; i++) pairs.add(w.slice(i, i + 2));
  for (const p of pairs) pairCount.set(p, (pairCount.get(p) ?? 0) + 1);
}
const syllables = [...pairCount.entries()]
  .filter(([, n]) => n >= SYLLABLE_MIN_WORDS)
  .map(([p]) => p)
  .sort();

mkdirSync(fileURLToPath(new URL('../public/data/', import.meta.url)), { recursive: true });
writeFileSync(OUT('termo-alvos.json'), JSON.stringify(targets) + '\n', 'utf-8');
writeFileSync(OUT('termo-palavras.txt'), termoValid.join('\n') + '\n', 'utf-8');
writeFileSync(OUT('bomb-palavras.txt'), bombWords.join('\n') + '\n', 'utf-8');
writeFileSync(OUT('bomb-silabas.json'), JSON.stringify(syllables) + '\n', 'utf-8');

console.log(`Termo: ${targets.length} alvos, ${termoValid.length} palavras válidas de 5 letras`);
console.log(`Bomb Party: ${bombWords.length} palavras, ${syllables.length} sílabas`);
console.log(`Exemplos de alvo: ${targets.slice(0, 12).join(', ')}`);
console.log(`Exemplos de sílaba: ${syllables.slice(0, 15).join(', ')}`);
