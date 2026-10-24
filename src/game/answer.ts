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

function normalizeAnswer(text: string): string {
  return normalize(text.replace(/&/g, ' e '));
}

const TITLE_SEPARATOR = /^(.+?)\s*(?::\s+|\s+[-–—]\s+|\s+e\s+)\s*(.+)$/i;

function titleBase(raw: string): string | undefined {
  const text = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s:&–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = text.match(TITLE_SEPARATOR);
  if (match) {
    const base = stripArticle(normalizeAnswer(match[1]));
    const rest = normalizeAnswer(match[2]);
    if (!base || !rest) return undefined;
    const baseWords = base.split(' ').length;
    const restWords = rest.split(' ').length;
    if (baseWords < 2 && restWords < 2 && base.length < 6) return undefined;
    return base;
  }

  const trimmed = text
    .replace(/\s+(?:the\s+)?final\s+season\b.*$/i, '')
    .replace(/\s+(?:season|temporada)\s+\d+\b.*$/i, '')
    .replace(/\s+(?:part|parte)\s+(?:\d+|[ivx]+)\b.*$/i, '')
    .replace(/\s+\(\d{4}\)$/, '')
    .replace(/\s+\d{4}$/, '')
    .trim();
  if (!trimmed || trimmed === text) return undefined;
  const base = stripArticle(normalizeAnswer(trimmed));
  return base.length >= 4 ? base : undefined;
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

interface GuessOptions {
  titleAliases?: boolean;
}

function matches(guess: string, answer: string): boolean {
  const a = stripArticle(normalizeAnswer(answer));
  if (!a) return false;
  if (guess === a) return true;
  return a.length >= 8 && levenshtein(guess, a) === 1;
}

/**
 * Verifica se o palpite corresponde a alguma resposta aceita.
 * - ignora acento, caixa, pontuação e artigo inicial ("O Poderoso Chefão" = "poderoso chefao")
 * - aceita 1 erro de digitação quando a resposta tem 8+ caracteres
 * - com titleAliases, aceita o título principal de obras compostas
 */
export function isCorrectGuess(guess: string, answers: readonly string[], options: GuessOptions = {}): boolean {
  const g = stripArticle(normalizeAnswer(guess));
  if (!g) return false;

  return answers.some((answer) => {
    if (matches(g, answer)) return true;
    if (!options.titleAliases) return false;
    const base = titleBase(answer);
    return base ? matches(g, base) : false;
  });
}
