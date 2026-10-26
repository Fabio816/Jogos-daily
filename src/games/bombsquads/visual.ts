import * as THREE from 'three'

/**
 * Paleta visual portada do protótipo aprovado (Bomberman 3D toon). A cor do
 * jogador local é accent; os rivais giram entre SIDE_ACCENTS pela ordem de
 * entrada na sala.
 */
export const PALETTE = {
  space: '#070b16',
  floorA: '#155066',
  floorB: '#113f52',
  platform: '#0d2233',
  ring: '#38bdf8',
  hard: '#41617a',
  hardTop: '#6389a3',
  crate: '#d98324',
  crateBand: '#8a4b16',
  suit: '#f4ecdd',
  suitShade: '#e2d3ba',
  accent: '#2ec4b6',
  visor: '#0f172a',
  eye: '#7df9ff',
  antenna: '#ff9f1c',
  bomb: '#161d2e',
  bombBand: '#8d99ae',
  fuse: '#c9a227',
  spark: '#ffd166',
  fireCore: '#fff3b0',
  fireMid: '#ffb703',
  fireEdge: '#ff5d2e',
} as const

export const SIDE_ACCENTS = ['#ff6b6b', '#ffd166', '#4cc9f0', '#b8f2e6', '#f4a261', '#e0aaff', '#90f1ef', '#ff70a6', '#acc8ff']

export function accentFor(index: number): string {
  return index <= 0 ? PALETTE.accent : SIDE_ACCENTS[(index - 1) % SIDE_ACCENTS.length]
}

/** Textura de degraus do material toon, igual à do protótipo. */
export function createToonGradient(steps = 4): THREE.DataTexture {
  const data = new Uint8Array(steps)
  for (let i = 0; i < steps; i += 1) data[i] = Math.round((i / (steps - 1)) * 255)
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
}

export const toonGradient = createToonGradient()

export type WorldPoint = [number, number, number]

/** Célula do grid para o mundo, centrado na origem. */
export function cellToWorld(map: { w: number; h: number }, x: number, y: number): WorldPoint {
  return [x - (map.w - 1) / 2, 0, y - (map.h - 1) / 2]
}

export function facingRotation(facing: string): number {
  if (facing === 'up') return Math.PI
  if (facing === 'right') return Math.PI / 2
  if (facing === 'left') return -Math.PI / 2
  return 0
}
