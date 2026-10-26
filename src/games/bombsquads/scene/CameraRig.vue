<script setup lang="ts">
import { useTresContext } from '@tresjs/core'
import { watch } from 'vue'

/**
 * Posição da câmera em função do tamanho do mapa. Mapa de referência: 15x13
 * (igual ao protótipo); mapas maiores afastam proporcionalmente.
 */
const REFERENCE_SPAN = 15
const BASE = [11, 15, 13] as const

const props = defineProps<{ span: number }>()

const { camera } = useTresContext()

watch(
  () => [camera.activeCamera.value, props.span] as const,
  ([active]) => {
    if (!active) return
    const distance = Math.max(1, props.span / REFERENCE_SPAN)
    active.position.set(BASE[0] * distance, BASE[1] * distance, BASE[2] * distance)
    active.lookAt(0, 0.2, 0)
    if ('updateProjectionMatrix' in active) active.updateProjectionMatrix()
  },
  { immediate: true },
)
</script>

<template>
  <slot />
</template>
