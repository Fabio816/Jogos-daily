<script setup lang="ts">
import { shallowRef } from 'vue'
import * as THREE from 'three'
import { useLoop } from '@tresjs/core'
import { PALETTE, toonGradient } from '../visual'

/** Bomba: esfera escura com faixa metálica, pavio e faísca pulsando. */
const props = defineProps<{ x: number; z: number }>()

const inner = shallowRef<THREE.Group>()
const spark = shallowRef<THREE.Mesh>()
const glow = shallowRef<THREE.PointLight>()

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  const t = performance.now() / 1000
  if (inner.value) {
    const beat = Math.max(0, Math.sin(t * 5.5))
    inner.value.scale.setScalar(1 + beat * 0.05)
    inner.value.position.y = Math.sin(t * 2.4) * 0.025
    inner.value.rotation.y = t * 0.35
  }
  if (spark.value) spark.value.scale.setScalar(0.85 + Math.sin(t * 37) * 0.15)
  if (glow.value) glow.value.intensity = 2.4 + Math.sin(t * 29) * 0.9
})
</script>

<template>
  <TresGroup :position="[props.x, 0, props.z]" :scale="1.12">
    <TresGroup ref="inner">
      <TresMesh :position="[0, 0.37, 0]" cast-shadow receive-shadow>
        <TresSphereGeometry :args="[0.37, 32, 24]" />
        <TresMeshStandardMaterial :color="PALETTE.bomb" :roughness="0.34" :metalness="0.25" />
      </TresMesh>
      <TresMesh :position="[0, 0.37, 0]" :rotation="[Math.PI / 2, 0, 0]" cast-shadow>
        <TresTorusGeometry :args="[0.37, 0.035, 12, 48]" />
        <TresMeshStandardMaterial :color="PALETTE.bombBand" :roughness="0.3" :metalness="0.65" />
      </TresMesh>
      <TresMesh :position="[0.07, 0.79, 0]" :rotation="[0, 0, -0.35]" cast-shadow>
        <TresCylinderGeometry :args="[0.025, 0.03, 0.26, 10]" />
        <TresMeshToonMaterial :color="PALETTE.fuse" :gradient-map="toonGradient" />
      </TresMesh>
      <TresMesh ref="spark" :position="[0.18, 0.9, 0]">
        <TresSphereGeometry :args="[0.06, 12, 10]" />
        <TresMeshBasicMaterial :color="PALETTE.spark" />
      </TresMesh>
      <TresPointLight ref="glow" :position="[0.18, 0.9, 0]" :color="PALETTE.spark" :intensity="2.4" :distance="2.4" />
    </TresGroup>
  </TresGroup>
</template>
