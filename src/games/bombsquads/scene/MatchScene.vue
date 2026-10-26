<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import * as THREE from 'three'
import { accentFor } from '../visual'
import { DROP_LIFETIME_MS, type DropView, type MatchClient } from '../match-client'
import type { Snapshot } from '../messages'
import { buildArena, disposeArena } from '../arena'
import CameraRig from './CameraRig.vue'
import SceneLights from './SceneLights.vue'
import BombActor from './BombActor.vue'
import BlastActor from './BlastActor.vue'
import ItemActor from './ItemActor.vue'
import FallingBlock from './FallingBlock.vue'
import PlayerActor from './PlayerActor.vue'
import MatchClock from './MatchClock.vue'

const props = defineProps<{ client: MatchClient; snapshot: Snapshot | null; keys: ReadonlySet<string> }>()

const arenaObject = shallowRef<THREE.Group | null>(null)

watch(
  () => props.snapshot,
  (snapshot) => {
    if (!snapshot) return
    const hidden = new Set(props.client.activeDrops(performance.now()).map((drop) => `${drop.x}-${drop.y}`))
    const next = buildArena(snapshot.map, hidden, snapshot.closing.warning)
    const previous = arenaObject.value
    arenaObject.value = next
    if (previous) setTimeout(() => disposeArena(previous), 300)
  },
  { immediate: true },
)

const span = computed(() => {
  const map = props.snapshot?.map
  return map ? Math.max(map.w, map.h) : 15
})

type BombView = { key: string; x: number; z: number }
type BlastView = { key: string; cells: Array<[number, number]>; map: { w: number; h: number } }
type ItemView = { key: string; x: number; y: number; z: number; type: string }

const bombs = computed<BombView[]>(() => {
  const map = props.snapshot?.map
  if (!map || !props.snapshot) return []
  return props.snapshot.bombs.map((bomb) => ({
    key: `bomb-${bomb.id}`,
    x: bomb.x - (map.w - 1) / 2,
    z: bomb.y - (map.h - 1) / 2,
  }))
})

const blasts = computed<BlastView[]>(() => {
  const map = props.snapshot?.map
  if (!map || !props.snapshot) return []
  return props.snapshot.blasts.map((blast, index) => ({
    key: `blast-${index}-${blast.cells[0]?.[0] ?? 0}-${blast.cells[0]?.[1] ?? 0}`,
    cells: blast.cells,
    map,
  }))
})

const items = computed<ItemView[]>(() => {
  const map = props.snapshot?.map
  if (!map || !props.snapshot) return []
  return props.snapshot.items.map((item) => ({
    key: `item-${item.id}`,
    x: item.x - (map.w - 1) / 2,
    z: item.y - (map.h - 1) / 2,
    y: 0.55,
    type: item.type,
  }))
})

const drops = computed<DropView[]>(() => {
  if (!props.snapshot) return []
  return props.client.activeDrops(performance.now()).filter((drop) => performance.now() - drop.time < DROP_LIFETIME_MS)
})

type PlayerView = { id: string; accent: string; facing: string; shield: boolean }

const actors = computed<PlayerView[]>(() => {
  const snapshot = props.snapshot
  if (!snapshot) return []
  return snapshot.players
    .filter((player) => player.alive)
    .map((player) => ({
      id: player.id,
      accent: accentFor(player.id === props.client.playerId ? 0 : snapshot.players.indexOf(player)),
      facing: player.facing,
      shield: player.shield,
    }))
})
</script>

<template>
  <TresCanvas clear-color="#070b16" shadows :dpr="[1, 1.5]">
    <MatchClock :client="props.client" :keys="props.keys" />
    <Suspense>
      <CameraRig :span="span" />
    </Suspense>
    <SceneLights />
    <Suspense>
      <primitive v-if="arenaObject" :object="arenaObject" />
    </Suspense>

    <template v-for="view in bombs" :key="view.key">
      <BombActor :x="view.x" :z="view.z" />
    </template>

    <template v-for="view in blasts" :key="view.key">
      <BlastActor :cells="view.cells" :map="view.map" />
    </template>

    <template v-for="view in items" :key="view.key">
      <ItemActor :x="view.x" :z="view.z" :y="view.y" :type="view.type" />
    </template>

    <template v-for="view in drops" :key="`${view.key}-${view.time}`">
      <FallingBlock :drop="view" :map="props.snapshot?.map ?? { w: 15, h: 13 }" />
    </template>

    <template v-for="view in actors" :key="view.id">
      <PlayerActor
        :client="props.client"
        :id="view.id"
        :accent="view.accent"
        :facing="view.facing"
        :shield="view.shield"
      />
    </template>
  </TresCanvas>
</template>

