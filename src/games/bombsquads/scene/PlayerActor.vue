<script setup lang="ts">
import { shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import * as THREE from 'three'
import { PALETTE, cellToWorld, facingRotation, toonGradient } from '../visual'
import type { MatchClient } from '../match-client'

/** Velocidade (células/s) em que a animação de caminhada atinge 100%. */
const FULL_WALK_SPEED = 3

const props = defineProps<{
  client: MatchClient
  id: string
  accent: string
  facing: string
  shield: boolean
}>()

const gradient = toonGradient

const group = shallowRef<THREE.Group>()
const inner = shallowRef<THREE.Group>()
const antenna = shallowRef<THREE.Group>()
const shield = shallowRef<THREE.Mesh>()

let motion = 0
let lastX: number | null = null
let lastZ: number | null = null

/** Gira `current` até `target` pelo caminho mais curto, suavemente. */
function approachAngle(current: number, target: number, delta: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + diff * Math.min(1, delta * 14)
}

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const node = group.value
  if (!node) return
  const dt = Math.min(delta, 0.1)

  const pos = props.client.positionOf(props.id, performance.now())
  const lx = lastX
  const lz = lastZ
  if (pos) {
    const map = props.client.latest?.map ?? { w: 15, h: 13 }
    const [wx, , wz] = cellToWorld(map, pos.x, pos.y)
    const distance = lx !== null && lz !== null ? Math.hypot(wx - lx, wz - lz) : Infinity
    const speed = lx === null ? 0 : distance / Math.max(dt, 1e-3)
    lastX = wx
    lastZ = wz
    node.position.set(wx, 0, wz)
    motion = THREE.MathUtils.lerp(motion, Math.min(1, speed / FULL_WALK_SPEED), Math.min(1, dt * 10))
  }
  node.rotation.y = approachAngle(node.rotation.y, facingRotation(props.facing), dt)

  const step = Math.sin(performance.now() / 1000 * 9)
  if (inner.value) {
    inner.value.position.y = Math.sin(performance.now() / 1000 * 2.2) * 0.035 + Math.abs(step) * 0.07 * motion
    inner.value.rotation.z = Math.sin(performance.now() / 1000 * 1.4) * 0.025 + step * 0.08 * motion
  }
  if (antenna.value) antenna.value.rotation.z = Math.sin(performance.now() / 1000 * 3.1) * 0.18
  if (shield.value) shield.value.scale.setScalar(1 + Math.sin(performance.now() / 1000 * 6) * 0.035)
})
</script>

<template>
  <TresGroup ref="group">
    <TresMesh :rotation="[-Math.PI / 2, 0, 0]" :position="[0, 0.012, 0]">
      <TresRingGeometry :args="[0.3, 0.42, 32]" />
      <TresMeshBasicMaterial :color="accent" transparent :opacity="0.55" :depth-write="false" />
    </TresMesh>

    <TresGroup ref="inner">
      <TresMesh :position="[-0.17, 0.18, 0]" cast-shadow>
        <TresCapsuleGeometry :args="[0.1, 0.16, 6, 12]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>
      <TresMesh :position="[0.17, 0.18, 0]" cast-shadow>
        <TresCapsuleGeometry :args="[0.1, 0.16, 6, 12]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[-0.17, 0.05, 0.06]" cast-shadow>
        <TresSphereGeometry :args="[0.13, 16, 12]" />
        <TresMeshToonMaterial :color="PALETTE.visor" :gradient-map="gradient" />
      </TresMesh>
      <TresMesh :position="[0.17, 0.05, 0.06]" cast-shadow>
        <TresSphereGeometry :args="[0.13, 16, 12]" />
        <TresMeshToonMaterial :color="PALETTE.visor" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[0, 0.52, 0]" cast-shadow receive-shadow>
        <TresCapsuleGeometry :args="[0.29, 0.3, 8, 16]" />
        <TresMeshToonMaterial :color="PALETTE.suit" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[0, 0.55, 0.26]" cast-shadow>
        <TresCapsuleGeometry :args="[0.1, 0.18, 6, 12]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[0, 0.37, 0]" :rotation="[Math.PI / 2, 0, 0]">
        <TresTorusGeometry :args="[0.3, 0.035, 10, 32]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[0, 0.58, -0.28]" cast-shadow>
        <TresBoxGeometry :args="[0.4, 0.42, 0.18]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[-0.36, 0.56, 0]" :rotation="[0, 0, 0.2]" cast-shadow>
        <TresCapsuleGeometry :args="[0.09, 0.2, 6, 12]" />
        <TresMeshToonMaterial :color="PALETTE.suitShade" :gradient-map="gradient" />
      </TresMesh>
      <TresMesh :position="[0.36, 0.56, 0]" :rotation="[0, 0, -0.2]" cast-shadow>
        <TresCapsuleGeometry :args="[0.09, 0.2, 6, 12]" />
        <TresMeshToonMaterial :color="PALETTE.suitShade" :gradient-map="gradient" />
      </TresMesh>
      <TresMesh :position="[-0.43, 0.4, 0.04]" cast-shadow>
        <TresSphereGeometry :args="[0.11, 16, 12]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>
      <TresMesh :position="[0.43, 0.4, 0.04]" cast-shadow>
        <TresSphereGeometry :args="[0.11, 16, 12]" />
        <TresMeshToonMaterial :color="accent" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[0, 1.08, 0]" cast-shadow>
        <TresSphereGeometry :args="[0.42, 32, 24]" />
        <TresMeshToonMaterial :color="PALETTE.suit" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[0, 1.1, 0.27]" :scale="[1.05, 0.7, 0.55]" cast-shadow>
        <TresSphereGeometry :args="[0.32, 24, 18]" />
        <TresMeshToonMaterial :color="PALETTE.visor" :gradient-map="gradient" />
      </TresMesh>

      <TresMesh :position="[-0.11, 1.12, 0.48]">
        <TresSphereGeometry :args="[0.05, 12, 10]" />
        <TresMeshBasicMaterial :color="PALETTE.eye" />
      </TresMesh>
      <TresMesh :position="[0.11, 1.12, 0.48]">
        <TresSphereGeometry :args="[0.05, 12, 10]" />
        <TresMeshBasicMaterial :color="PALETTE.eye" />
      </TresMesh>

      <TresGroup ref="antenna" :position="[0, 1.48, 0]">
        <TresMesh :position="[0, 0.13, 0]" cast-shadow>
          <TresCylinderGeometry :args="[0.022, 0.03, 0.3, 10]" />
          <TresMeshToonMaterial :color="PALETTE.fuse" :gradient-map="gradient" />
        </TresMesh>
        <TresMesh :position="[0, 0.32, 0]">
          <TresSphereGeometry :args="[0.075, 16, 12]" />
          <TresMeshBasicMaterial :color="PALETTE.antenna" />
        </TresMesh>
      </TresGroup>

      <TresMesh v-if="props.shield" ref="shield" :position="[0, 0.72, 0]">
        <TresSphereGeometry :args="[0.82, 24, 16]" />
        <TresMeshBasicMaterial
          :color="PALETTE.ring"
          transparent
          :opacity="0.14"
          :depth-write="false"
          :blending="THREE.AdditiveBlending"
        />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
