<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ seconds: number; total: number; urgent?: boolean }>(),
  { urgent: false },
);

const R = 15;
const C = 2 * Math.PI * R;

const progress = computed(() => {
  if (props.total <= 0) return 0;
  return Math.min(1, Math.max(0, props.seconds / props.total));
});

const offset = computed(() => C * (1 - progress.value));
</script>

<template>
  <div class="countdown" :class="{ urgent }" role="timer" :aria-label="`${seconds} segundos restantes`">
    <svg viewBox="0 0 38 38" aria-hidden="true">
      <circle class="countdown-track" cx="19" cy="19" :r="R" />
      <circle
        class="countdown-bar"
        cx="19"
        cy="19"
        :r="R"
        :stroke-dasharray="C"
        :stroke-dashoffset="offset"
      />
    </svg>
    <span>{{ seconds }}</span>
  </div>
</template>
