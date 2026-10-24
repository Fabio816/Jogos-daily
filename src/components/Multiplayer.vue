<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Difficulty, Question, WorkType } from '../data/questions';
import { DIFFICULTIES, DIFFICULTY_LABEL } from '../game/difficulty';
import { GROUPS, GROUP_LABEL, type Group } from '../game/mix';
import { ensureSignedIn } from '../firebase';
import CountdownRing from './CountdownRing.vue';
import SettingsDialog from './SettingsDialog.vue';
import RoomChat from './RoomChat.vue';
import RoomInvite from './RoomInvite.vue';
import RoomPlayers from './RoomPlayers.vue';
import RoomAlerts from './RoomAlerts.vue';
import { useDevtoolsAlerts } from '../lib/alerts';
import { clearInviteFromUrl, inviteCodeFromUrl } from '../lib/invite';
import { ALL_QUESTIONS, DEFAULT_SETTINGS, type RoomSettings } from '../game/catalog';
import { isCorrectGuess } from '../game/answer';
import { blurPx } from '../game/reveal';
import {
  claimRound,
  createRoom,
  joinRoom,
  sendMessage,
  serverNow,
  startGame,
  subscribeMessages,
  subscribeRoom,
  tickRoom,
  updateSettings,
  type ChatMessage,
} from '../multiplayer/room';
import { isAdvanceDue, type RoomState } from '../multiplayer/state';

const TYPE_LABEL: Record<WorkType, string> = { movie: 'Filme', series: 'Série', game: 'Jogo', anime: 'Anime' };

const name = ref(localStorage.getItem('qeo:name') ?? '');
const joinCode = ref(inviteCodeFromUrl());
const code = ref('');
const uid = ref('');
const room = ref<RoomState | null>(null);
const alerts = useDevtoolsAlerts('qual-e-a-obra', code, name, computed(() => room.value?.status === 'playing'));
const error = ref('');
const busy = ref(false);
const now = ref(serverNow());
const guess = ref('');
const feedback = ref('');

const messages = ref<ChatMessage[]>([]);

let unsubRoom: (() => void) | null = null;
let unsubMessages: (() => void) | null = null;
let ticking = false;

// Relógio da interface e avanço automático da partida (qualquer cliente pode disparar).
const timer = setInterval(() => {
  now.value = serverNow();
  if (code.value && room.value && !ticking && isAdvanceDue(room.value, now.value)) {
    ticking = true;
    tickRoom(code.value)
      .catch(() => {})
      .finally(() => {
        ticking = false;
      });
  }
}, 250);

// Link com ?sala=CODIGO: entra direto na sala (pede o nome se ainda não houver).
onMounted(() => {
  if (joinCode.value) void join();
});

onBeforeUnmount(() => {
  clearInterval(timer);
  unsubRoom?.();
  unsubMessages?.();
});

const isHost = computed(() => !!room.value && room.value.hostUid === uid.value);
const round = computed(() => room.value?.round ?? null);

const question = computed<Question | undefined>(() => {
  const r = round.value;
  return r ? ALL_QUESTIONS.find((q) => q.id === r.qid) : undefined;
});

const progress = computed(() => {
  const r = round.value;
  if (!r) return 0;
  return Math.min(Math.max((now.value - r.startedAt) / r.durationMs, 0), 1);
});

const secondsLeft = computed(() => {
  const r = round.value;
  if (!r) return 0;
  return Math.max(0, Math.ceil((r.startedAt + r.durationMs - now.value) / 1000));
});

const roundSeconds = computed(() => (round.value ? Math.round(round.value.durationMs / 1000) : 0));

/** Capa da rodada: obras (desfocada ou nítida) e também ator/personagem, que mostram a capa da obra. */
const poster = computed(() => {
  const q = question.value;
  const r = round.value;
  if (!q?.imageUrl || q.clueType === 'emoji' || q.clueType === 'phrase') return undefined;
  const clearCover = q.clueType === 'image' && r?.blur === false && r.status === 'clue';
  return {
    url: clearCover && q.clearImageUrl ? q.clearImageUrl : q.imageUrl,
    hideTitle: clearCover && !q.clearImageUrl,
  };
});

const mixTotal = computed(() =>
  room.value ? GROUPS.reduce((sum, g) => sum + (room.value!.settings.mix[g] ?? 0), 0) : 0,
);
const difficultyTotal = computed(() =>
  room.value ? DIFFICULTIES.reduce((sum, d) => sum + (room.value!.settings.difficultyMix[d] ?? 0), 0) : 0,
);

const posterBlur = computed(() => {
  const r = round.value;
  return r && r.status === 'clue' && r.blur ? blurPx(progress.value) : 0;
});
const posterStyle = computed(() => (posterBlur.value > 0 ? { filter: `blur(${posterBlur.value}px)` } : undefined));

const players = computed(() =>
  Object.entries(room.value?.players ?? {})
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.score - a.score),
);

const winnerName = computed(() => {
  const w = round.value?.winnerUid;
  return w ? (room.value?.players[w]?.name ?? '?') : null;
});

// Limpa a resposta e o feedback sempre que uma nova rodada começa.
watch(
  () => round.value?.n,
  () => {
    guess.value = '';
    feedback.value = '';
  },
);

async function run(task: () => Promise<unknown>) {
  error.value = '';
  if (!name.value.trim()) {
    error.value = 'Digite seu nome primeiro.';
    return;
  }
  busy.value = true;
  try {
    await task();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro inesperado.';
  } finally {
    busy.value = false;
  }
}

function enter(roomCode: string) {
  localStorage.setItem('qeo:name', name.value.trim());
  code.value = roomCode;
  clearInviteFromUrl();
  unsubRoom?.();
  unsubRoom = subscribeRoom(roomCode, (r) => {
    room.value = r;
  });
  unsubMessages?.();
  unsubMessages = subscribeMessages(roomCode, (list) => {
    messages.value = list;
  });
}

async function create() {
  await run(async () => {
    const user = await ensureSignedIn();
    uid.value = user.uid;
    const created = await createRoom(name.value.trim(), { ...DEFAULT_SETTINGS });
    enter(created);
  });
}

async function join() {
  await run(async () => {
    const user = await ensureSignedIn();
    uid.value = user.uid;
    const target = joinCode.value.trim().toUpperCase();
    if (!target) throw new Error('Digite o código da sala.');
    await joinRoom(target, name.value.trim());
    enter(target);
  });
}

async function start() {
  await run(() => startGame(code.value));
}

async function playAgain() {
  await run(() => startGame(code.value));
}

function onMix(group: Group, event: Event) {
  if (!room.value) return;
  const value = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
  patch({ mix: { ...room.value.settings.mix, [group]: value } });
}

function onDifficulty(difficulty: Difficulty, event: Event) {
  if (!room.value) return;
  const value = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
  patch({ difficultyMix: { ...room.value.settings.difficultyMix, [difficulty]: value } });
}

async function patch(changes: Partial<RoomSettings>) {
  if (!isHost.value || !room.value) return;
  await run(() => updateSettings(code.value, { ...room.value!.settings, ...changes }));
}

async function sendChat(text: string) {
  if (!uid.value) return;
  await sendMessage(code.value, uid.value, name.value.trim(), text, 'chat');
}

function leave() {
  unsubRoom?.();
  unsubMessages?.();
  unsubRoom = null;
  unsubMessages = null;
  messages.value = [];
  code.value = '';
  room.value = null;
  joinCode.value = '';
}

function toggleList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function onNumber(key: 'targetPoints' | 'durationSec', event: Event) {
  patch({ [key]: Number((event.target as HTMLInputElement).value) } as Partial<RoomSettings>);
}

async function submitGuess() {
  const q = question.value;
  const r = round.value;
  if (!q || !r || r.status !== 'clue' || !uid.value) return;

  const text = guess.value.trim();
  if (!text) return;
  if (!isCorrectGuess(text, q.answers, { titleAliases: !q.kind || q.kind === 'work' })) {
    feedback.value = 'Não é essa. Tente de novo.';
    guess.value = '';
    await sendMessage(code.value, uid.value, name.value.trim(), text, 'guess');
    return;
  }

  guess.value = '';
  const result = await claimRound(code.value, uid.value);
  if (!result.committed) {
    feedback.value = 'Outro jogador foi mais rápido.';
    return;
  }
  const winner = result.snapshot.val()?.round?.winnerUid;
  feedback.value = winner === uid.value ? 'Você acertou primeiro!' : 'Outro jogador foi mais rápido.';
}



</script>

<template>
  <section class="mp">
    <!-- ENTRAR OU CRIAR -->
    <div v-if="!code" class="card">
      <label>
        Seu nome
        <input v-model="name" maxlength="20" placeholder="Como você quer aparecer" />
      </label>

      <button :disabled="busy" @click="create">Criar sala</button>

      <div class="divider">ou</div>

      <form class="row" @submit.prevent="join">
        <input v-model="joinCode" maxlength="5" placeholder="Código da sala" style="text-transform: uppercase" />
        <button type="submit" :disabled="busy">Entrar</button>
      </form>

      <p v-if="error" class="bad">{{ error }}</p>
    </div>

    <!-- SALA CARREGANDO -->
    <div v-else-if="!room" class="card">
      <p class="muted">Conectando à sala {{ code }}…</p>
      <button class="ghost" @click="leave">Sair</button>
    </div>

    <!-- LOBBY -->
    <div v-else-if="room.status === 'lobby'" class="card">
      <div class="code">
        <span class="muted">Código da sala</span>
        <strong>{{ code }}</strong>
      </div>

      <RoomInvite :code="code" path="/qual-e-a-obra" />
      <RoomPlayers :players="players" :host-uid="room.hostUid" :my-uid="uid" />

      <template v-if="isHost">
        <SettingsDialog title="Configurações da partida" :summary="`${room.settings.targetPoints} pts · ${room.settings.durationSec}s por pista`">
          <label>
            Pontos para vencer
            <input type="number" min="20" step="10" :value="room.settings.targetPoints" @change="onNumber('targetPoints', $event)" />
          </label>
          <label>
            Tempo por pista (segundos)
            <input type="number" min="5" max="60" :value="room.settings.durationSec" @change="onNumber('durationSec', $event)" />
          </label>

          <div class="group">
            <span class="muted">Categorias</span>
            <label v-for="(label, key) in TYPE_LABEL" :key="key" class="check">
              <input type="checkbox" :checked="room.settings.types.includes(key)" @change="patch({ types: toggleList(room.settings.types, key) })" />
              {{ label }}
            </label>
          </div>

          <div class="group">
            <span class="muted">Dificuldade (peso em %; o total é {{ difficultyTotal }})</span>
            <label v-for="d in DIFFICULTIES" :key="d" class="pct">
              <span>{{ DIFFICULTY_LABEL[d] }}</span>
              <input type="number" min="0" max="100" step="5" :value="room.settings.difficultyMix[d]" @change="onDifficulty(d, $event)" />
              <span class="muted">%</span>
            </label>
          </div>

          <div class="group">
            <span class="muted">Tipos de rodada (peso em %; o total é {{ mixTotal }})</span>
            <label v-for="g in GROUPS" :key="g" class="pct">
              <span>{{ GROUP_LABEL[g] }}</span>
              <input type="number" min="0" max="100" step="5" :value="room.settings.mix[g]" @change="onMix(g, $event)" />
              <span class="muted">%</span>
            </label>
            <span class="muted small">Ator e personagem mostram a capa da obra.</span>
          </div>
        </SettingsDialog>

        <button :disabled="busy || players.length === 0" @click="start">Iniciar partida</button>
      </template>
      <p v-else class="muted">Aguardando o host iniciar a partida…</p>

      <p v-if="error" class="bad">{{ error }}</p>
      <button class="ghost" @click="leave">Sair da sala</button>
    </div>

    <!-- PARTIDA -->
    <div v-else-if="room.status === 'playing'" class="card">
      <div class="status quiz">
        <div class="status-meta">
          <span class="stat"><span>Faixa</span><strong>{{ round?.n ?? 0 }}</strong></span>
          <span class="stat"><span>Alvo</span><strong>{{ room.settings.targetPoints }} pts</strong></span>
        </div>
        <CountdownRing
          v-if="round?.status === 'clue'"
          :seconds="secondsLeft"
          :total="roundSeconds"
          :urgent="secondsLeft <= 5"
        />
      </div>

      <div class="layout">
        <div class="main">
          <div v-if="!question" class="clue muted">Preparando a rodada…</div>

          <div v-else :key="question.id" class="clue">
            <img v-if="poster" class="poster" :class="{ 'title-hidden': poster.hideTitle }" :src="poster.url" alt="Capa" :style="posterStyle" />
            <span v-if="question.clueType === 'emoji'" class="emoji">{{ question.clue }}</span>
            <p v-else-if="question.clueType === 'character'" class="character">
              Quem interpreta <strong>{{ question.clue }}</strong> em <strong>{{ question.workTitle }}</strong>?
            </p>
            <p v-else-if="question.clueType === 'actor'" class="character">
              Qual personagem <strong>{{ question.clue }}</strong> interpreta em <strong>{{ question.workTitle }}</strong>?
            </p>
            <q v-else-if="question.clueType === 'phrase'">{{ question.clue }}</q>
          </div>

          <form v-if="round?.status === 'clue'" @submit.prevent="submitGuess" class="row">
            <input
              v-model="guess"
              :placeholder="question?.kind === 'actor' ? 'Nome do ator…' : question?.kind === 'character' ? 'Nome do personagem…' : 'Nome da obra…'"
              autocomplete="off"
              autofocus
            />
            <button type="submit">Responder</button>
          </form>

          <div v-else-if="round" class="reveal">
            <p v-if="winnerName" class="ok">{{ winnerName }} acertou!</p>
            <p v-else class="bad">Ninguém acertou a tempo.</p>
            <p>
              Resposta: <strong>{{ question?.answers[0] }}</strong>
              <span class="muted">
                <template v-if="question?.kind === 'actor'">(ator de {{ question.workTitle }})</template>
                <template v-else-if="question?.kind === 'character'">(personagem de {{ question.workTitle }})</template>
              </span>
            </p>
            <p class="muted small">Próxima rodada em instantes…</p>
          </div>

          <p v-if="feedback" :class="feedback.startsWith('Você') ? 'ok' : 'bad'">{{ feedback }}</p>
        </div>

        <aside class="board">
          <h4>Jogadores ({{ players.length }})</h4>
          <ol>
            <li v-for="p in players" :key="p.id" :class="{ offline: !p.connected }">
              <span>{{ p.name }}</span>
              <strong>{{ p.score }}</strong>
            </li>
          </ol>
        </aside>
      </div>

      <button class="ghost" @click="leave">Sair da sala</button>
    </div>

    <!-- FIM -->
    <div v-else class="card">
      <h2>Disco de Ouro</h2>
      <p v-if="players[0]">Vencedor: <strong>{{ players[0].name }}</strong> com {{ players[0].score }} pontos.</p>
      <ol class="players">
        <li v-for="p in players" :key="p.id">{{ p.name }}: {{ p.score }}</li>
      </ol>
      <button v-if="isHost" :disabled="busy" @click="playAgain">Jogar de novo</button>
      <p v-else class="muted">Aguardando o host iniciar outra partida…</p>
      <button class="ghost" @click="leave">Sair da sala</button>
    </div>

    <RoomAlerts :alerts="alerts" />
    <RoomChat v-if="code && room" :messages="messages" :my-uid="uid" @send="sendChat" />
  </section>
</template>

