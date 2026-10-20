import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const KEY = 'qeo:theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export const theme = ref<Theme>(stored() ?? (media?.matches ? 'dark' : 'light'));

function apply(value: Theme) {
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'dark' ? '#1d1c1a' : '#f4f1e8');
}

export function initTheme() {
  apply(theme.value);
}

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, theme.value);
  } catch {
    // modo privado: vale só nesta navegação
  }
  apply(theme.value);
}
