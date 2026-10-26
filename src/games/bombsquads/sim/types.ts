export type Dir = 'none' | 'up' | 'down' | 'left' | 'right'

export type Cell = {
  x: number
  y: number
}

/** Posição contínua em unidades de célula. O centro da célula (x, y) é um inteiro. */
export type Vec2 = {
  x: number
  y: number
}

export type CellType = 'empty' | 'wall' | 'crate'

export type ItemType = 'fire' | 'bomb' | 'speed' | 'kick' | 'punch' | 'throw'

export type BombType = 'normal' | 'penetration' | 'elasticity'

export type MatchPhase = 'countdown' | 'playing' | 'roundEnd' | 'matchEnd'

export type PlayerStats = {
  fire: number
  bombs: number
  speed: number
}

export type PlayerAbilities = {
  kick: boolean
  punch: boolean
  throw: boolean
}

export type PlayerState = {
  id: string
  slot: number
  name: string
  /** Posição autoritativa, em células (float). */
  pos: Vec2
  /** Célula do centro do jogador: round(pos). Mantida pelo step. */
  cell: Cell
  facing: Exclude<Dir, 'none'>
  alive: boolean
  connected: boolean
  disconnectTicks: number
  spawnProtectionTicks: number
  stats: PlayerStats
  abilities: PlayerAbilities
  activeBombs: number
  lastBombInput: boolean
  score: number
}

export type BombState = {
  id: number
  ownerId: string
  cell: Cell
  range: number
  type: BombType
  explodeTick: number
  exploded: boolean
}

export type BlastState = {
  id: number
  ownerId: string
  cells: Cell[]
  expiresTick: number
}

export type ItemState = {
  id: number
  cell: Cell
  type: ItemType
}

export type MapState = {
  width: number
  height: number
  cells: CellType[]
  spawns: Cell[]
}

/**
 * Fechamento do sudden death: as células viram parede uma a uma, de cima para
 * baixo e da esquerda para a direita, até o mapa ficar fechado. A célula de
 * índice i cai em `warnTicks + i * intervalTicks` ticks após o início.
 */
export type ClosingState = {
  active: boolean
  startTick: number
  intervalTicks: number
  warnTicks: number
  /** Ordem da queda (células que não eram parede quando o fechamento começou). */
  order: Cell[]
  /** Índice da próxima célula a cair. Igual a order.length quando o mapa está fechado. */
  nextIndex: number
  /** Células em aviso neste instante (ainda não caíram). */
  warning: Cell[]
}

export type GameEvent =
  | { type: 'cellDropped'; x: number; y: number }
  | { type: 'death'; playerId: string; cause: 'blast' | 'closing' | 'disconnect' }

/** Tamanho do mapa escolhido pelo host. 'auto' segue o número de jogadores. */
export type MapSizeChoice = 'auto' | 'small' | 'medium' | 'large' | 'xl'

/** Nível de uma configuração de partida. */
export type Level = 'low' | 'normal' | 'high'

/** Configurações que o host escolhe no lobby. */
export type MatchSettings = {
  mapSize: MapSizeChoice
  /** Quantidade de caixas no mapa. */
  crates: Level
  /** Chance de uma caixa quebrada deixar um item. */
  itemDrop: Level
  /** Até onde cada power-up sobe (fogo, bombas e velocidade). */
  powerCap: Level
}

export type MatchConfig = {
  tickRate: number
  countdownSeconds: number
  roundSeconds: number
  roundEndSeconds: number
  roundsToWin: number
  maxRounds: number
  hurrySeconds: number
  /** Restam estes segundos: o fechamento começa. */
  suddenSeconds: number
  /** Aviso (células piscando) antes de cada célula do fechamento cair. */
  closingWarningSeconds: number
  fuseSeconds: number
  blastSeconds: number
  spawnProtectionSeconds: number
  disconnectGraceSeconds: number
  crateDropChance: number
  fireMax: number
  bombsMax: number
  speedBase: number
  speedMax: number
  speedStep: number
  /** Tamanho do mapa. */
  mapSize: MapSizeChoice
  /** Fração das células livres que viram caixa. */
  crateDensity: number
  /** Mapa fixo para testes. Quando null, o mapa é gerado pelo número de jogadores. */
  mapTemplate: string[] | null
}

export type InputFrame = {
  move: Dir
  bomb: boolean
  action?: 'punch' | 'throw'
}

export type InputMap = Record<string, InputFrame>

export type MatchState = {
  tick: number
  phase: MatchPhase
  round: number
  timeLeftTicks: number
  countdownTicks: number
  roundEndTick: number
  hurry: boolean
  sudden: boolean
  roundWinnerId: string | null
  matchWinnerId: string | null
  config: MatchConfig
  map: MapState
  players: PlayerState[]
  bombs: BombState[]
  blasts: BlastState[]
  items: ItemState[]
  closing: ClosingState
  /** Eventos gerados no último step. Limpo a cada tick. */
  events: GameEvent[]
  rngState: number
  nextIds: {
    bomb: number
    blast: number
    item: number
  }
}
