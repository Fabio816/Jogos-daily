<script setup lang="ts">
import { computed } from 'vue';
import { MAX_TRIES, WORD_LEN, evaluate, type Mark } from '../games/termo/logic';

const props = withDefaults(
  defineProps<{
    guesses: string[];
    /** Palavra secreta. Sem ela (null) as letras aparecem neutras. */
    target: string | null;
    /** Letras digitadas na linha atual (só o jogador local). */
    typing?: string[];
    /** Célula selecionada na linha atual (0 a 4). */
    cursor?: number;
    /** Permite clicar numa célula para digitar nela. */
    editable?: boolean;
    /** Versão reduzida, só com as cores (para ver o progresso dos colegas). */
    mini?: boolean;
    /** Número de tentativas desta partida (3 a 6). */
    tries?: number;
  }>(),
  { typing: () => [], cursor: -1, editable: false, mini: false, tries: MAX_TRIES },
);

const emit = defineEmits<{ cell: [index: number] }>();

function clickCell(row: number, col: number) {
  if (!props.editable || row !== props.guesses.length) return;
  emit('cell', col);
}

const rows = computed(() =>
  Array.from({ length: props.tries }, (_, r) => {
    const guess = props.guesses[r];
    if (guess !== undefined) {
      const marks: Mark[] = props.target ? evaluate(guess, props.target) : Array(WORD_LEN).fill('absent');
      return { cells: guess.split('').map((letter, i) => ({ letter, mark: marks[i], known: !!props.target })) };
    }
    if (r === props.guesses.length && props.typing !== undefined) {
      return {
        cells: Array.from({ length: WORD_LEN }, (_, i) => ({ letter: props.typing?.[i] ?? '', mark: 'empty' as const, known: false })),
      };
    }
    return { cells: Array.from({ length: WORD_LEN }, () => ({ letter: '', mark: 'empty' as const, known: false })) };
  }),
);
</script>

<template>
  <div class="termo-board" :class="{ mini }">
    <div v-for="(row, r) in rows" :key="r" class="trow" :class="{ editable: editable && r === guesses.length }">
      <span
        v-for="(cell, c) in row.cells"
        :key="c"
        class="tile"
        :class="[cell.mark, { typed: cell.letter && cell.mark === 'empty', cursor: editable && r === guesses.length && cursor === c }]"
        @click="clickCell(r, c)"
      >{{ mini ? '' : cell.letter }}</span>
    </div>
  </div>
</template>
