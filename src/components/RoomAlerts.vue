<script setup lang="ts">
import type { AlertItem } from '../lib/alerts';

defineProps<{ alerts: AlertItem[] }>();
</script>

<template>
  <div v-if="alerts.length" class="room-alerts" role="alert" aria-live="polite">
    <p v-for="a in alerts" :key="a.id" class="room-alert">
      <strong>Aviso:</strong> <strong>{{ a.name }}</strong> abriu as ferramentas de desenvolvedor durante a partida
      <span class="room-alert-why">({{ a.reason }})</span>
    </p>
  </div>
</template>
