<script setup lang="ts">
import { shallowRef, onMounted } from 'vue'
import type { DirectionalLight } from 'three'

/** Luzes do protótipo: ambiente fria + sol quente com sombra + rim lights. */
const sun = shallowRef<DirectionalLight>()

onMounted(() => {
  const light = sun.value
  if (!light) return
  const cam = light.shadow?.camera
  if (!cam) return
  cam.left = -14
  cam.right = 14
  cam.top = 14
  cam.bottom = -14
  cam.near = 1
  cam.far = 60
  light.shadow.bias = -0.0003
  light.shadow.mapSize.set(1024, 1024)
  cam.updateProjectionMatrix()
  light.shadow.needsUpdate = true
})
</script>

<template>
  <TresAmbientLight :intensity="0.95" color="#b9d2ff" />
  <TresHemisphereLight :args="['#d6e9ff', '#1b2740', 0.85]" />
  <TresDirectionalLight
    ref="sun"
    cast-shadow
    :position="[8, 15, 8]"
    :intensity="3.3"
    color="#ffe2b0"
    :shadow-mapSize-width="2048"
    :shadow-mapSize-height="2048"
    :shadow-camera-left="-14"
    :shadow-camera-right="14"
    :shadow-camera-top="14"
    :shadow-camera-bottom="-14"
  />
  <TresDirectionalLight :position="[-10, 7, -12]" :intensity="1.5" color="#57c7ff" />
  <TresDirectionalLight :position="[11, 5, -10]" :intensity="0.8" color="#ff7ab6" />
  <TresPointLight :position="[-9, 5, -6]" :intensity="65" :distance="30" color="#3a86ff" />
  <TresPointLight :position="[9, 4, -8]" :intensity="45" :distance="28" color="#ff5d8f" />
  <TresPointLight :position="[0, -3.5, 0]" :intensity="35" :distance="16" color="#38bdf8" />
</template>
