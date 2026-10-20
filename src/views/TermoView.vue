<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BrandLogo from '../components/BrandLogo.vue';
import RankingPanel from '../components/RankingPanel.vue';
import TermoKeyboard from '../components/TermoKeyboard.vue';
import TermoMulti from '../components/TermoMulti.vue';
import SettingsDialog from '../components/SettingsDialog.vue';
import { ensureSignedIn } from '../firebase';
import { addRankingPoints } from '../lib/ranking';
import { applyGame, isLost, isWon, marksPerBoard, type GameState } from '../games/termo/game';
import {
  BOARD_LABEL,
  BOARD_OPTIONS,
  MAX_WORDS,
  MIN_TRIES,
  MIN_WORDS,
  WORD_LEN,
  clampTries,
  isValidGuess,
  maxTriesFor,
  normalizeWord,
  pointsFor,
  type Mark,
} from '../games/termo/logic';
import { loadTermoData, type TermoData } from '../games/termo/data';
import {
  createTermoRoom,
  joinTermoRoom,
  sendTermoGuess,
  startTermoRound,
  subscribeTermoRoom,
  updateTermoSettings,
} from '../games/termo/room';
import {
  clampSettings,
  DEFAULT_TERMO_SETTINGS,
  pickWords,
  pointsOf,
  type TermoRoom,
  type TermoSettings,
} from '../games/termo/state';

type Tab = 'solo' | 'sala';
const tab = ref<Tab>('solo');
const data = ref<TermoData | null>(null);
const loadError = ref('');
const uid = ref('');
const name = ref(localStorage.getItem('qeo:name') ?? '');
const message = ref('');

// Configuração escolhida pelo jogador (vale para o solo e para criar sala).
const CONFIG_KEY = 'termo:config';
const config = ref<TermoSettings>(loadConfig());

function loadConfig(): TermoSettings {
  try {
    return clampSettings(JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') as Partial<TermoSettings>);
  } catch {
    return { ...DEFAULT_TERMO_SETTINGS };
  }
}

watch(config, (c) => localStorage.setItem(CONFIG_KEY, JSON.stringify(c)), { deep: true });

/** Atualiza uma configuração e mantém o número de tentativas dentro do limite do modo. */
function changeConfig(partial: Partial<TermoSettings>) {
  config.value = clampSettings({ ...config.value, ...partial });
}

function numberFrom(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}

const boardOptions = BOARD_OPTIONS;

function summarize(s: TermoSettings): string {
  return `${BOARD_LABEL[s.boards]} · ${s.words} rodada(s) · ${s.tries} tentativas`;
}

// ---------- solo ----------
const SOLO_USED_KEY = 'termo:usadas';
const soloActive = ref(false);
const soloOver = ref(false);
const soloIndex = ref(0); // rodada atual (1..words)
const soloTotal = ref(0);
const soloGame = ref<GameState | null>(null);
const soloTyping = ref<string[]>(emptyTyping());
const soloCursor = ref(0);
const soloStatus = ref<'playing' | 'won' | 'lost'>('playing');

function emptyTyping(): string[] {
  return Array<string>(WORD_LEN).fill('');
}

function soloUsedRecord(): Record<string, boolean> {
  try {
    const list = JSON.parse(localStorage.getItem(SOLO_USED_KEY) ?? '[]') as string[];
    return Object.fromEntries(list.map((w) => [w, true]));
  } catch {
    return {};
  }
}

/** Sorteia as palavras da rodada. Quando o banco esgota, recomeça o ciclo. */
function pickSoloWords(count: number): string[] | undefined {
  if (!data.value) return undefined;
  let used = soloUsedRecord();
  let words = pickWords(data.value.targets, used, count);
  if (!words) {
    used = {};
    words = pickWords(data.value.targets, used, count);
  }
  if (words) {
    localStorage.setItem(SOLO_USED_KEY, JSON.stringify([...Object.keys(used), ...words]));
  }
  return words;
}

function startSolo() {
  soloActive.value = true;
  soloOver.value = false;
  soloIndex.value = 0;
  soloTotal.value = 0;
  nextSoloRound();
}

function nextSoloRound() {
  const words = pickSoloWords(config.value.boards);
  if (!words) return;
  soloIndex.value += 1;
  soloGame.value = { words, guesses: [], tries: config.value.tries };
  soloTyping.value = emptyTyping();
  soloCursor.value = 0;
  soloStatus.value = 'playing';
  message.value = '';
}

async function endSoloRound(won: boolean) {
  soloStatus.value = won ? 'won' : 'lost';
  const g = soloGame.value!;
  const points = won ? pointsFor(g.guesses.length, g.tries) * config.value.boards : 0;
  soloTotal.value += points;
  if (uid.value) {
    await addRankingPoints(uid.value, name.value.trim() || 'Jogador', points).catch(() => {});
  }
}

function soloNext() {
  if (soloIndex.value >= config.value.words) {
    soloOver.value = true;
    soloActive.value = false;
    return;
  }
  nextSoloRound();
}

// ---------- sala ----------
const code = ref('');
const joinCode = ref('');
const room = ref<TermoRoom | null>(null);
const roomTyping = ref<string[]>(emptyTyping());
const roomCursor = ref(0);
const busy = ref(false);
let unsubRoom: (() => void) | null = null;

const me = computed(() => (room.value && uid.value ? room.value.players[uid.value] : undefined));
const roundWords = computed(() => room.value?.round?.words ?? []);
const boards = computed(() => room.value?.settings.boards ?? config.value.boards);
const tries = computed(() => room.value?.settings.tries ?? config.value.tries);
const isHost = computed(() => !!room.value && room.value.hostUid === uid.value);
const roundOver = computed(() => room.value?.round?.status === 'done');
const roomCanType = computed(
  () =>
    !!room.value?.round &&
    room.value.round.status === 'playing' &&
    !!me.value &&
    !me.value.solved &&
    me.value.guesses.length < tries.value,
);
const winnerName = computed(() => {
  const w = room.value?.round?.winnerUid;
  return w ? (room.value?.players[w]?.name ?? '?') : null;
});
const others = computed(() =>
  Object.entries(room.value?.players ?? {})
    .filter(([id]) => id !== uid.value)
    .map(([id, p]) => ({ id, ...p })),
);
const standings = computed(() =>
  Object.entries(room.value?.players ?? {})
    .map(([id, p]) => ({ id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score),
);

// Registra no ranking global os pontos do jogador ao fim de cada rodada (uma vez).
watch(
  () => room.value?.round,
  (round) => {
    if (!round || round.status !== 'done' || !me.value || !uid.value || !room.value) return;
    if (me.value.guesses.length === 0) return;
    const key = `termo:rec:${code.value}:${round.n}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const pts = pointsOf(me.value, room.value.settings.tries, room.value.settings.boards);
    addRankingPoints(uid.value, name.value.trim() || 'Jogador', pts).catch(() => {});
  },
);

async function enterRoom(roomCode: string) {
  code.value = roomCode;
  unsubRoom?.();
  unsubRoom = subscribeTermoRoom(roomCode, (r) => {
    room.value = r;
  });
}

async function runRoomAction(task: () => Promise<void>) {
  message.value = '';
  if (!name.value.trim()) {
    message.value = 'Digite seu nome primeiro.';
    return;
  }
  busy.value = true;
  try {
    await task();
  } catch (err) {
    message.value = err instanceof Error ? err.message : 'Erro inesperado.';
  } finally {
    busy.value = false;
  }
}

function createRoom() {
  return runRoomAction(async () => {
    localStorage.setItem('qeo:name', name.value.trim());
    await enterRoom(await createTermoRoom(name.value.trim(), config.value));
  });
}

function joinRoom() {
  return runRoomAction(async () => {
    const target = joinCode.value.trim().toUpperCase();
    if (!target) throw new Error('Digite o código da sala.');
    localStorage.setItem('qeo:name', name.value.trim());
    await joinTermoRoom(target, name.value.trim());
    await enterRoom(target);
  });
}

function nextRoomRound() {
  if (!data.value) return;
  return runRoomAction(async () => {
    await startTermoRound(code.value, data.value!.targets);
  });
}

/** Altera a configuração da sala (só o host, só no lobby). */
function changeRoomSettings(partial: Partial<TermoSettings>) {
  if (!room.value || !isHost.value) return;
  const next = clampSettings({ ...room.value.settings, ...partial });
  return runRoomAction(async () => {
    await updateTermoSettings(code.value, next);
  });
}

function leaveRoom() {
  unsubRoom?.();
  unsubRoom = null;
  room.value = null;
  code.value = '';
  roomTyping.value = emptyTyping();
  roomCursor.value = 0;
}

// ---------- digitação (teclado físico e na tela) ----------

function activeTyping(): {
  get: () => string[];
  set: (v: string[]) => void;
  cursor: () => number;
  setCursor: (v: number) => void;
  canType: boolean;
} {
  if (tab.value === 'solo') {
    return {
      get: () => soloTyping.value,
      set: (v) => (soloTyping.value = v),
      cursor: () => soloCursor.value,
      setCursor: (v) => (soloCursor.value = v),
      canType: soloActive.value && soloStatus.value === 'playing' && !!soloGame.value,
    };
  }
  return {
    get: () => roomTyping.value,
    set: (v) => (roomTyping.value = v),
    cursor: () => roomCursor.value,
    setCursor: (v) => (roomCursor.value = v),
    canType: roomCanType.value,
  };
}

/** Seleciona a célula onde a próxima letra será digitada. */
function moveCursor(index: number) {
  const t = activeTyping();
  if (!t.canType) return;
  t.setCursor(Math.max(0, Math.min(WORD_LEN - 1, index)));
}

function typeLetter(ch: string) {
  const t = activeTyping();
  if (!t.canType) return;
  const letter = normalizeWord(ch);
  const pos = t.cursor();
  if (!letter || pos >= WORD_LEN) return;
  const letters = [...t.get()];
  letters[pos] = letter;
  t.set(letters);
  t.setCursor(pos + 1);
  message.value = '';
}

function backspace() {
  const t = activeTyping();
  if (!t.canType || t.cursor() <= 0) return;
  const pos = t.cursor() - 1;
  const letters = [...t.get()];
  letters[pos] = '';
  t.set(letters);
  t.setCursor(pos);
}

function clearTyping() {
  const t = activeTyping();
  t.set(emptyTyping());
  t.setCursor(0);
}

async function submitWord() {
  const t = activeTyping();
  if (!t.canType || !data.value) return;
  const letters = t.get();
  if (letters.some((letter) => !letter)) {
    message.value = 'Palavra incompleta.';
    return;
  }
  const word = letters.join('');
  if (!isValidGuess(word, data.value.dictionary)) {
    message.value = 'Essa palavra não está no dicionário.';
    return;
  }

  if (tab.value === 'solo') {
    const next = applyGame(soloGame.value!, word, data.value.dictionary);
    if (!next) return;
    soloGame.value = next;
    clearTyping();
    if (isWon(next)) {
      message.value = 'Acertou todas!';
      await endSoloRound(true);
    } else if (isLost(next)) {
      message.value = `As palavras eram ${next.words.map((w) => w.toUpperCase()).join(', ')}.`;
      await endSoloRound(false);
    }
    return;
  }

  clearTyping();
  const result = await sendTermoGuess(code.value, uid.value, word, data.value.dictionary).catch(() => null);
  if (!result?.committed) message.value = 'Não foi possível enviar o palpite.';
}

function onKey(event: KeyboardEvent) {
  const el = event.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Enter') void submitWord();
  else if (event.key === 'Backspace') backspace();
  else if (event.key.length === 1 && /[a-zA-ZçÇ]/.test(event.key)) typeLetter(event.key);
}

/** Melhor marca de cada letra em todos os tabuleiros, para colorir o teclado. */
function keyboardMarks(guesses: string[], words: string[]): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
  const out: Record<string, Mark> = {};
  if (words.length === 0) return out;
  for (const g of guesses) {
    marksPerBoard(g, words).forEach((marks) => {
      g.split('').forEach((letter, i) => {
        const prev = out[letter];
        if (!prev || rank[marks[i]] > rank[prev]) out[letter] = marks[i];
      });
    });
  }
  return out;
}

const soloMarks = computed(() => keyboardMarks(soloGame.value?.guesses ?? [], soloGame.value?.words ?? []));
const roomMarks = computed(() => keyboardMarks(me.value?.guesses ?? [], roundWords.value));

// ---------- ciclo de vida ----------
onMounted(async () => {
  window.addEventListener('keydown', onKey);
  try {
    data.value = await loadTermoData();
    uid.value = (await ensureSignedIn()).uid;
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Erro ao carregar o Termo.';
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  unsubRoom?.();
});
</script>

<template>
  <main class="app termo">
    <header class="brand">
      <RouterLink class="back" to="/">← Hub de jogos</RouterLink>
      <BrandLogo />
      <h1>Termo</h1>
      <p class="sub">Descubra as palavras de 5 letras. Verde é a posição certa, amarelo é letra presente.</p>
    </header>

    <nav class="tabs">
      <button :class="{ active: tab === 'solo' }" @click="tab = 'solo'">Solo</button>
      <button :class="{ active: tab === 'sala' }" @click="tab = 'sala'">Sala</button>
    </nav>

    <p v-if="loadError" class="bad">{{ loadError }}</p>
    <p v-else-if="!data" class="muted">Carregando palavras…</p>

    <!-- SOLO -->
    <template v-else-if="tab === 'solo'">
      <section class="card termo-card">
        <SettingsDialog title="Configuração" :summary="summarize(config)">
          <label class="pct">
            <span>Modo</span>
            <select :value="config.boards" :disabled="soloActive" @change="changeConfig({ boards: numberFrom($event) })">
              <option v-for="b in boardOptions" :key="b" :value="b">{{ BOARD_LABEL[b] }} ({{ b }})</option>
            </select>
          </label>
          <label class="pct">
            <span>Palavras por série (1 a {{ MAX_WORDS }})</span>
            <input type="number" :min="MIN_WORDS" :max="MAX_WORDS" :value="config.words" :disabled="soloActive" @change="changeConfig({ words: numberFrom($event) })" />
          </label>
          <label class="pct">
            <span>Tentativas (3 a {{ maxTriesFor(config.boards) }})</span>
            <input type="number" :min="MIN_TRIES" :max="maxTriesFor(config.boards)" :value="config.tries" :disabled="soloActive" @change="changeConfig({ tries: clampTries(numberFrom($event), config.boards) })" />
          </label>
        </SettingsDialog>

        <template v-if="soloActive && soloGame">
          <div class="round-head">
            <span>Rodada {{ soloIndex }} de {{ config.words }}</span>
            <span>Pontos: <strong>{{ soloTotal }}</strong></span>
          </div>
          <TermoMulti
            :words="soloGame.words"
            :guesses="soloGame.guesses"
            :tries="soloGame.tries"
            :typing="soloTyping"
            :cursor="soloCursor"
            :editable="soloStatus === 'playing'"
            @cell="moveCursor"
          />
          <p v-if="message" class="message" :class="soloStatus === 'won' ? 'ok' : soloStatus === 'lost' ? 'bad' : 'muted'">{{ message }}</p>
          <TermoKeyboard :marks="soloMarks" :disabled="soloStatus !== 'playing'" @key="typeLetter" @enter="submitWord" @back="backspace" />
          <button v-if="soloStatus !== 'playing'" @click="soloNext">
            {{ soloIndex >= config.words ? 'Ver resultado' : 'Próxima rodada' }}
          </button>
        </template>

        <template v-else-if="soloOver">
          <h2>Série terminada</h2>
          <p>Você fez <strong>{{ soloTotal }}</strong> pontos em {{ config.words }} rodada(s).</p>
          <button @click="startSolo">Nova série</button>
        </template>

        <button v-else @click="startSolo">Começar série</button>
        <p class="muted small">Palavras não se repetem no mesmo navegador. Os pontos vão para o ranking geral.</p>
      </section>
      <RankingPanel />
    </template>

    <!-- SALA -->
    <template v-else>
      <section v-if="!code" class="card">
        <label>
          Seu nome
          <input v-model="name" maxlength="20" placeholder="Como você quer aparecer" />
        </label>
        <SettingsDialog title="Configuração da sala" :summary="summarize(config)">
          <label class="pct">
            <span>Modo</span>
            <select :value="config.boards" @change="changeConfig({ boards: numberFrom($event) })">
              <option v-for="b in boardOptions" :key="b" :value="b">{{ BOARD_LABEL[b] }} ({{ b }})</option>
            </select>
          </label>
          <label class="pct">
            <span>Palavras na partida (1 a {{ MAX_WORDS }})</span>
            <input type="number" :min="MIN_WORDS" :max="MAX_WORDS" :value="config.words" @change="changeConfig({ words: numberFrom($event) })" />
          </label>
          <label class="pct">
            <span>Tentativas (3 a {{ maxTriesFor(config.boards) }})</span>
            <input type="number" :min="MIN_TRIES" :max="maxTriesFor(config.boards)" :value="config.tries" @change="changeConfig({ tries: clampTries(numberFrom($event), config.boards) })" />
          </label>
        </SettingsDialog>
        <button :disabled="busy" @click="createRoom">Criar sala</button>
        <div class="divider">ou</div>
        <form class="row" @submit.prevent="joinRoom">
          <input v-model="joinCode" maxlength="5" placeholder="Código da sala" style="text-transform: uppercase" />
          <button type="submit" :disabled="busy">Entrar</button>
        </form>
        <p v-if="message" class="bad">{{ message }}</p>
      </section>

      <template v-else-if="room">
        <section class="card">
          <div class="code">
            <span class="muted">Código da sala</span>
            <strong>{{ code }}</strong>
            <span class="muted small">
              {{ BOARD_LABEL[boards] }} · {{ room.settings.words }} rodada(s) · {{ room.settings.tries }} tentativas
            </span>
          </div>

          <SettingsDialog v-if="isHost && room.status === 'lobby'" title="Configuração da partida" :summary="summarize(room.settings)">
            <label class="pct">
              <span>Modo</span>
              <select :value="room.settings.boards" @change="changeRoomSettings({ boards: numberFrom($event) })">
                <option v-for="b in boardOptions" :key="b" :value="b">{{ BOARD_LABEL[b] }} ({{ b }})</option>
              </select>
            </label>
            <label class="pct">
              <span>Palavras na partida (1 a {{ MAX_WORDS }})</span>
              <input type="number" :min="MIN_WORDS" :max="MAX_WORDS" :value="room.settings.words" @change="changeRoomSettings({ words: numberFrom($event) })" />
            </label>
            <label class="pct">
              <span>Tentativas (3 a {{ maxTriesFor(room.settings.boards) }})</span>
              <input type="number" :min="MIN_TRIES" :max="maxTriesFor(room.settings.boards)" :value="room.settings.tries" @change="changeRoomSettings({ tries: clampTries(numberFrom($event), room.settings.boards) })" />
            </label>
          </SettingsDialog>

          <template v-if="room.status === 'finished'">
            <h2>Fim da partida</h2>
            <ol class="board-list">
              <li v-for="(s, i) in standings" :key="s.id">
                <span><span class="rank">{{ i + 1 }}.</span> {{ s.name }}</span>
                <span></span>
                <strong>{{ s.score }}</strong>
              </li>
            </ol>
            <button v-if="isHost" :disabled="busy" @click="nextRoomRound">Nova partida</button>
          </template>

          <template v-else-if="!room.round">
            <p class="muted">
              {{ isHost ? 'Quando todos entrarem, comece a primeira rodada.' : 'Aguardando o host começar…' }}
            </p>
            <button v-if="isHost" :disabled="busy || !data" @click="nextRoomRound">Começar partida</button>
          </template>

          <template v-else>
            <div class="round-head">
              <span>Rodada {{ room.round.n }} de {{ room.settings.words }}</span>
              <span v-if="roundOver">
                <strong v-if="winnerName" class="ok">{{ winnerName }} venceu!</strong>
                <strong v-else class="bad">Ninguém resolveu.</strong>
                · era <strong>{{ roundWords.map((w) => w.toUpperCase()).join(', ') }}</strong>
              </span>
              <span v-else class="muted">Corrida: quem resolver todas primeiro leva a rodada</span>
            </div>

            <div class="layout">
              <div class="main">
                <TermoMulti
                  :words="roundWords"
                  :guesses="me?.guesses ?? []"
                  :tries="tries"
                  :typing="roomTyping"
                  :cursor="roomCursor"
                  :editable="roomCanType"
                  @cell="moveCursor"
                />
                <p v-if="message" class="bad">{{ message }}</p>
                <p v-if="me?.solved" class="ok">Você resolveu em {{ me.guesses.length }} tentativa(s)!</p>
                <TermoKeyboard :marks="roomMarks" :disabled="!roomCanType" @key="typeLetter" @enter="submitWord" @back="backspace" />
                <button v-if="isHost && roundOver" :disabled="busy" @click="nextRoomRound">
                  {{ room.round.n >= room.settings.words ? 'Encerrar partida' : 'Próxima rodada' }}
                </button>
              </div>

              <aside class="board">
                <h4>Placar</h4>
                <ol class="standings">
                  <li v-for="s in standings" :key="s.id">
                    <span>{{ s.name }}<span v-if="s.id === uid" class="tag you">você</span></span>
                    <strong>{{ s.score }}</strong>
                  </li>
                </ol>
              </aside>
            </div>

            <div v-if="others.length" class="mini-grid">
              <div v-for="p in others" :key="p.id" class="mini-card">
                <span class="small muted">{{ p.name }}<span v-if="p.solved"> ✓</span></span>
                <TermoMulti :words="roundWords" :guesses="p.guesses" :tries="tries" mini />
              </div>
            </div>
          </template>

          <button class="ghost" @click="leaveRoom">Sair da sala</button>
        </section>
      </template>

      <section v-else class="card">
        <p class="muted">Conectando à sala {{ code }}…</p>
        <button class="ghost" @click="leaveRoom">Sair</button>
      </section>

      <RankingPanel />
    </template>
  </main>
</template>
