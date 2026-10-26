<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import * as THREE from 'three'
import { iconDataUrl, ITEM_INFO } from '../icons'
import type { ItemType } from '../sim'

/**
 * Item: miniatura com o ícone em textura, girando na horizontal e flutuando.
 * O ícone é um data URL SVG, então não há requisição de rede.
 */
const props = defineProps<{ x: number; z: number; y: number; type: string }>()

const holder = shallowRef<THREE.Group>()
const sprite = shallowRef<THREE.Mesh>()

const color = ITEM_INFO[props.type as ItemType]?.color ?? '#ffffff'

/*
 * Textura em canvas de tamanho fixo: o SVG só é desenhado depois de carregar.
 * Passar a <img> crua ao WebGL antes do load gera "bad image data" e textura imutável.
 */
const iconCanvas = document.createElement('canvas')
iconCanvas.width = 128
iconCanvas.height = 128
const texture = new THREE.CanvasTexture(iconCanvas)
const icon = new Image()
icon.onload = () => {
  iconCanvas.getContext('2d')?.drawImage(icon, 0, 0, iconCanvas.width, iconCanvas.height)
  texture.needsUpdate = true
}
icon.src = iconDataUrl(props.type as ItemType)

const { onBeforeRender } = useLoop()
const { camera } = useTresContext()
const activeCamera = camera.activeCamera
let oriented = false

onBeforeRender(({ delta }) => {
  const t = performance.now() / 1000
  if (holder.value) holder.value.rotation.y = t * 1.6
  if (sprite.value) sprite.value.position.y = props.y + Math.sin(t * 3 + (props.x + props.z)) * 0.07

  if (!oriented && sprite.value) {
    const cam = activeCamera.value
    if (cam) {
      sprite.value.quaternion.copy(cam.quaternion)
      oriented = true
    }
  }
  void delta
})

// Billboard estático: como a câmera é fixa, uma cópia do quaternion dela já resolve.
if (sprite.value && activeCamera.value) sprite.value.quaternion.copy(activeCamera.value.quaternion)

onBeforeUnmount(() => {
  icon.onload = null
  texture.dispose()
})
</script>

<template>
  <TresGroup ref="holder" :position="[props.x, 0, props.z]">
    <TresMesh ref="sprite">
      <TresPlaneGeometry :args="[0.72, 0.72]" />
      <TresMeshBasicMaterial :map="texture" transparent :depth-write="false" />
    </TresMesh>
    <TresMesh :rotation="[-Math.PI / 2, 0, 0]" :position="[0, -0.5, 0]">
      <TresRingGeometry :args="[0.3, 0.4, 28]" />
      <TresMeshBasicMaterial :color="color" transparent :opacity="0.6" :depth-write="false" />
    </TresMesh>
  </TresGroup>
</template>
