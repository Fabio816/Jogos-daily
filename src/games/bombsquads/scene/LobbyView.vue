<script setup lang="ts">
import { computed, ref } from 'vue'
import { LEVELS, MAP_SIZE_CHOICES, type Level, type MapSizeChoice, type MatchSettings } from '../sim'
import type { LobbyPlayer } from '../messages'

/**
 * Lobby da sala: código, quem está dentro, pronto, configurações do host e
 * botão de começar.
 */
const props = defineProps<{
  code: string
  hostId: string | null
  players: LobbyPlayer[]
  myId: string
  isHost: boolean
  settings: MatchSettings
  minPlayers: number
  maxPlayers: number
  status: 'lobby' | 'playing'
  statusText: string
}>()

const emit = defineEmits<{
  ready: [value: boolean]
  start: []
  settings: [value: MatchSettings]
  leave: []
}>()

const MAP_LABELS: Record<MapSizeChoice, string> = {
  auto: 'Automático',
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
  xl: 'Enorme',
}
const LEVEL_LABELS: Record<Level, string> = { low: 'Poucas', normal: 'Normal', high: 'Muitas' }

const myPlayer = computed(() => props.players.find((player) => player.id === props.myId))
const everyoneReady = computed(() => props.players.every((player) => player.ready))
const canStart = computed(() => props.isHost && props.status === 'lobby' && props.players.length >= props.minPlayers && everyoneReady.value)
const notReadyCount = computed(() => props.players.filter((player) => !player.ready).length)

const startHint = computed(() => {
  if (props.status !== 'lobby') return 'Partida em andamento'
  if (!props.isHost) return props.players.length >= props.minPlayers ? 'Esperando o anfitrião começar...' : 'Faltam jogadores para começar'
  if (props.players.length < props.minPlayers) return 'Mínimo de 2 jogadores'
  if (notReadyCount.value > 0) return `${notReadyCount.value} jogador(es) ainda não estão prontos`
  return null
})

function setMapSize(value: MapSizeChoice): void {
  emit('settings', { ...props.settings, mapSize: value })
}
function setLevel(field: 'crates' | 'itemDrop' | 'powerCap', value: Level): void {
  emit('settings', { ...props.settings, [field]: value })
}

const copyState = ref<'idle' | 'copied'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyInvite(): Promise<void> {
  const url = new URL(window.location.href)
  url.searchParams.set('sala', props.code)
  try {
    await navigator.clipboard.writeText(url.toString())
    copyState.value = 'copied'
  } catch {
    copyState.value = 'idle'
  }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copyState.value = 'idle'), 1600)
}
</script>

<template>
  <section class="window bs-lobby-window">
    <div class="panel bs-join-code" v-if="code">
      <span class="code-label">Código da sala</span>
      <strong class="code-value">{{ code }}</strong>
      <button class="bs-btn ghost" type="button" @click="copyInvite">
        {{ copyState === 'copied' ? 'Link copiado!' : 'Copiar link do convite' }}
      </button>
    </div>

    <div class="panel bs-lobby-players">
      <h2>Jogadores ({{ players.length }}/{{ maxPlayers }})</h2>
      <ul class="lobby-list">
        <li v-for="player in players" :key="player.id" :class="{ me: player.id === myId }">
          <span class="dot" :style="{ background: player.ready ? '#2ec4b6' : '#4a5568' }" />
          <span class="name">
            {{ player.name }}
            <em v-if="player.id === myId">(você)</em>
          </span>
          <span class="host" v-if="player.id === hostId">anfitrião</span>
          <span class="badge" :class="!player.connected ? 'off' : player.ready ? 'ok' : 'wait'">
            {{ !player.connected ? 'desconectado' : player.ready ? 'pronto' : 'aguardando' }}
          </span>
        </li>
      </ul>

      <button class="bs-btn bs-primary" :class="{ 'is-ready': myPlayer?.ready }" type="button" @click="emit('ready', !myPlayer?.ready)">
        {{ myPlayer?.ready ? 'Cancelar pronto' : 'Estou pronto' }}
      </button>
      <button class="bs-btn bs-danger" type="button" @click="emit('leave')">Sair da sala</button>
    </div>

    <div class="panel bs-lobby-settings">
      <h2>Configurações</h2>
      <p v-if="!isHost" class="hint">Só o anfitrião pode mudar.</p>
      <label class="field">
        <span>Tamanho do mapa</span>
        <select :disabled="!isHost" :value="settings.mapSize" @change="setMapSize(($event.target as HTMLSelectElement).value as MapSizeChoice)">
          <option v-for="choice in MAP_SIZE_CHOICES" :key="choice" :value="choice">{{ MAP_LABELS[choice] }}</option>
        </select>
      </label>
      <label class="field">
        <span>Caixas ({{ settings.crates }})</span>
        <select :disabled="!isHost" :value="settings.crates" @change="setLevel('crates', ($event.target as HTMLSelectElement).value as Level)">
          <option v-for="level in LEVELS" :key="level" :value="level">{{ LEVEL_LABELS[level] }}</option>
        </select>
      </label>
      <label class="field">
        <span>Itens nas caixas ({{ settings.itemDrop }})</span>
        <select :disabled="!isHost" :value="settings.itemDrop" @change="setLevel('itemDrop', ($event.target as HTMLSelectElement).value as Level)">
          <option v-for="level in LEVELS" :key="level" :value="level">{{ LEVEL_LABELS[level] }}</option>
        </select>
      </label>
      <label class="field">
        <span>Limite de power-ups ({{ settings.powerCap }})</span>
        <select :disabled="!isHost" :value="settings.powerCap" @change="setLevel('powerCap', ($event.target as HTMLSelectElement).value as Level)">
          <option v-for="level in LEVELS" :key="level" :value="level">{{ LEVEL_LABELS[level] }}</option>
        </select>
      </label>
    </div>

    <div class="panel bs-lobby-start">
      <p v-if="startHint" class="hint">{{ startHint }}</p>
      <button class="bs-btn bs-primary bs-big" type="button" :disabled="!canStart" @click="emit('start')">
        Começar partida
      </button>
      <p class="err" v-if="statusText">{{ statusText }}</p>
    </div>
  </section>
</template>

<style scoped>
.bs-lobby-window { max-width: 760px; margin: 24px auto; display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
.bs-join-code { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; }
.code-label { font-size: 12px; letter-spacing: 0.12em; opacity: 0.75; text-transform: uppercase; }
.code-value { font-family: monospace; font-size: 30px; letter-spacing: 0.2em; }
.bs-lobby-players, .bs-lobby-settings { display: flex; flex-direction: column; gap: 8px; }
.lobby-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.lobby-list li { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.lobby-list li.me .name { font-weight: 700; }
.lobby-list .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.lobby-list .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lobby-list .host { font-size: 11px; opacity: 0.7; }
.badge { font-size: 11px; padding: 1px 7px; border-radius: 9px; }
.badge.ok { background: rgba(46, 196, 182, 0.18); color: #2ec4b6; }
.badge.wait { background: rgba(255, 255, 255, 0.1); opacity: 0.75; }
.badge.off { background: rgba(255, 109, 46, 0.14); color: #ff9d6b; }
.field { display: flex; flex-direction: column; gap: 3px; }
.field span { font-size: 12px; opacity: 0.75; }
.field select { padding: 7px 9px; border-radius: 8px; background: rgba(0,0,0,0.35); color: inherit; border: 1px solid rgba(255,255,255,0.22); }
.field select:disabled { opacity: 0.5; }
.hint { font-size: 12.5px; opacity: 0.75; margin: 0; }
.err { color: #ff9d9d; font-size: 13px; margin: 6px 0 0; }
.bs-btn { padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: inherit; font-weight: 700; cursor: pointer; }
.bs-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.bs-btn.ghost { padding: 6px 10px; font-size: 12.5px; width: auto; }
.bs-primary { background: var(--action, #c15f3c); border-color: transparent; }
.bs-danger { color: #ff9d9d; }
.bs-big { font-size: 17px; padding: 12px; }
.bs-lobby-start { display: flex; flex-direction: column; gap: 8px; }
.bs-lobby-note { font-size: 13px; opacity: 0.8; margin: 0; }
@media (max-width: 640px) { .bs-lobby-window { grid-template-columns: 1fr; } }
</style>
