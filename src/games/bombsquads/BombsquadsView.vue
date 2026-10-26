<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MatchScene from './scene/MatchScene.vue'
import LobbyView from './scene/LobbyView.vue'
import HudView from './scene/HudView.vue'
import { Connection, type ConnectionStatus } from './connection'
import { createRoomCode, roomUrl, WS_BASE } from './config'
import { GAME_KEYS } from './input'
import { MatchClient } from './match-client'
import { clearSession, loadName, loadSession, saveName, saveSession, type Session } from './session'
import type { ClientMessage, LobbyMessage, Snapshot, ServerMessage } from './messages'
import type { MatchSettings } from './sim'

/**
 * Bombsquads: entrada (nome/código), lobby e partida. Uma conexão por página;
 * servidor autoritativo na Cloudflare (server/bombsquads).
 */
const ERROR_TEXT: Record<string, string> = {
  room_full: 'Sala lotada (máximo 10 jogadores).',
  match_in_progress: 'A partida já começou nesta sala.',
  bad_token: 'Sessão desatualizada. Tente entrar de novo.',
  bad_message: 'Mensagem estranha do servidor.',
  not_host: 'Só o anfitrião pode fazer isso.',
  not_enough: 'Faltam jogadores para começar (mínimo 2).',
  not_ready: 'Nem todo mundo está pronto.',
  invalid_settings: 'Configuração inválida.',
}

const route = useRoute()

const name = ref(loadName())
const codeInput = ref(typeof route.query.sala === 'string' ? route.query.sala.toUpperCase() : '')
const busy = ref(false)
const status = shallowRef<ConnectionStatus>('closed')
const errorMessage = ref<string | null>(null)

const session = shallowRef<Session | null>(null)
const lobby = shallowRef<LobbyMessage | null>(null)
const snapshot = shallowRef<Snapshot | null>(null)
const match = shallowRef<MatchClient | null>(null)
const connection = shallowRef<Connection | null>(null)

const myId = computed(() => session.value?.playerId ?? '')
const playing = computed(() => lobby.value?.status === 'playing' && snapshot.value !== null)

const held = new Set<string>()

function helloMessage(): ClientMessage {
  const saved = loadSession()
  const reuse = saved && saved.code === codeInput.value ? saved : null
  session.value = reuse
  return {
    t: 'hello',
    name: name.value.trim().slice(0, 16) || 'Jogador',
    playerId: reuse?.playerId,
    token: reuse?.token,
  }
}

function onMessage(raw: ServerMessage): void {
  const message = raw as { t: string } & typeof raw
  debugMessage('<', message)
  if (message.t === 'welcome') {
    const data = message as unknown as { playerId: string; token: string; code: string }
    const next: Session = { code: data.code, playerId: data.playerId, token: data.token, name: name.value.trim() || 'Jogador' }
    session.value = next
    saveSession(next)
    saveName(next.name)
    match.value = new MatchClient(data.playerId, (out) => connection.value?.send(out))
    errorMessage.value = null
  } else if (message.t === 'lobby') {
    lobby.value = raw as LobbyMessage
  } else if (message.t === 'snapshot') {
    const data = (message as unknown as { snapshot: Snapshot }).snapshot
    match.value?.onSnapshot(data, performance.now())
    snapshot.value = data
  } else if (message.t === 'matchEnd') {
    // O fim da partida vira o próximo `lobby` com status 'lobby'.
  } else if (message.t === 'error') {
    const code = (message as unknown as { code: string }).code
    errorMessage.value = ERROR_TEXT[code] ?? `Erro do servidor: ${code}`
    if (code === 'bad_token') clearSession()
  }
}

function join(code: string): void {
  const clean = code.trim().toUpperCase()
  if (busy.value || clean.length !== 4) return
  busy.value = true
  connection.value?.stop()
  resetLocalState()
  codeInput.value = clean

  connection.value = new Connection({
    url: roomUrl(clean),
    hello: helloMessage,
    onMessage,
    onStatus: (next) => (status.value = next),
    onFatal: () => (errorMessage.value = 'Conexão encerrada pelo servidor.'),
  })
  connection.value.start()
}

async function createRoom(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const code = await createRoomCode()
    join(code)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Falha ao criar sala.'
  } finally {
    busy.value = false
  }
}

function readyToggle(value: boolean): void {
  connection.value?.send({ t: 'ready', ready: value })
}

function sendStart(): void {
  connection.value?.send({ t: 'start' })
}

function sendSettings(value: MatchSettings): void {
  connection.value?.send({ t: 'settings', settings: value })
}

function leave(): void {
  connection.value?.stop()
  connection.value = null
  clearSession()
  resetLocalState()
  status.value = 'closed'
}

function resetLocalState(): void {
  lobby.value = null
  snapshot.value = null
  match.value = null
  session.value = null
}

watch(
  () => route.query.sala,
  (value) => {
    if (typeof value === 'string') codeInput.value = value.toUpperCase()
  },
)

function onKeyDown(event: KeyboardEvent): void {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return
  if (!GAME_KEYS.includes(event.code)) return
  if (!playing.value) return
  event.preventDefault()
  held.add(event.code)
}

function onKeyUp(event: KeyboardEvent): void {
  held.delete(event.code)
}

function onBlurWindow(): void {
  held.clear()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlurWindow)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlurWindow)
  connection.value?.stop()
})

const code = computed(() => lobby.value?.code ?? codeInput.value)
const hostId = computed(() => lobby.value?.hostId ?? null)
const isHost = computed(() => hostId.value === myId.value)
const statusTextForLobby = computed(() => {
  if (status.value === 'connecting') return 'Conectando...'
  if (status.value === 'reconnecting') return 'Reconectando...'
  if (status.value === 'closed' && errorMessage.value) return errorMessage.value
  return ''
})

const ELAPSED = 6000
const waiting = ref(false)
let waitingTimer: ReturnType<typeof setInterval> | null = null
const startedAt = ref(0)

watch(status, (value) => {
  if (lobby.value !== null || (value !== 'connecting' && value !== 'reconnecting')) {
    waiting.value = false
    if (waitingTimer) clearInterval(waitingTimer)
    waitingTimer = null
    return
  }
  startedAt.value = Date.now()
})

onMounted(() => {
  waitingTimer = setInterval(() => {
    const trying = status.value === 'connecting' || status.value === 'reconnecting'
    waiting.value = trying && lobby.value === null && Date.now() - startedAt.value > ELAPSED
  }, 1000)
})
onBeforeUnmount(() => {
  if (waitingTimer) clearInterval(waitingTimer)
})

const serverLabel = computed(() => new URL(WS_BASE.replace(/^ws/, 'http')).host)

/** Diagnóstico no console durante o dev. */
function debugMessage(label: string, payload: unknown): void {
  if (import.meta.env.DEV) console.debug('[bombsquads]', label, payload)
}
</script>

<template>
  <main class="app bombsquads-page" :class="{ inmatch: playing }">
    <section v-if="lobby === null" class="window bs-entry">
      <div class="panel">
        <h2>Bombsquads</h2>
        <label class="bs-field">
          <span>Seu nome</span>
          <input v-model="name" maxlength="16" placeholder="Jogador" />
        </label>
        <label class="bs-field">
          <span>Código da sala</span>
          <input v-model="codeInput" maxlength="4" class="bs-code-input" placeholder="ABCD" @keydown.enter="join(codeInput)" />
        </label>
        <button class="bs-btn bs-primary" type="button" :disabled="busy" @click="createRoom">Criar sala</button>
        <button class="bs-btn" type="button" :disabled="busy || codeInput.trim().length !== 4" @click="join(codeInput)">
          Entrar na sala
        </button>
        <p class="bs-hint">Movimento: WASD ou setas. Bomba: espaço ou F.</p>
        <p class="bs-error" v-if="errorMessage">{{ errorMessage }}</p>
        <p class="bs-warn" v-else-if="waiting">
          Sem resposta do servidor de partidas ({{ serverLabel }}). Ele está no ar?
          Local: <code>npm run dev:bombsquads-server</code>
        </p>
      </div>
    </section>

    <LobbyView
      v-else
      :code="code"
      :host-id="hostId"
      :players="lobby.players"
      :my-id="myId"
      :is-host="isHost"
      :settings="lobby.settings"
      :min-players="lobby.minPlayers"
      :max-players="lobby.maxPlayers"
      :status="lobby.status"
      :status-text="statusTextForLobby"
      @ready="readyToggle"
      @start="sendStart"
      @settings="sendSettings"
      @leave="leave"
    />

    <template v-if="playing && match && snapshot">
      <MatchScene :client="match" :snapshot="snapshot" />
      <HudView :snapshot="snapshot" :my-id="myId" :status="status" @leave="leave" />
    </template>
  </main>
</template>

<style scoped>
.bombsquads-page.inmatch {
  position: fixed;
  inset: 0;
  padding: 0;
  background: #070b16;
  overflow: hidden;
}
.bs-entry { max-width: 380px; margin: 24px auto; }
.bs-field { display: flex; flex-direction: column; gap: 4px; margin: 10px 0; }
.bs-field span { font-size: 12px; opacity: 0.8; }
.bs-field input {
  padding: 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  color: inherit;
}
.bs-code-input { letter-spacing: 0.4em; text-transform: uppercase; }
.bs-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font-weight: 700;
  cursor: pointer;
}
.bs-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.bs-primary { background: var(--action, #c15f3c); border-color: transparent; }
.bs-hint { font-size: 12px; opacity: 0.75; margin-top: 10px; }
.bs-error { color: #ff9d9d; margin-top: 8px; font-size: 13px; }
.bs-warn { color: #ffd166; margin-top: 8px; font-size: 13px; }
</style>
