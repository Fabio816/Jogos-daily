<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import * as THREE from 'three'
import { PALETTE, cellToWorld } from '../visual'

/** Explosão por célula: núcleo brilhante, casca laranja e duas chamas cônicas. */
const props = defineProps<{ cells: Array<[number, number]>; map: { w: number; h: number } }>()

function makeMaterial(color: string, additive: boolean): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: additive ? 0.95 : 0.82,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  })
}

const blastGroup = shallowRef<THREE.Group | null>(null)
const allMaterials: THREE.MeshBasicMaterial[] = []
const shared = {
  outer: makeMaterial('#ff6b1a', false),
  mid: makeMaterial(PALETTE.fireMid, false),
  core: makeMaterial(PALETTE.fireCore, true),
}
allMaterials.push(shared.outer, shared.mid, shared.core)

let elapsed = 0
let lightRef: THREE.PointLight | null = null

function build(): void {
  if (blastGroup.value) disposeOld(blastGroup.value)
  const group = new THREE.Group()
  const geometry = {
    shell: new THREE.SphereGeometry(0.45, 18, 14),
    mid: new THREE.SphereGeometry(0.3, 16, 12),
    flameBig: new THREE.ConeGeometry(0.34, 1.15, 10, 1, true),
    flameSmall: new THREE.ConeGeometry(0.18, 1.3, 10, 1, true),
    core: new THREE.SphereGeometry(0.16, 14, 10),
  }
  for (const cell of props.cells) {
    const [x, , z] = cellToWorld(props.map, cell[0], cell[1])
    const node = new THREE.Group()
    node.position.set(x, 0.45, z)
    node.rotation.y = ((cell[0] * 7 + cell[1] * 3) % 10) * 0.18

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material): void => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = false
      node.add(mesh)
    }
    add(geometry.shell, shared.outer)
    add(geometry.mid, shared.mid)
    const flame = new THREE.Mesh(geometry.flameBig, shared.outer)
    flame.position.y = 0.3
    node.add(flame)
    const flame2 = new THREE.Mesh(geometry.flameSmall, shared.mid)
    flame2.position.y = 0.32
    node.add(flame2)
    add(geometry.core, shared.core)
    group.add(node)
  }
  if (props.cells.length > 0) {
    const [cx, , cz] = cellToWorld(props.map, props.cells[0][0], props.cells[0][1])
    lightRef = new THREE.PointLight(PALETTE.fireEdge, 14, 6, 2)
    lightRef.position.set(cx, 1, cz)
    group.add(lightRef)
  }
  blastGroup.value = group
}

// Compartilhar geometria: criar cada uma uma vez por explosão, só descartar com o grupo.
function disposeOld(group: THREE.Group): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
  })
  group.clear()
}

onBeforeUnmount(() => {
  if (blastGroup.value) disposeOld(blastGroup.value)
  for (const material of allMaterials) material.dispose()
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  elapsed += Math.min(delta, 0.1)
  const fade = Math.max(0, 1 - elapsed / 0.55)
  if (blastGroup.value) blastGroup.value.scale.setScalar(0.8 + Math.min(elapsed / 0.12, 1) * 0.28)
  if (lightRef) lightRef.intensity = 14 * fade
})

build()
</script>

<template>
  <primitive v-if="blastGroup" :object="blastGroup" />
</template>
