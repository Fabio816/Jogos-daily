import type { ItemType, Level, MapSizeChoice, MatchConfig, MatchSettings } from './types'

/** Densidade de caixas padrão nas células livres do mapa gerado. */
export const CRATE_DENSITY = 0.55

export const MAP_SIZE_CHOICES: readonly MapSizeChoice[] = ['auto', 'small', 'medium', 'large', 'xl']
export const LEVELS: readonly Level[] = ['low', 'normal', 'high']

export const DEFAULT_SETTINGS: MatchSettings = {
  mapSize: 'auto',
  crates: 'normal',
  itemDrop: 'normal',
  powerCap: 'normal',
}

const CRATE_DENSITY_BY_LEVEL: Record<Level, number> = { low: 0.35, normal: CRATE_DENSITY, high: 0.7 }
const ITEM_DROP_BY_LEVEL: Record<Level, number> = { low: 0.15, normal: 0.35, high: 0.6 }
const POWER_CAP_BY_LEVEL: Record<Level, { fireMax: number; bombsMax: number; speedMax: number }> = {
  low: { fireMax: 3, bombsMax: 3, speedMax: 5 },
  normal: { fireMax: 6, bombsMax: 6, speedMax: 6.5 },
  high: { fireMax: 9, bombsMax: 9, speedMax: 8 },
}

/** Traduz as escolhas do host em parâmetros da partida. */
export function configFromSettings(settings: MatchSettings): Partial<MatchConfig> {
  const cap = POWER_CAP_BY_LEVEL[settings.powerCap]
  return {
    mapSize: settings.mapSize,
    crateDensity: CRATE_DENSITY_BY_LEVEL[settings.crates],
    crateDropChance: ITEM_DROP_BY_LEVEL[settings.itemDrop],
    fireMax: cap.fireMax,
    bombsMax: cap.bombsMax,
    speedMax: cap.speedMax,
  }
}

export const DEFAULT_CONFIG: MatchConfig = {
  tickRate: 30,
  countdownSeconds: 3,
  roundSeconds: 180,
  roundEndSeconds: 3,
  roundsToWin: 3,
  maxRounds: 5,
  hurrySeconds: 60,
  suddenSeconds: 55,
  closingWarningSeconds: 0.5,
  fuseSeconds: 2.4,
  blastSeconds: 0.5,
  spawnProtectionSeconds: 2,
  disconnectGraceSeconds: 15,
  crateDropChance: 0.35,
  fireMax: 6,
  bombsMax: 6,
  speedBase: 4,
  speedMax: 6.5,
  speedStep: 0.5,
  mapSize: 'auto',
  crateDensity: CRATE_DENSITY,
  mapTemplate: null,
}

export const ITEM_WEIGHTS: Record<ItemType, number> = {
  fire: 30,
  bomb: 30,
  speed: 20,
  kick: 10,
  punch: 5,
  throw: 5,
}

export const ITEM_TYPES: ItemType[] = ['fire', 'bomb', 'speed', 'kick', 'punch', 'throw']

/** Raio da caixa do jogador para colisão, em células. */
export const PLAYER_RADIUS = 0.35

/**
 * Janela do corner assist, em células. Metade da célula: o jogador consegue
 * virar em qualquer ponto da célula, sem precisar parar exatamente no centro.
 */
export const CORNER_ASSIST = 0.5
