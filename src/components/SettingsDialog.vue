<script setup lang="ts">
import { ref } from 'vue';

// Configurações escondidas numa janela. O resumo mostra o que está valendo sem abrir o menu.
defineProps<{ title?: string; summary?: string }>();
const open = ref(false);
</script>

<template>
  <div class="settings-bar">
    <span v-if="summary" class="muted small settings-summary">{{ summary }}</span>
    <button type="button" class="ghost" @click="open = true">⚙ Configurações</button>
  </div>

  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="open = false">
      <div class="modal card" role="dialog" aria-modal="true" :aria-label="title ?? 'Configurações'">
        <div class="modal-head">
          <h2>{{ title ?? 'Configurações' }}</h2>
          <button type="button" class="ghost" @click="open = false">Fechar</button>
        </div>
        <div class="settings-grid">
          <slot />
        </div>
        <button type="button" @click="open = false">Pronto</button>
      </div>
    </div>
  </Teleport>
</template>
