export type RngState = {
  rngState: number
}

export function nextRandom(state: RngState): number {
  let t = (state.rngState += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function nextInt(state: RngState, maxExclusive: number): number {
  return Math.floor(nextRandom(state) * maxExclusive)
}
