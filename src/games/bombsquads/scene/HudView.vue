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

const bannerSub = computed(() => {
  if (props.snapshot.phase === 'countdown') return props.snapshot.round > 0 ? `Rodada ${props.snapshot.round}` : null
  if (props.snapshot.phase === 'roundEnd') return 'Próxima rodada em instantes'
  return null
})
const bannerTone = computed(() => {
  if (props.snapshot.sudden) return 'tone-danger'
  if (props.snapshot.phase === 'roundEnd') return 'tone-win'
  return 'tone-go'
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

    <div class="hud-banner" :class="bannerTone" v-if="banner" :key="banner">
      <span class="hud-banner-main">{{ banner }}</span>
      <span class="hud-banner-sub" v-if="bannerSub">{{ bannerSub }}</span>
    </div>
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
  right: 76px;
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
  top: 34%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: min(92vw, 880px);
  text-align: center;
  pointer-events: none;
  animation: bannerPop 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.hud-banner-main {
  font-size: clamp(34px, 7vw, 84px);
  font-weight: 900;
  line-height: 1.05;
  overflow-wrap: break-word;
  letter-spacing: 0.02em;
  background: linear-gradient(180deg, #fff3b0 0%, #ffb703 45%, #ff5d2e 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 4px 18px rgba(255, 93, 46, 0.45)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}
.hud-banner-sub {
  font-size: clamp(15px, 2.4vw, 22px);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #e6f2ff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
  padding: 4px 14px;
  border-radius: 999px;
  background: rgba(10, 14, 26, 0.55);
}
.hud-banner.tone-win .hud-banner-main {
  background: linear-gradient(180deg, #d9ffe9 0%, #2ec4b6 60%, #4cc9f0 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
.hud-banner.tone-danger .hud-banner-main {
  background: linear-gradient(180deg, #ffd6c7 0%, #ff5d2e 55%, #d00000 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
@keyframes bannerPop {
  0% { opacity: 0; transform: translateX(-50%) scale(0.5); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
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
  top: 68px;
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
