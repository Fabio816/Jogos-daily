export interface TermoData {
  /** Palavras secretas (só as mais comuns do português). */
  targets: string[];
  /** Palavras aceitas como palpite (5 letras comuns, sem nomes/estrangeirismos). */
  dictionary: Set<string>;
}

let cache: Promise<TermoData> | null = null;

/** Carrega as listas uma vez por sessão. Os arquivos ficam em public/data/. */
export function loadTermoData(): Promise<TermoData> {
  cache ??= Promise.all([
    fetch('/data/termo-alvos.json').then((r) => {
      if (!r.ok) throw new Error('Não consegui carregar as palavras do Termo.');
      return r.json() as Promise<string[]>;
    }),
    fetch('/data/termo-palavras.txt').then((r) => {
      if (!r.ok) throw new Error('Não consegui carregar o dicionário do Termo.');
      return r.text();
    }),
  ]).then(([targets, text]) => ({
    targets,
    dictionary: new Set(text.split('\n').map((w) => w.trim()).filter(Boolean)),
  }));
  return cache;
}
