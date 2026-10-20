<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BrandLogo from '../components/BrandLogo.vue';
import { ensureSignedIn } from '../firebase';
import { serverNow } from '../lib/time';
import { addRankingPoints } from '../lib/ranking';
import { normalizeWord } from '../games/termo/logic';
import { loadBombData, type BombData } from '../games/bomb/data';
import { currentUid, isTurnExpired, MIN_PLAYERS, START_LIVES, turnSeconds, type BombRoom } from '../games/bomb/logic';
import {
  createBombRoom,
  expireBombTurn,
  joinBombRoom,
  startBomb,
  subscribeBombRoom,
  submitBombWord,
} from '../games/bomb/room';

const data = ref<BombData | null>(null);
const loadError = ref('');
const uid = ref('');
const name = ref(localStorage.getItem('qeo:name') ?? '');
const joinCode = ref('');
const code = ref('');
const room = ref<BombRoom | null>(null);
const now = ref(serverNow());
const typing = ref('');
const message = ref('');
const busy = ref(false);
let unsubRoom: (() => void) | null = null;
let expiring = false;

const timer = setInterval(() => {
  now.value = serverNow();
  if (code.value && room.value && data.value && !expiring && isTurnExpired(room.value, now.value)) {
    expiring = true;
    expireBombTurn(code.value, data.value.syllables)
      .catch(() => {})
      .finally(() => {
        expiring = false;
      });
  }
}, 200);

const isHost = computed(() => !!room.value && room.value.hostUid === uid.value);
const playing = computed(() => room.value?.status === 'playing');
const turnUid = computed(() => (room.value ? currentUid(room.value) : undefined));
const myTurn = computed(() => playing.value && turnUid.value === uid.value);
const secondsLeft = computed(() => {
  if (!room.value || !playing.value) return 0;
  return Math.max(0, Math.ceil((room.value.deadline - now.value) / 1000));
});
const turnProgress = computed(() => {
  if (!room.value || !playing.value) return 0;
  const total = turnSeconds(room.value.turns) * 1000;
  return Math.min(1, Math.max(0, (room.value.deadline - now.value) / total));
});
const players = computed(() => {
  if (!room.value) return [];
  const order = room.value.order.length ? room.value.order : Object.keys(room.value.players);
  return order.map((id) => ({ id, ...room.value!.players[id] })).filter((p) => p.name);
});
const winnerName = computed(() => {
  const w = room.value?.winnerUid;
  return w ? (room.value?.players[w]?.name ?? '?') : null;
});
const turnName = computed(() => (turnUid.value ? room.value?.players[turnUid.value]?.name : ''));

const BOMB_C = 2 * Math.PI * 64;
const activeIndex = computed(() => players.value.findIndex((p) => p.id === turnUid.value));
const aliveCount = computed(() => players.value.filter((p) => p.lives > 0).length);
const bombOffset = computed(() => BOMB_C * (1 - turnProgress.value));

const hitUid = ref('');
let hitTimer: ReturnType<typeof setTimeout> | null = null;
const lastLives: Record<string, number> = {};

watch(
  players,
  (list) => {
    for (const p of list) {
      const before = lastLives[p.id];
      if (before !== undefined && p.lives < before) {
        hitUid.value = p.id;
        if (hitTimer) clearTimeout(hitTimer);
        hitTimer = setTimeout(() => {
          hitUid.value = '';
        }, 650);
      }
      lastLives[p.id] = p.lives;
    }
  },
  { deep: true },
);

function playerStyle(i: number) {
  const n = Math.max(1, players.value.length);
  const angle = (i / n) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  return {
    left: `${50 + Math.cos(rad) * 37}%`,
    top: `${50 + Math.sin(rad) * 37}%`,
  };
}

const turnArrowStyle = computed(() => {
  const n = Math.max(1, players.value.length);
  const i = activeIndex.value;
  const angle = (i >= 0 ? i : 0) / n * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  return {
    left: `${50 + Math.cos(rad) * 27}%`,
    top: `${50 + Math.sin(rad) * 27}%`,
    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
  };
});

/** Pontos no ranking geral: 30 para o vencedor, 5 para quem participou. */
const WINNER_POINTS = 30;
const PARTICIPATION_POINTS = 5;

// Ao fim da partida, cada jogador grava os próprios pontos uma única vez.
watch(
  () => room.value?.status,
  (status) => {
    if (status !== 'finished' || !room.value || !uid.value) return;
    const key = `bomb:rec:${code.value}:${room.value.turns}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const points = room.value.winnerUid === uid.value ? WINNER_POINTS : PARTICIPATION_POINTS;
    addRankingPoints(uid.value, name.value.trim() || 'Jogador', points).catch(() => {});
  },
);

async function enterRoom(roomCode: string) {
  code.value = roomCode;
  unsubRoom?.();
  unsubRoom = subscribeBombRoom(roomCode, (r) => {
    room.value = r;
  });
}

async function runAction(task: () => Promise<void>) {
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
  return runAction(async () => {
    localStorage.setItem('qeo:name', name.value.trim());
    await enterRoom(await createBombRoom(name.value.trim()));
  });
}

function join() {
  return runAction(async () => {
    const target = joinCode.value.trim().toUpperCase();
    if (!target) throw new Error('Digite o código da sala.');
    localStorage.setItem('qeo:name', name.value.trim());
    await joinBombRoom(target, name.value.trim());
    await enterRoom(target);
  });
}

function start() {
  if (!data.value) return;
  return runAction(async () => {
    const result = await startBomb(code.value, data.value!.syllables);
    if (!result.committed) message.value = `É preciso ser pelo menos ${MIN_PLAYERS} jogadores para começar.`;
  });
}

async function send() {
  if (!myTurn.value || !data.value || !room.value) return;
  const word = normalizeWord(typing.value);
  if (!word) return;
  const syllable = room.value.syllable;
  if (!word.includes(syllable)) {
    message.value = `A palavra precisa conter "${syllable.toUpperCase()}".`;
    return;
  }
  const valid = data.value.dictionary.has(word);
  if (!valid) {
    message.value = 'Essa palavra não está no dicionário.';
    return;
  }
  typing.value = '';
  message.value = '';
  const result = await submitBombWord(code.value, uid.value, word, valid, data.value.syllables).catch(() => null);
  if (!result?.committed) message.value = 'Tempo esgotado ou palavra já usada. Tente outra.';
}

function leave() {
  unsubRoom?.();
  unsubRoom = null;
  room.value = null;
  code.value = '';
  typing.value = '';
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && myTurn.value) void send();
}

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  try {
    data.value = await loadBombData();
    uid.value = (await ensureSignedIn()).uid;
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Erro ao carregar o Bomb Party.';
  }
});

onBeforeUnmount(() => {
  clearInterval(timer);
  window.removeEventListener('keydown', onKey);
  unsubRoom?.();
  if (hitTimer) clearTimeout(hitTimer);
});
</script>

<template>
  <main class="app bomb">
    <header class="brand">
      <RouterLink class="back" to="/">← Hub de jogos</RouterLink>
      <BrandLogo />
      <h1>Bomb Party</h1>
      <p class="sub">Digite uma palavra com a sílaba antes que a bomba exploda.</p>
    </header>

    <p v-if="loadError" class="bad">{{ loadError }}</p>
    <p v-else-if="!data" class="muted">Carregando palavras…</p>

    <template v-else>
      <!-- ENTRAR -->
      <section v-if="!code" class="card">
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
        </div>
        <h3>Jogadores ({{ players.length }})</h3>
        <ul class="players">
          <li v-for="p in players" :key="p.id">
            {{ p.name }}
            <span v-if="p.id === room.hostUid" class="tag">host</span>
            <span v-if="p.id === uid" class="tag you">você</span>
          </li>
        </ul>
        <p class="muted small">Cada jogador começa com {{ START_LIVES }} vidas. Quem zerar as vidas sai.</p>
        <button v-if="isHost" :disabled="busy || players.length < MIN_PLAYERS" @click="start">
          Começar partida
        </button>
        <p v-else class="muted">Aguardando o host começar…</p>
        <p v-if="message" class="bad">{{ message }}</p>
        <button class="ghost" @click="leave">Sair da sala</button>
      </section>

      <!-- PARTIDA -->
      <section v-else-if="room.status === 'playing'" class="card bomb-game">
        <div class="bomb-head">
          <span class="bomb-turn" :class="{ mine: myTurn }">
            <span class="bomb-dot" aria-hidden="true"></span>
            <template v-if="myTurn">Sua vez!</template>
            <template v-else>Vez de <strong>{{ turnName }}</strong></template>
          </span>
          <span class="bomb-alive">{{ aliveCount }} na mesa</span>
        </div>

        <div class="bomb-arena">
          <div class="bomb-table">
            <div class="bomb-orbit" aria-hidden="true"></div>

            <div
              v-for="(p, i) in players"
              :key="p.id"
              class="bomb-player"
              :class="{ active: p.id === turnUid, out: p.lives <= 0, me: p.id === uid, hit: p.id === hitUid }"
              :style="playerStyle(i)"
            >
              <span class="bomb-pname">
                {{ p.name }}<span v-if="p.id === uid" class="bomb-you">você</span>
              </span>
              <span class="bomb-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3.2a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 10.6c4.5 0 7.6 2.5 8.1 6.6.1.8-.5 1.6-1.4 1.6H5.3c-.9 0-1.5-.8-1.4-1.6.5-4.1 3.6-6.6 8.1-6.6Z" />
                </svg>
              </span>
              <span class="bomb-hearts" :aria-label="`${p.lives} vidas`">
                <template v-if="p.lives > 0">
                  <svg v-for="n in p.lives" :key="n" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 21s-8.2-5.4-8.2-11.2A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.2 2.9C20.2 15.6 12 21 12 21Z" />
                  </svg>
                </template>
                <span v-else class="bomb-out">fora</span>
              </span>
            </div>

            <div class="bomb-core" :class="{ warn: secondsLeft <= 6, urgent: secondsLeft <= 3, mine: myTurn }">
              <svg class="bomb-clock" viewBox="0 0 140 140" aria-hidden="true">
                <circle class="bomb-clock-track" cx="70" cy="70" r="64" />
                <circle
                  class="bomb-clock-bar"
                  cx="70"
                  cy="70"
                  r="64"
                  :stroke-dasharray="BOMB_C"
                  :stroke-dashoffset="bombOffset"
                />
              </svg>
              <div class="bomb-face">
                <span class="bomb-syllable">{{ room.syllable.toUpperCase() }}</span>
                <span class="bomb-seconds">{{ secondsLeft }}s</span>
              </div>
              <span class="bomb-spark" aria-hidden="true"></span>
            </div>

            <div
              v-if="activeIndex >= 0 && players.length > 1"
              class="bomb-turn-arrow"
              :style="turnArrowStyle"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24"><path d="M12 2 3.8 13.6h5.1V22h6.2v-8.4h5.1L12 2Z" /></svg>
            </div>
          </div>
        </div>

        <form v-if="myTurn" class="row bomb-form" @submit.prevent="send">
          <input
            v-model="typing"
            autofocus
            autocomplete="off"
            :placeholder="`Palavra com ${room.syllable.toUpperCase()}…`"
          />
          <button type="submit">Enviar</button>
        </form>
        <p v-else class="bomb-wait">
          <template v-if="turnName">Aguardando <strong>{{ turnName }}</strong>…</template>
          <template v-else>Aguardando a próxima vez…</template>
        </p>

        <p v-if="message" class="bad">{{ message }}</p>
        <p v-if="room.event" class="bomb-event">{{ room.event.text }}</p>

        <button class="ghost" @click="leave">Sair da sala</button>
      </section>

      <!-- FIM -->
      <section v-else class="card">
        <h2>Fim de partida</h2>
        <p v-if="winnerName">Vencedor: <strong>{{ winnerName }}</strong> 💣</p>
        <p v-if="room.event" class="event">{{ room.event.text }}</p>
        <button v-if="isHost" :disabled="busy" @click="start">Jogar de novo</button>
        <p v-else class="muted">Aguardando o host começar outra partida…</p>
        <button class="ghost" @click="leave">Sair da sala</button>
      </section>
    </template>
  </main>
</template>
