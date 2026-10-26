<script setup lang="ts">
import { computed } from 'vue'

/**
 * Resultado da partida, sobre o lobby. "Jogar de novo" marca o jogador como
 * pronto (mesmas configurações); o anfitrião inicia quando todos estiverem
 * prontos; "Ajustar configurações" fecha o painel e mostra o lobby.
 */
const props = defineProps<{
  rows: Array<{ id: string; name: string; score: number; ready: boolean; connected: boolean; mine: boolean }>
  winnerName: string | null
  isHost: boolean
  canStart: boolean
  myReady: boolean
  startHint: string | null
}>()

const emit = defineEmits<{
  again: []
  start: []
  settings: []
}>()

const readyCount = computed(() => props.rows.filter((row) => row.ready).length)
</script>

<template>
  <div class="rank-overlay" role="dialog" aria-modal="true" aria-label="Resultado da partida">
    <section class="rank-card">
      <p class="rank-kicker">Fim de partida</p>
      <h2 class="rank-title">{{ winnerName ? `${winnerName} venceu!` : 'Empate' }}</h2>

      <ol class="rank-list">
        <li
          v-for="(row, index) in rows"
          :key="row.id"
          :class="{ first: index === 0, mine: row.mine, off: !row.connected }"
        >
          <span class="pos">{{ index + 1 }}</span>
          <span class="name">{{ row.name }}<em v-if="row.mine"> (você)</em></span>
          <span class="ready-badge" :class="row.ready ? 'ok' : 'wait'">{{ row.ready ? 'pronto' : 'aguardando' }}</span>
          <strong class="score">{{ row.score }}</strong>
        </li>
      </ol>
      <p class="rank-sub">Pontos = rodadas vencidas. {{ readyCount }}/{{ rows.length }} prontos para jogar de novo.</p>

      <div class="rank-actions">
        <button class="rank-btn primary" type="button" @click="emit('again')">
          {{ myReady ? 'Cancelar pronto' : 'Jogar de novo' }}
        </button>
        <button v-if="isHost" class="rank-btn go" type="button" :disabled="!canStart" @click="emit('start')">
          Começar nova partida
        </button>
        <button class="rank-btn" type="button" @click="emit('settings')">Ajustar configurações</button>
      </div>
      <p v-if="startHint" class="rank-hint">{{ startHint }}</p>
    </section>
  </div>
</template>

<style scoped>
.rank-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(4, 8, 16, 0.72);
  backdrop-filter: blur(6px);
}
.rank-card {
  width: min(540px, 94vw);
  padding: 26px 26px 22px;
  border-radius: 20px;
  background: linear-gradient(180deg, #13203a, #0b1222);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  color: #e6f2ff;
  animation: rankIn 0.35s ease-out;
}
@keyframes rankIn {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: none; }
}
.rank-kicker {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.7;
}
.rank-title {
  margin: 4px 0 16px;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 900;
  background: linear-gradient(90deg, #ffd166, #ff5d2e);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rank-list li {
  display: grid;
  grid-template-columns: 30px 1fr auto 36px;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
}
.rank-list li.first { border-color: rgba(255, 209, 102, 0.6); background: rgba(255, 209, 102, 0.1); }
.rank-list li.mine .name { font-weight: 800; }
.rank-list li.off { opacity: 0.5; }
.rank-list .pos { font-family: monospace; font-weight: 800; opacity: 0.8; }
.rank-list .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-list .score { font-family: monospace; font-size: 20px; text-align: right; }
.ready-badge { font-size: 11px; padding: 2px 8px; border-radius: 9px; }
.ready-badge.ok { background: rgba(46, 196, 182, 0.2); color: #2ec4b6; }
.ready-badge.wait { background: rgba(255, 255, 255, 0.1); opacity: 0.8; }
.rank-sub { margin: 12px 0 0; font-size: 13px; opacity: 0.75; }
.rank-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.rank-btn {
  flex: 1 1 150px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font-weight: 800;
  cursor: pointer;
}
.rank-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.rank-btn.primary { background: linear-gradient(90deg, #ff8a1f, #ff5d2e); border-color: transparent; color: #0b1020; }
.rank-btn.go { background: linear-gradient(90deg, #2ec4b6, #4cc9f0); border-color: transparent; color: #0b1020; }
.rank-hint { margin: 10px 0 0; font-size: 12.5px; opacity: 0.75; text-align: center; }
</style>
