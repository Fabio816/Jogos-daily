<script setup lang="ts">
import { shallowRef, onUnmounted } from 'vue'
import * as THREE from 'three'
import { useLoop } from '@tresjs/core'
import { PALETTE, cellToWorld, toonGradient } from '../visual'
import { DROP_LIFETIME_MS, type DropView } from '../match-client'

/** Bloco de parede caindo do alto; ao pousar continua visível até o snapshot seguinte. */
const BLOCK_Y = 0.45
const START_HEIGHT = 7

const props = defineProps<{ drop: DropView; map: { w: number; h: number } }>()

const group = shallowRef<THREE.Group>()
const [wx, , wz] = cellToWorld(props.map, props.drop.x, props.drop.y)

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  const node = group.value
  if (!node) return
  const t = Math.min(1, Math.max(0, (performance.now() - props.drop.time) / DROP_LIFETIME_MS))
  node.position.y = BLOCK_Y + START_HEIGHT * (1 - t * t)
})

const gradient = toonGradient
const hard = PALETTE.hard
const hardTop = PALETTE.hardTop

function cleanup(): void {
  group.value?.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
  })
}
onUnmounted(cleanup)
</script>

<template>
  <TresGroup ref="group" :position="[wx, BLOCK_Y + START_HEIGHT, wz]">
    <TresMesh cast-shadow receive-shadow>
      <TresBoxGeometry :args="[0.86, 0.9, 0.86]" />
      <TresMeshToonMaterial :color="hard" :gradient-map="gradient" />
    </TresMesh>
    <TresMesh :position="[0, 0.5, 0]" cast-shadow>
      <TresBoxGeometry :args="[0.66, 0.1, 0.66]" />
      <TresMeshToonMaterial :color="hardTop" :gradient-map="gradient" />
    </TresMesh>
  </TresGroup>
</template>
