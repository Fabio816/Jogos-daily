<script setup lang="ts">
import { ref } from 'vue';
import TermoBoard from './TermoBoard.vue';

// Mostra um tabuleiro por palavra. Todos recebem os mesmos palpites.
withDefaults(
  defineProps<{
    words: string[];
    guesses: string[];
    tries: number;
    typing?: string[];
    cursor?: number;
    editable?: boolean;
    mini?: boolean;
  }>(),
  { typing: () => [], cursor: -1, editable: false, mini: false },
);

const emit = defineEmits<{ cell: [index: number] }>();

// O clique destaca a célula só no tabuleiro escolhido.
const focused = ref(0);

function pickCell(board: number, col: number) {
  focused.value = board;
  emit('cell', col);
}
</script>

<template>
  <div class="multi" :class="{ mini, single: words.length <= 1 }" :style="{ '--cols': Math.max(1, words.length) }">
    <TermoBoard
      v-for="(word, i) in words"
      :key="i"
      :guesses="guesses"
      :target="word"
      :tries="tries"
      :typing="typing"
      :cursor="i === focused ? cursor : -1"
      :editable="editable"
      :mini="mini"
      @cell="pickCell(i, $event)"
    />
  </div>
</template>
