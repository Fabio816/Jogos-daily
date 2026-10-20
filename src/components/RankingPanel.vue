<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { subscribeRanking, type RankingEntry } from '../lib/ranking';

defineProps<{ title?: string; limit?: number }>();
const entries = ref<RankingEntry[]>([]);
let unsub: (() => void) | null = null;

onMounted(() => {
  unsub = subscribeRanking((list) => {
    entries.value = list;
  });
});
onBeforeUnmount(() => unsub?.());
</script>

<template>
  <div class="card ranking">
    <h3>{{ title ?? 'Ranking geral' }}</h3>
    <p v-if="entries.length === 0" class="muted small">Ainda não há pontos. Jogue para aparecer aqui!</p>
    <ol v-else class="board-list">
      <li v-for="(e, i) in entries" :key="e.uid">
        <span><span class="rank">{{ i + 1 }}.</span> {{ e.name }}</span>
        <span class="muted small">{{ e.games }} jogos</span>
        <strong>{{ e.points }}</strong>
      </li>
    </ol>
  </div>
</template>
