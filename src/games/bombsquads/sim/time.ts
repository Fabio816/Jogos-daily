import type { MatchConfig } from './types'

/** Converte segundos em ticks inteiros (mínimo 1). */
export function ticks(seconds: number, config: MatchConfig): number {
  return Math.max(1, Math.round(seconds * config.tickRate))
}
