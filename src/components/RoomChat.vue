<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { ChatMessage } from '../multiplayer/room';

const props = defineProps<{ messages: ChatMessage[]; myUid: string }>();
const emit = defineEmits<{ send: [text: string] }>();

const text = ref('');
const list = ref<HTMLElement | null>(null);

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (list.value) list.value.scrollTop = list.value.scrollHeight;
  },
);

function submit() {
  const value = text.value.trim();
  if (!value) return;
  emit('send', value);
  text.value = '';
}
</script>

<template>
  <div class="chat card">
    <h4>Chat da sala</h4>

    <div ref="list" class="feed">
      <p v-if="messages.length === 0" class="muted small">Nenhuma mensagem ainda.</p>
      <div
        v-for="m in messages"
        :key="m.id"
        class="msg"
        :class="[m.kind, { mine: m.uid === myUid }]"
      >
        <template v-if="m.kind === 'guess'">
          <span class="who">{{ m.name }}</span> tentou: <em>{{ m.text }}</em>
        </template>
        <template v-else>
          <span class="who">{{ m.name }}:</span> {{ m.text }}
        </template>
      </div>
    </div>

    <form class="row" @submit.prevent="submit">
      <input v-model="text" maxlength="200" placeholder="Escreva uma mensagem…" autocomplete="off" />
      <button type="submit">Enviar</button>
    </form>
  </div>
</template>

