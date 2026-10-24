<script setup lang="ts">
import { computed, ref } from 'vue';
import { inviteLinkFor } from '../lib/invite';

const props = defineProps<{ code: string; path: string }>();

const link = computed(() => inviteLinkFor(props.path, props.code));
const copied = ref(false);
const input = ref<HTMLInputElement | null>(null);

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    input.value?.select();
  }
}
</script>

<template>
  <div class="room-invite">
    <span class="muted small">Link para convidar</span>
    <div class="row">
      <input ref="input" readonly :value="link" @focus="($event.target as HTMLInputElement).select()" />
      <button type="button" @click="copy">{{ copied ? 'Copiado!' : 'Copiar' }}</button>
    </div>
  </div>
</template>
