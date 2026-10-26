import type { ItemType } from './sim'

/**
 * Ícones dos itens em SVG. Cada item tem um símbolo próprio e um nome curto,
 * para o jogador entender o que pegou sem ler texto. Usado no 3D (sprite) e no
 * HUD (legenda).
 */

const GLYPH = '#0b1524'

function disk(color: string, glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22.5" fill="${color}" stroke="#ffffff" stroke-width="2"/>${glyph}</svg>`
}

export type ItemInfo = {
  label: string
  effect: string
  color: string
  /** Quando o efeito ainda não existe no jogo. */
  soon?: boolean
  svg: string
}

export const ITEM_INFO: Record<ItemType, ItemInfo> = {
  fire: {
    label: 'Fogo',
    effect: '+1 alcance da explosão',
    color: '#ff8a1f',
    svg: disk(
      '#ff8a1f',
      `<path fill="${GLYPH}" d="M24 8c3 6 9 10 9 18a9 9 0 0 1-18 0c0-5 3-8 5-10 0 4 1 6 3 7-1-6 0-10 1-15z"/>`,
    ),
  },
  bomb: {
    label: 'Bomba extra',
    effect: '+1 bomba ao mesmo tempo',
    color: '#c9d4e5',
    svg: disk(
      '#c9d4e5',
      `<circle cx="22" cy="28" r="11" fill="${GLYPH}"/><path d="M28 18 q3 -6 9 -7" fill="none" stroke="${GLYPH}" stroke-width="2.5" stroke-linecap="round"/><circle cx="38" cy="10" r="2.5" fill="${GLYPH}"/>`,
    ),
  },
  speed: {
    label: 'Velocidade',
    effect: '+0,5 de velocidade',
    color: '#4cc9f0',
    svg: disk(
      '#4cc9f0',
      `<path d="M12 14 L22 24 L12 34 M24 14 L34 24 L24 34" fill="none" stroke="${GLYPH}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  },
  kick: {
    label: 'Chute',
    effect: 'chuta bombas',
    color: '#ffd166',
    soon: true,
    svg: disk('#ffd166', `<path fill="${GLYPH}" d="M16 10h10v16l12 4q3 1 3 4v2H13V26h3z"/>`),
  },
  punch: {
    label: 'Soco',
    effect: 'soca bombas',
    color: '#ff6b9a',
    soon: true,
    svg: disk(
      '#ff6b9a',
      `<rect x="12" y="20" width="24" height="18" rx="6" fill="${GLYPH}"/><rect x="16" y="11" width="5" height="11" rx="2.5" fill="${GLYPH}"/><rect x="22" y="10" width="5" height="12" rx="2.5" fill="${GLYPH}"/><rect x="28" y="11" width="5" height="11" rx="2.5" fill="${GLYPH}"/>`,
    ),
  },
  throw: {
    label: 'Arremesso',
    effect: 'arremessa bombas',
    color: '#2ec4b6',
    soon: true,
    svg: disk(
      '#2ec4b6',
      `<path d="M10 34Q24 6 38 24" fill="none" stroke="${GLYPH}" stroke-width="4" stroke-linecap="round"/><path d="M31 22L39 25L36 32" fill="none" stroke="${GLYPH}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="34" r="4" fill="${GLYPH}"/>`,
    ),
  },
}

export function iconDataUrl(type: ItemType): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEM_INFO[type].svg)}`
}
