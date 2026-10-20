<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BrandLogo from '../components/BrandLogo.vue';
import GuessMap, { type Marker } from '../components/GuessMap.vue';
import SettingsDialog from '../components/SettingsDialog.vue';
import StreetPhoto from '../components/StreetPhoto.vue';
import { ensureSignedIn } from '../firebase';
import { addRankingPoints } from '../lib/ranking';
import { serverNow } from '../lib/time';
import type { Cell } from '../games/onde/geo';
import { findPhoto, PhotoError } from '../games/onde/photo';
import {
  REVEAL_SHOW_MS,
  canStartNext,
  clampSettings,
  deadlineOf,
  standings,
  type OndeRoom,
  type OndeSettings,
  DEFAULT_ONDE_SETTINGS,
} from '../games/onde/state';
import {
  createOndeRoom,
  guessOnde,
  joinOndeRoom,
  startOndeRound,
  subscribeOndeRoom,
  tickOnde,
  updateOndeSettings,
} from '../games/onde/room';

const ROUND_OPTIONS = [3, 5, 7, 10];
const SECONDS_OPTIONS = [60, 90, 120];

const uid = ref('');
const name = ref(localStorage.getItem('qeo:name') ?? '');
const joinCode = ref('');
const code = ref('');
const room = ref<OndeRoom | null>(null);
const createSettings = ref<OndeSettings>({ ...DEFAULT_ONDE_SETTINGS });
const message = ref('');
const busy = ref(false);
const picking = ref(false);
const now = ref(serverNow());
const guessPos = ref<Cell | null>(null);
const submitted = ref(false);
const photoFailed = ref(false);
let unsubRoom: (() => void) | null = null;
let ticking = false;
let rankingDone = false;

const timer = setInterval(() => {
  now.value = serverNow();
  const r = room.value;
  if (code.value && r?.round && r.round.status === 'playing' && !ticking && now.value >= deadlineOf(r.round)) {
    ticking = true;
    tickOnde(code.value)
      .catch(() => {})
      .finally(() => {
        ticking = false;
      });
  }
}, 250);

onBeforeUnmount(() => {
  clearInterval(timer);
  unsubRoom?.();
});

const isHost = computed(() => !!room.value && room.value.hostUid === uid.value);
const round = computed(() => room.value?.round ?? null);
const playing = computed(() => round.value?.status === 'playing');
const revealed = computed(() => round.value?.status === 'reveal');
const secondsLeft = computed(() => {
  const r = round.value;
  if (!r || r.status !== 'playing') return 0;
  return Math.max(0, Math.ceil((deadlineOf(r) - now.value) / 1000));
});
const nextIn = computed(() => {
  const r = round.value;
  if (!r || r.status !== 'reveal') return 0;
  return Math.max(0, Math.ceil(((r.revealAt ?? 0) + REVEAL_SHOW_MS - now.value) / 1000));
});
const nextReady = computed(() => !!room.value && canStartNext(room.value, now.value));
const ranking = computed(() => (room.value ? standings(room.value) : []));
const myResult = computed(() => (uid.value && round.value?.results[uid.value]) || null);

const markers = computed<Marker[]>(() => {
  const r = round.value;
  if (!r || !room.value) return [];
  const colors = ['#d97757', '#4e9e8c', '#d8b26a', '#b96a5f', '#7d8f7a', '#e0c9a6', '#8f7f6a', '#b4553f'];
  return Object.entries(r.guesses)
    .filter(([id]) => id !== uid.value)
    .map(([id, g], i) => ({ ...g, name: room.value!.players[id]?.name ?? '?', color: colors[i % colors.length] }));
});

const answer = computed<Cell | null>(() => (round.value ? { lat: round.value.lat, lon: round.value.lon } : null));

// Ao começar uma nova rodada, limpa o palpite local.
watch(
  () => round.value?.n,
  () => {
    guessPos.value = null;
    photoFailed.value = false;
    submitted.value = !!(round.value && uid.value && round.value.guesses[uid.value]);
  },
);

// Ranking geral: cada jogador grava 1/10 da própria pontuação ao fim da partida.
watch(
  () => room.value?.status,
  (status) => {
    if (status !== 'finished' || rankingDone || !room.value || !uid.value) return;
    rankingDone = true;
    const key = `onde:rec:${code.value}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const score = room.value.players[uid.value]?.score ?? 0;
    addRankingPoints(uid.value, name.value.trim() || 'Jogador', Math.round(score / 10)).catch(() => {});
  },
);

function enter(roomCode: string) {
  code.value = roomCode;
  unsubRoom?.();
  unsubRoom = subscribeOndeRoom(roomCode, (r) => {
    room.value = r;
  });
}

async function run(task: () => Promise<unknown>) {
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

function create() {
  return run(async () => {
    uid.value = (await ensureSignedIn()).uid;
    localStorage.setItem('qeo:name', name.value.trim());
    enter(await createOndeRoom(name.value.trim(), clampSettings(createSettings.value)));
  });
}

function join() {
  return run(async () => {
    uid.value = (await ensureSignedIn()).uid;
    const target = joinCode.value.trim().toUpperCase();
    if (!target) throw new Error('Digite o código da sala.');
    localStorage.setItem('qeo:name', name.value.trim());
    await joinOndeRoom(target, name.value.trim());
    enter(target);
  });
}

function changeSettings(partial: Partial<OndeSettings>) {
  if (!room.value || !isHost.value) return;
  const next = clampSettings({ ...room.value.settings, ...partial });
  return run(() => updateOndeSettings(code.value, next));
}

/** Escolhe uma foto e começa a próxima rodada (só o host, depois do resultado). */
async function nextRound() {
  if (!room.value) return;
  picking.value = true;
  try {
    const pick = await findPhoto();
    await run(async () => {
      const result = await startOndeRound(code.value, pick);
      if (!result.committed) message.value = 'Outra rodada já começou. Atualize se necessário.';
    });
  } catch (err) {
    message.value = err instanceof PhotoError ? err.message : 'Não consegui buscar a foto. Tente de novo.';
  } finally {
    picking.value = false;
  }
}

async function submitGuess() {
  if (!guessPos.value || !playing.value || submitted.value) return;
  submitted.value = true;
  const result = await guessOnde(code.value, uid.value, guessPos.value).catch(() => null);
  if (!result?.committed) {
    submitted.value = false;
    message.value = 'Não foi possível enviar o palpite. Confira se o tempo não acabou.';
  }
}

function leave() {
  unsubRoom?.();
  unsubRoom = null;
  code.value = '';
  room.value = null;
  guessPos.value = null;
  submitted.value = false;
  rankingDone = false;
}

function formatKm(km: number): string {
  return km >= 1000 ? `${(km / 1000).toFixed(1)} mil km` : `${Math.round(km)} km`;
}

onMounted(() => {
  ensureSignedIn().then((u) => (uid.value = u.uid)).catch(() => {});
});
</script>

<template>
  <main class="app onde">
    <header class="brand">
      <RouterLink class="back" to="/">← Hub de jogos</RouterLink>
      <BrandLogo />
      <h1>Onde Estou?</h1>
      <p class="sub">Olhe a foto de rua e marque no mapa onde ela foi tirada.</p>
    </header>

    <!-- ENTRAR -->
    <section v-if="!code" class="card">
      <label>
        Seu nome
        <input v-model="name" maxlength="20" placeholder="Como você quer aparecer" />
      </label>

      <SettingsDialog title="Configuração da partida" :summary="`${createSettings.rounds} rodadas · ${createSettings.seconds}s por rodada`">
        <label class="pct">
          <span>Rodadas</span>
          <select :value="createSettings.rounds" @change="createSettings = { ...createSettings, rounds: Number(($event.target as HTMLSelectElement).value) }">
            <option v-for="r in ROUND_OPTIONS" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
        <label class="pct">
          <span>Tempo por rodada</span>
          <select :value="createSettings.seconds" @change="createSettings = { ...createSettings, seconds: Number(($event.target as HTMLSelectElement).value) }">
            <option v-for="s in SECONDS_OPTIONS" :key="s" :value="s">{{ s }} segundos</option>
          </select>
        </label>
      </SettingsDialog>

      <button :disabled="busy" @click="create">Criar sala</button>
      <p class="muted small">Para jogar sozinho, crie a sala e comece a partida. Com amigos, mande o código.</p>
      <div class="divider">ou</div>
      <form class="row" @submit.prevent="join">
        <input v-model="joinCode" maxlength="5" placeholder="Código da sala" style="text-transform: uppercase" />
        <button type="submit" :disabled="busy">Entrar</button>
      </form>
      <p v-if="message" class="bad">{{ message }}</p>
    </section>

    <section v-else-if="!room" class="card">
      <p class="muted">Conectando à sala {{ code }}…</p>
      <button class="ghost" @click="leave">Sair</button>
    </section>

    <!-- LOBBY -->
    <section v-else-if="room.status === 'lobby'" class="card">
      <div class="code">
        <span class="muted">Código da sala</span>
        <strong>{{ code }}</strong>
        <span class="muted small">{{ room.settings.rounds }} rodadas · {{ room.settings.seconds }}s por rodada</span>
      </div>

      <h3>Jogadores ({{ Object.keys(room.players).length }})</h3>
      <ul class="players">
        <li v-for="(p, id) in room.players" :key="id">
          {{ p.name }}
          <span v-if="id === room.hostUid" class="tag">host</span>
          <span v-if="id === uid" class="tag you">você</span>
        </li>
      </ul>

      <template v-if="isHost">
        <SettingsDialog title="Configuração da partida" :summary="`${room.settings.rounds} rodadas · ${room.settings.seconds}s por rodada`">
          <label class="pct">
            <span>Rodadas</span>
            <select :value="room.settings.rounds" @change="changeSettings({ rounds: Number(($event.target as HTMLSelectElement).value) })">
              <option v-for="r in ROUND_OPTIONS" :key="r" :value="r">{{ r }}</option>
            </select>
          </label>
          <label class="pct">
            <span>Tempo por rodada</span>
            <select :value="room.settings.seconds" @change="changeSettings({ seconds: Number(($event.target as HTMLSelectElement).value) })">
              <option v-for="s in SECONDS_OPTIONS" :key="s" :value="s">{{ s }} segundos</option>
            </select>
          </label>
        </SettingsDialog>
        <button :disabled="busy || picking" @click="nextRound">{{ picking ? 'Buscando foto…' : 'Começar partida' }}</button>
      </template>
      <p v-else class="muted">Aguardando o host começar…</p>

      <p v-if="message" class="bad">{{ message }}</p>
      <button class="ghost" @click="leave">Sair da sala</button>
    </section>

    <!-- PARTIDA -->
    <section v-else-if="room.status === 'playing' && round" class="card">
      <div class="status">
        <span>Rodada {{ round.n }} de {{ room.settings.rounds }}</span>
        <span v-if="playing" :class="{ urgent: secondsLeft <= 10 }">⏱ {{ secondsLeft }}s</span>
        <span v-else class="muted">Resultado</span>
      </div>

      <div class="onde-layout">
        <figure class="photo">
          <StreetPhoto :url="round.imageUrl" :is-pano="round.isPano" @failed="photoFailed = true" />
          <figcaption class="small muted">Foto: {{ round.creator }} · Mapillary (CC BY-SA) — arraste e use a roda do mouse para explorar</figcaption>
          <p v-if="photoFailed" class="bad small">Essa foto não carregou. Você ainda pode palpitar; a rodada termina no tempo.</p>
        </figure>

        <div class="guess-col">
          <GuessMap
            :guess="guessPos"
            :disabled="!playing || submitted"
            :answer="revealed ? answer : null"
            :others="revealed ? markers : []"
            @pick="(c: Cell) => (guessPos = c)"
          />

          <template v-if="playing">
            <button :disabled="!guessPos || submitted" @click="submitGuess">
              {{ submitted ? 'Palpite enviado' : 'Confirmar palpite' }}
            </button>
            <p v-if="submitted" class="muted small">Aguardando os outros jogadores…</p>
            <p v-else class="muted small">Clique no mapa para marcar o local.</p>
          </template>

          <template v-else>
            <div class="result">
              <p v-if="myResult" class="ok">
                Você ficou a {{ formatKm(myResult.km) }} e ganhou <strong>{{ myResult.pts }}</strong> pontos.
              </p>
              <p v-else class="bad">Você não marcou a tempo nesta rodada.</p>
              <ul class="board-list">
                <li v-for="s in ranking" :key="s.uid">
                  <span>{{ s.name }}</span>
                  <span class="muted small">{{ round.results[s.uid] ? formatKm(round.results[s.uid].km) : '—' }}</span>
                  <strong>{{ s.score }}</strong>
                </li>
              </ul>
            </div>
            <button v-if="isHost" :disabled="!nextReady || picking || busy" @click="nextRound">
              {{ picking ? 'Buscando foto…' : nextReady ? 'Próxima rodada' : `Próxima rodada em ${nextIn}s` }}
            </button>
            <p v-else class="muted small">Aguardando o host começar a próxima rodada…</p>
          </template>

          <p v-if="message" class="bad">{{ message }}</p>
        </div>
      </div>

      <button class="ghost" @click="leave">Sair da sala</button>
    </section>

    <!-- FIM -->
    <section v-else-if="room.status === 'finished'" class="card">
      <h2>Fim de partida</h2>
      <ol class="board-list">
        <li v-for="(s, i) in ranking" :key="s.uid">
          <span><span class="rank">{{ i + 1 }}.</span> {{ s.name }}</span>
          <span></span>
          <strong>{{ s.score }}</strong>
        </li>
      </ol>
      <p v-if="ranking[0]" class="winner">Vencedor: {{ ranking[0].name }} 🏆</p>
      <button class="ghost" @click="leave">Criar ou entrar em outra sala</button>
    </section>

    <p class="foot small muted">Fotos © Mapillary (CC BY-SA) · Mapa © OpenStreetMap</p>
  </main>
</template>
