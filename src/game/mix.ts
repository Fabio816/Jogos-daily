import type { Question } from '../data/questions';

/**
 * Tipos de rodada. Cada um tem um peso (porcentagem) escolhido pelo host.
 * - capa:        capa da obra desfocada, que vai ficando nítida
 * - capa-clara:  capa da obra nítida desde o início
 * - texto:       frase ou emoji de uma obra
 * - ator:        mostra a capa e o personagem; o jogador digita o ator
 * - personagem:  mostra a capa e o ator; o jogador digita o personagem
 */
export type Group = 'capa' | 'capa-clara' | 'texto' | 'ator' | 'personagem';
export type Mix = Record<Group, number>;

export const GROUPS: Group[] = ['capa', 'capa-clara', 'texto', 'ator', 'personagem'];

export const GROUP_LABEL: Record<Group, string> = {
  capa: 'Capa desfocada',
  'capa-clara': 'Capa nítida',
  texto: 'Frase ou emoji',
  ator: 'Quem interpreta? (ator)',
  personagem: 'Qual personagem? (personagem)',
};

export const DEFAULT_MIX: Mix = {
  capa: 40,
  'capa-clara': 20,
  texto: 15,
  ator: 15,
  personagem: 10,
};

/** Em quais tipos de rodada a pergunta pode aparecer. */
export function eligibleGroups(q: Question): Group[] {
  if (q.kind === 'actor') return ['ator'];
  if (q.kind === 'character') return ['personagem'];
  if (q.clueType === 'image') return ['capa', 'capa-clara'];
  return ['texto'];
}

export interface RoundPick {
  question: Question;
  /** true só para a capa desfocada. */
  blur: boolean;
}

/**
 * Sorteia o tipo da rodada pelos pesos e depois uma pergunta não usada desse tipo.
 * Se um tipo não tiver perguntas disponíveis, ele é ignorado e o sorteio continua
 * entre os demais. Retorna undefined quando nada mais pode ser sorteado.
 */
export function pickRound(
  pool: readonly Question[],
  used: ReadonlySet<string>,
  mix: Mix,
  rng: () => number = Math.random,
): RoundPick | undefined {
  let groups = GROUPS.filter((g) => (mix[g] ?? 0) > 0);

  while (groups.length > 0) {
    const total = groups.reduce((sum, g) => sum + mix[g], 0);
    let roll = rng() * total;
    let chosen = groups[groups.length - 1];
    for (const g of groups) {
      roll -= mix[g];
      if (roll < 0) {
        chosen = g;
        break;
      }
    }

    const candidates = pool.filter((q) => !used.has(q.id) && eligibleGroups(q).includes(chosen));
    if (candidates.length > 0) {
      const question = candidates[Math.floor(rng() * candidates.length)];
      return { question, blur: chosen === 'capa' };
    }
    groups = groups.filter((g) => g !== chosen);
  }
  return undefined;
}
