const LEADING_ARTICLES = /^(o|a|os|as|um|uma|the)\s+/;

/** Minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripArticle(normalized: string): string {
  return normalized.replace(LEADING_ARTICLES, '');
}

/** Distância de Levenshtein (para tolerar erro de digitação em respostas longas). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Verifica se o palpite corresponde a alguma resposta aceita.
 * - ignora acento, caixa, pontuação e artigo inicial ("O Poderoso Chefão" = "poderoso chefao")
 * - aceita 1 erro de digitação quando a resposta tem 8+ caracteres
 */
export function isCorrectGuess(guess: string, answers: readonly string[]): boolean {
  const g = stripArticle(normalize(guess));
  if (!g) return false;

  return answers.some((answer) => {
    const a = stripArticle(normalize(answer));
    if (!a) return false;
    if (g === a) return true;
    return a.length >= 8 && levenshtein(g, a) === 1;
  });
}
