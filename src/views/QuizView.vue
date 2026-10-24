<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Question, WorkType } from '../data/questions';
import { isCorrectGuess } from '../game/answer';
import { pointsFor } from '../game/scoring';
import { blurPx } from '../game/reveal';
import { buildPool } from '../game/catalog';
import { DEFAULT_DIFFICULTY_MIX, DIFFICULTIES, DIFFICULTY_LABEL, type DifficultyMix } from '../game/difficulty';
import { DEFAULT_MIX, GROUPS, GROUP_LABEL, pickRound, type Group, type Mix } from '../game/mix';
import Multiplayer from '../components/Multiplayer.vue';
import BrandLogo from '../components/BrandLogo.vue';
import SettingsDialog from '../components/SettingsDialog.vue';
import CountdownRing from '../components/CountdownRing.vue';

type Phase = 'setup' | 'playing' | 'reveal' | 'finished';

const TYPE_LABEL: Record<WorkType, string> = {
  movie: 'Filme',
  series: 'Série',
  game: 'Jogo',
  anime: 'Anime',
};

const phase = ref<Phase>('setup');
const targetPoints = ref(100);
const durationSec = ref(20);
const selectedTypes = ref<WorkType[]>(['movie', 'series', 'game', 'anime']);
const difficultyMix = ref<DifficultyMix>({ ...DEFAULT_DIFFICULTY_MIX });
const mix = ref<Mix>({ ...DEFAULT_MIX });
const blurOn = ref(false); // a rodada atual é de capa desfocada?

function setMix(group: Group, event: Event) {
  const value = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
  mix.value = { ...mix.value, [group]: value };
}
const mixTotal = computed(() => GROUPS.reduce((sum, g) => sum + mix.value[g], 0));
function setDifficulty(difficulty: keyof DifficultyMix, event: Event) {
  const value = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
  difficultyMix.value = { ...difficultyMix.value, [difficulty]: value };
}
const difficultyTotal = computed(() => DIFFICULTIES.reduce((sum, d) => sum + difficultyMix.value[d], 0));
// Link com ?sala=CODIGO abre direto no multijogador.
const mode = ref<'solo' | 'multi'>(new URLSearchParams(window.location.search).has('sala') ? 'multi' : 'solo');


const score = ref(0);
const round = ref(0);
const usedIds = ref<Set<string>>(new Set());
const current = ref<Question | null>(null);
const guess = ref('');
const lastResult = ref<{ correct: boolean; points: number; answer: string } | null>(null);
const remainingMs = ref(0);
const feedback = ref('');

let startedAt = 0;
let tick: ReturnType<typeof setInterval> | null = null;

const pool = computed(() =>
  buildPool({
    targetPoints: targetPoints.value,
    durationSec: durationSec.value,
    types: selectedTypes.value,
    difficultyMix: difficultyMix.value,
    mix: mix.value,
  }),
);
const canStart = computed(() => pool.value.length > 0);
const secondsLeft = computed(() => Math.ceil(remainingMs.value / 1000));

/** Capa da pergunta atual: obras e também ator/personagem (que mostram a capa da obra). */
const currentPoster = computed(() => {
  const q = current.value;
  if (!q?.imageUrl || q.clueType === 'emoji' || q.clueType === 'phrase') return undefined;
  const clearCover = q.clueType === 'image' && !blurOn.value && phase.value === 'playing';
  return {
    posterUrl: clearCover && q.clearImageUrl ? q.clearImageUrl : q.imageUrl,
    hideTitle: clearCover && !q.clearImageUrl,
  };
});
/** 0 = início da rodada, 1 = tempo esgotado. */
const progress = computed(() => {
  const total = durationSec.value * 1000;
  return total > 0 ? 1 - remainingMs.value / total : 1;
});
/** Na revelação a capa aparece nítida; em rodadas nítidas nunca há desfoque. */
const posterBlur = computed(() => (phase.value === 'playing' && blurOn.value ? blurPx(progress.value) : 0));
const posterStyle = computed(() => (posterBlur.value > 0 ? { filter: `blur(${posterBlur.value}px)` } : undefined));

function stopTimer() {
  if (tick) clearInterval(tick);
  tick = null;
}

function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function startGame() {
  score.value = 0;
  round.value = 0;
  usedIds.value = new Set();
  nextRound();
}

function nextRound() {
  if (score.value >= targetPoints.value) {
    phase.value = 'finished';
    return;
  }
  const pick = pickRound(pool.value, usedIds.value, mix.value, difficultyMix.value);
  if (!pick) {
    phase.value = 'finished';
    return;
  }
  usedIds.value.add(pick.question.id);
  current.value = pick.question;
  blurOn.value = pick.blur;
  round.value += 1;
  guess.value = '';
  lastResult.value = null;
  feedback.value = '';
  phase.value = 'playing';

  const durationMs = durationSec.value * 1000;
  startedAt = performance.now();
  remainingMs.value = durationMs;
  stopTimer();
  tick = setInterval(() => {
    const elapsed = performance.now() - startedAt;
    remainingMs.value = Math.max(durationMs - elapsed, 0);
    if (remainingMs.value === 0) timeUp();
  }, 100);
}

function endRound(correct: boolean, points: number) {
  stopTimer();
  const q = current.value!;
  lastResult.value = { correct, points, answer: q.answers[0] };
  score.value += points;
  phase.value = 'reveal';
}

function timeUp() {
  endRound(false, 0);
  feedback.value = 'Tempo esgotado!';
}

function submit() {
  if (phase.value !== 'playing' || !current.value) return;
  const text = guess.value.trim();
  if (!text) return;

  if (isCorrectGuess(text, current.value.answers, { titleAliases: !current.value.kind || current.value.kind === 'work' })) {
    const elapsed = performance.now() - startedAt;
    const points = pointsFor(elapsed, durationSec.value * 1000);
    endRound(true, points);
    feedback.value = `Acertou! +${points} pontos`;
  } else {
    feedback.value = 'Não é essa. Tente de novo.';
    guess.value = '';
  }
}

function restart() {
  stopTimer();
  phase.value = 'setup';
}

onBeforeUnmount(stopTimer);
</script>

<template>
  <main class="app">
    <header class="brand">
      <RouterLink class="back" to="/">← Hub de jogos</RouterLink>
      <BrandLogo />
      <h1>Qual é a Obra?</h1>
      <p class="sub">Descubra o filme, série, jogo ou anime pela pista.</p>
    </header>

    <nav class="tabs">
      <button :class="{ active: mode === 'solo' }" @click="mode = 'solo'">Solo</button>
      <button :class="{ active: mode === 'multi' }" @click="mode = 'multi'">Multijogador</button>
    </nav>

    <template v-if="mode === 'solo'">
    <!-- CONFIGURAÇÃO -->
    <section v-if="phase === 'setup'" class="card">
      <SettingsDialog title="Configurações da partida" :summary="`${targetPoints} pts · ${durationSec}s por pista`">
      <label>
        Pontos para vencer
        <input v-model.number="targetPoints" type="number" min="20" step="10" />
      </label>

      <label>
        Tempo por pista (segundos)
        <input v-model.number="durationSec" type="number" min="5" max="60" />
      </label>

      <fieldset>
        <legend>Categorias</legend>
        <label v-for="(label, key) in TYPE_LABEL" :key="key" class="check">
          <input
            type="checkbox"
            :checked="selectedTypes.includes(key)"
            @change="selectedTypes = toggled(selectedTypes, key)"
          />
          {{ label }}
        </label>
      </fieldset>

      <fieldset>
        <legend>Dificuldade (peso em %; total {{ difficultyTotal }})</legend>
        <label v-for="d in DIFFICULTIES" :key="d" class="pct">
          <span>{{ DIFFICULTY_LABEL[d] }}</span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            :value="difficultyMix[d]"
            @change="setDifficulty(d, $event)"
          />
          <span class="muted">%</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Tipos de rodada (peso em %; total {{ mixTotal }})</legend>
        <label v-for="g in GROUPS" :key="g" class="pct">
          <span>{{ GROUP_LABEL[g] }}</span>
          <input type="number" min="0" max="100" step="5" :value="mix[g]" @change="setMix(g, $event)" />
          <span class="muted">%</span>
        </label>
        <span class="muted small">Ator e personagem mostram a capa da obra.</span>
      </fieldset>
      </SettingsDialog>

      <p class="muted">Perguntas disponíveis: {{ pool.length }}</p>
      <button :disabled="!canStart" @click="startGame">Começar</button>
    </section>

    <!-- JOGO -->
    <section v-else-if="phase === 'playing' || phase === 'reveal'" class="card">
      <div class="status quiz">
        <div class="status-meta">
          <span class="stat"><span>Faixa</span><strong>{{ round }}</strong></span>
          <span class="stat"><span>Placar</span><strong>{{ score }} / {{ targetPoints }}</strong></span>
        </div>
        <CountdownRing
          v-if="phase === 'playing'"
          :seconds="secondsLeft"
          :total="durationSec"
          :urgent="secondsLeft <= 5"
        />
      </div>

      <div :key="current?.id" class="clue" :class="current?.clueType">
        <img
          v-if="currentPoster"
          class="poster"
          :class="{ 'title-hidden': currentPoster.hideTitle }"
          :src="currentPoster.posterUrl"
          alt="Capa"
          :style="posterStyle"
        />
        <span v-if="current?.clueType === 'emoji'" class="emoji">{{ current.clue }}</span>
        <p v-else-if="current?.clueType === 'character'" class="character">
          Quem interpreta <strong>{{ current.clue }}</strong>
          em <strong>{{ current.workTitle }}</strong>?
        </p>
        <p v-else-if="current?.clueType === 'actor'" class="character">
          Qual personagem <strong>{{ current.clue }}</strong>
          interpreta em <strong>{{ current.workTitle }}</strong>?
        </p>
        <q v-else-if="current?.clueType === 'phrase'">{{ current.clue }}</q>
      </div>

      <form v-if="phase === 'playing'" class="row" @submit.prevent="submit">
        <input
          v-model="guess"
          :placeholder="current?.kind === 'actor' ? 'Digite o nome do ator…' : current?.kind === 'character' ? 'Digite o nome do personagem…' : 'Digite o nome da obra…'"
          autofocus
          autocomplete="off"
        />
        <button type="submit">Responder</button>
      </form>

      <div v-else class="reveal">
        <p v-if="lastResult?.correct" class="ok">{{ feedback }}</p>
        <p v-else class="bad">{{ feedback || 'Resposta:' }}</p>
        <p class="answer">
          <strong>{{ lastResult?.answer }}</strong>
          <span class="muted">
            <template v-if="current?.kind === 'actor'">
              (ator de {{ current.workTitle }})
            </template>
            <template v-else-if="current?.kind === 'character'">
              (personagem de {{ current.workTitle }})
            </template>
            <template v-else>
              ({{ current ? TYPE_LABEL[current.type] : '' }}<template v-if="current?.year">, {{ current.year }}</template>)
            </template>
          </span>
        </p>
        <button @click="nextRound">Próxima</button>
      </div>

      <p v-if="phase === 'playing' && feedback" class="bad">{{ feedback }}</p>
      <button class="ghost" @click="restart">Sair</button>
    </section>

    <!-- FIM -->
    <section v-else class="card">
      <h2>Fim de jogo</h2>
      <p>Placar final: <strong>{{ score }}</strong> pontos em {{ round }} rodadas.</p>
      <p v-if="score >= targetPoints" class="ok">Você venceu!</p>
      <p v-else class="muted">Sem perguntas disponíveis nesse filtro.</p>
      <button @click="restart">Jogar de novo</button>
    </section>
    </template>

    <Multiplayer v-else />
  </main>
</template>

