export interface BombData {
  /** Sílabas que aparecem na vez de cada jogador. */
  syllables: string[];
  /** Palavras aceitas (60 mil palavras comuns do português). */
  dictionary: Set<string>;
}

let cache: Promise<BombData> | null = null;

export function loadBombData(): Promise<BombData> {
  cache ??= Promise.all([
    fetch('/data/bomb-silabas.json').then((r) => {
      if (!r.ok) throw new Error('Não consegui carregar as sílabas do Bomb Party.');
      return r.json() as Promise<string[]>;
    }),
    fetch('/data/bomb-palavras.txt').then((r) => {
      if (!r.ok) throw new Error('Não consegui carregar o dicionário do Bomb Party.');
      return r.text();
    }),
  ]).then(([syllables, text]) => ({
    syllables,
    dictionary: new Set(text.split('\n').map((w) => w.trim()).filter(Boolean)),
  }));
  return cache;
}
