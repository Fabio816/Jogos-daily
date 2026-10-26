<script setup lang="ts">
import { computed } from 'vue'
import { accentFor } from '../visual'
import { iconDataUrl, ITEM_INFO } from '../icons'
import type { ItemType } from '../sim'
import type { Snapshot } from '../messages'

/**
 * HUD da partida: placar, rodada, tempo (com alerta de "apressado"), estado do
 * fechamento e avisos (eliminado, proteção, contagem).
 */
const props = defineProps<{
  snapshot: Snapshot
  myId: string
  status: 'connecting' | 'open' | 'reconnecting' | 'closed'
}>()

const emit = defineEmits<{ leave: [] }>()

const foundPlayers = computed(() => props.snapshot.players)
const me = computed(() => foundPlayers.value.find((player) => player.id === props.myId) ?? null)

const timeLabel = computed(() => Math.ceil(props.snapshot.timeLeft).toString())
const timeDanger = computed(() => !props.snapshot.sudden && props.snapshot.timeLeft <= 10.5)
const roundLabel = computed(() => (props.snapshot.round > 0 ? `Rodada ${props.snapshot.round}` : null))

const banner = computed(() => {
  const snap = props.snapshot
  if (snap.phase === 'countdown') return 'Preparar!'
  if (snap.phase === 'roundEnd' && me.value?.alive) return 'Vitória da rodada!'
  if (snap.sudden) return 'FECHAMENTO!'
  if (snap.hurry) return 'Apresse-se!'
  return null
})

const eliminated = computed(() => me.value !== null && !me.value.alive && props.snapshot.phase === 'playing')

const scores = computed(() => {
  const order = props.snapshot.players
  return Object.entries(props.snapshot.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => {
      const player = order.find((entry) => entry.id === id)
      const index = player ? order.indexOf(player) : 99
      return { id, score, name: player?.name ?? id, dead: player ? !player.alive : true, accent: accentFor(index), mine: id === props.myId }
    })
})

const itemLegend = computed(() => Object.entries(ITEM_INFO).map(([type, info]) => ({ ...info, icon: iconDataUrl(type as ItemType) })))

const statusLabel = computed(() =>
  props.status === 'open' ? null : props.status === 'reconnecting' ? 'Reconectando...' : props.status === 'connecting' ? 'Conectando...' : 'Sala fechada',
)
</script>

<template>
  <div class="bs-hud">
    <div class="bs-hud-top">
      <div class="hud-box round" v-if="roundLabel">{{ roundLabel }}</div>
      <div class="hud-box timer" :class="{ danger: timeDanger, sudden: snapshot.sudden }">{{ timeLabel }}</div>
      <button class="hud-btn" type="button" @click="emit('leave')">Sair</button>
    </div>

    <div class="hud-banner" v-if="banner">{{ banner }}</div>
    <div class="hud-eliminated" v-if="eliminated">Eliminado — assistindo a rodada</div>
    <div class="hud-reconnect" v-if="statusLabel">{{ statusLabel }}</div>

    <aside class="hud-scores">
      <h3>Placar</h3>
      <ul>
        <li v-for="entry in scores" :key="entry.id" :class="{ mine: entry.mine, dead: entry.dead }">
          <span class="dot" :style="{ background: entry.accent }" />
          <span class="name">{{ entry.name }}<em v-if="entry.mine"> (você)</em></span>
          <strong>{{ entry.score }}</strong>
        </li>
      </ul>
    </aside>

    <aside class="hud-legend">
      <h3>Itens</h3>
      <ul>
        <li v-for="item in itemLegend" :key="item.label">
          <img :src="item.icon" alt="" width="22" height="22" />
          <span>{{ item.label }}</span>
          <small>{{ item.effect }}</small>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.hud-btn { margin-left: auto; padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.25); background: rgba(10,14,26,0.55); color: #ff9d9d; font-size: 12.5px; cursor: pointer; }
.bs-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.bs-hud :deep(*) {
  pointer-events: auto;
}
.bs-hud-top {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.hud-box {
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(10, 14, 26, 0.55);
  color: #e6f2ff;
  font-family: monospace;
  font-size: 20px;
  font-weight: 700;
}
.hud-box.danger { color: #ffd166; }
.hud-box.sudden { color: #ff5d2e; }
.hud-banner {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 34px;
  font-weight: 800;
  color: #ff5d2e;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
.hud-eliminated {
  position: absolute;
  bottom: 22%;
  left: 50%;
  transform: translateX(-50%);
  color: #ffd166;
  font-size: 16px;
}
.hud-reconnect {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  color: #9ce7ff;
  font-size: 13px;
}
.hud-scores {
  position: absolute;
  top: 12px;
  left: 14px;
  background: rgba(10, 14, 26, 0.55);
  border-radius: 12px;
  padding: 8px 10px;
  color: #cfe6ff;
  min-width: 170px;
}
.hud-legend { display: none; }
.hud-scores h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: 0.12em; opacity: 0.8; }
.hud-scores ul { list-style: none; margin: 0; padding: 0; }
.hud-scores li { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.hud-scores li.mine { color: #fff; }
.hud-scores li.dead { opacity: 0.45; }
.hud-scores li .dot { width: 9px; height: 9px; border-radius: 50%; }
.hud-scores li .name { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-scores li strong { font-family: monospace; }
</style>
