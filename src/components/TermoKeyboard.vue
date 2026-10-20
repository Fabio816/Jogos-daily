<script setup lang="ts">
import type { Mark } from '../games/termo/logic';

defineProps<{ marks: Record<string, Mark>; disabled?: boolean }>();
const emit = defineEmits<{ key: [letter: string]; enter: []; back: [] }>();

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
</script>

<template>
  <div class="termo-keyboard" :class="{ off: disabled }">
    <div v-for="(row, r) in ROWS" :key="r" class="krow">
      <button v-if="r === 2" class="key wide" :disabled="disabled" @click="emit('enter')">ENTER</button>
      <button
        v-for="letter in row"
        :key="letter"
        class="key"
        :class="marks[letter]"
        :disabled="disabled"
        @click="emit('key', letter)"
      >{{ letter.toUpperCase() }}</button>
      <button v-if="r === 2" class="key wide" :disabled="disabled" @click="emit('back')">⌫</button>
    </div>
  </div>
</template>
