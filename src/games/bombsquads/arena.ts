import * as THREE from 'three'
import { PALETTE, cellToWorld, toonGradient } from './visual'

/**
 * Monta a arena estática (piso, plataforma, paredes, caixas e avisos do
 * fechamento) em meshes instanciados. É reconstruída do zero quando o mapa ou
 * os avisos mudam; o componente Vue só troca o objeto montado.
 */
export function buildArena(map: { w: number; h: number; cells: string }, hidden: ReadonlySet<string>, warning: Array<[number, number]>): THREE.Group {
  const group = new THREE.Group()

  const capacity = map.w * map.h
  const makeBlocks = (
    name: string,
    size: [number, number, number],
    color: number | string,
    toon: boolean,
    castShadow: boolean,
  ): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), toon
      ? new THREE.MeshToonMaterial({ color, gradientMap: toonGradient })
      : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }), capacity)
    mesh.name = name
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const floorMeshA = makeBlocks('floorA', [0.94, 0.3, 0.94], PALETTE.floorA, true, false)
  const floorMeshB = makeBlocks('floorB', [0.94, 0.3, 0.94], PALETTE.floorB, true, false)
  const wallMesh = makeBlocks('walls', [0.86, 0.9, 0.86], PALETTE.hard, true, true)
  const capMesh = makeBlocks('wallCaps', [0.66, 0.1, 0.66], PALETTE.hardTop, true, false)
  const crateMesh = makeBlocks('crates', [0.8, 0.8, 0.8], PALETTE.crate, true, false)
  const crateBandMesh = makeBlocks('crateBands', [0.84, 0.16, 0.84], PALETTE.crateBand, true, false)
  const warnMesh = makeBlocks('warn', [0.96, 0.05, 0.96], PALETTE.fireEdge, false, false)
  warnMesh.receiveShadow = false
  const warn = new THREE.Matrix4()

  const dummy = new THREE.Object3D()
  let a = 0
  let b = 0
  let w = 0
  let c = 0
  for (let y = 0; y < map.h; y += 1) {
    for (let x = 0; x < map.w; x += 1) {
      const char = map.cells[y * map.w + x]
      const key = `${x}-${y}`
      const [wx, , wz] = cellToWorld(map, x, y)

      dummy.position.set(wx, -0.15, wz)
      dummy.updateMatrix()
      const target = (x + y) % 2 === 0 ? floorMeshA : floorMeshB
      const index = target === floorMeshA ? a : b
      target.setMatrixAt(index, dummy.matrix)
      if (target === floorMeshA) a += 1
      else b += 1

      if (char === 'C') {
        dummy.position.set(wx, 0.4, wz)
        dummy.updateMatrix()
        crateMesh.setMatrixAt(c, dummy.matrix)
        dummy.position.set(wx, 0.4, wz)
        dummy.updateMatrix()
        crateBandMesh.setMatrixAt(c, dummy.matrix)
        c += 1
      } else if (char === '#' && !hidden.has(key)) {
        dummy.position.set(wx, 0.45, wz)
        dummy.updateMatrix()
        wallMesh.setMatrixAt(w, dummy.matrix)
        dummy.position.set(wx, 0.95, wz)
        dummy.updateMatrix()
        capMesh.setMatrixAt(w, dummy.matrix)
        w += 1
      }
    }
  }

  warning.forEach(([x, y], index) => {
    const [wx, , wz] = cellToWorld(map, x, y)
    warn.makeTranslation(wx, 0.03, wz)
    warnMesh.setMatrixAt(index, warn)
  })

  floorMeshA.count = a
  floorMeshB.count = b
  wallMesh.count = w
  capMesh.count = w
  crateMesh.count = c
  crateBandMesh.count = c
  warnMesh.count = warning.length
  for (const mesh of [floorMeshA, floorMeshB, wallMesh, capMesh, crateMesh, crateBandMesh, warnMesh]) {
    mesh.instanceMatrix.needsUpdate = true
  }

  const radius = Math.max(map.w, map.h) / 2 + 0.9
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius - 0.55, 0.5, 64),
    new THREE.MeshStandardMaterial({ color: PALETTE.platform, roughness: 0.85, metalness: 0.15 }),
  )
  platform.name = 'platform'
  platform.position.y = -0.55
  platform.receiveShadow = true
  group.add(platform)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.7, radius - 0.15, 64),
    new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.32 }),
  )
  ring.name = 'ring'
  ring.rotation.x = -Math.PI / 2
  ring.position.y = -0.285
  group.add(ring)

  return group
}

/**
 * Liberta geometrias e materiais da última arena antes de montar a próxima.
 * Sem isso, cada troca de mapa deixaria buffers no GPU.
 */
export function disposeArena(group: THREE.Group): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) material.forEach((item) => item.dispose())
    else material?.dispose()
  })
  group.clear()
}
