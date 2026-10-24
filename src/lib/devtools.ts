/**
 * Detecção de ferramentas de desenvolvedor (F12) abertas.
 *
 * Limites honestos:
 * - Detecta que as ferramentas abriram, não o que a pessoa fez nelas.
 * - É heurística. Zoom, barras do navegador ou janela redimensionada podem confundir.
 * - Quem quer trapacear pode desligar isso editando o JavaScript. A proteção de verdade
 *   fica no servidor (regras e validação), não aqui.
 */

/** Diferença entre a janela externa e a área útil que indica painel acoplado. */
const DOCK_THRESHOLD_PX = 160;

export interface DevtoolsWatchOptions {
  /** Intervalo entre checagens. */
  intervalMs?: number;
  /** Tempo mínimo entre dois avisos para a mesma pessoa. */
  cooldownMs?: number;
}

/** Só faz sentido em computador (mouse + teclado). Celular não tem F12. */
function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
}

/** Sonda: o console só avalia a propriedade `id` quando exibe o objeto, ou seja, com o console aberto. */
function makeConsoleProbe(): { probe: object; wasRead: () => boolean; reset: () => void } {
  let read = false;
  const probe = {};
  Object.defineProperty(probe, 'id', {
    get() {
      read = true;
      return '';
    },
  });
  return {
    probe,
    wasRead: () => read,
    reset: () => {
      read = false;
    },
  };
}

/**
 * Começa a vigiar. `onOpen` recebe o motivo. Devolve a função que para a vigilância.
 * Um aviso por abertura: se fechar e abrir de novo, avisa de novo após o cooldown.
 */
export function startDevtoolsWatch(onOpen: (reason: string) => void, options: DevtoolsWatchOptions = {}): () => void {
  if (!isDesktop()) return () => {};

  const intervalMs = options.intervalMs ?? 2000;
  const cooldownMs = options.cooldownMs ?? 30000;
  const consoleProbe = makeConsoleProbe();
  let ticks = 0;
  let wasOpen = false;
  let lastReportAt = 0;

  const check = () => {
    ticks++;
    let reason: string | null = null;

    if (window.outerWidth - window.innerWidth > DOCK_THRESHOLD_PX || window.outerHeight - window.innerHeight > DOCK_THRESHOLD_PX) {
      reason = 'painel acoplado';
    }

    // A sonda é mais lenta: a cada ~10 s, para não encher o console de objetos.
    if (ticks % 5 === 0) {
      consoleProbe.reset();
      // eslint-disable-next-line no-console
      console.log(consoleProbe.probe);
      if (consoleProbe.wasRead()) reason = reason ?? 'console aberto';
    }

    const isOpen = reason !== null;
    const now = Date.now();
    if (isOpen && !wasOpen && now - lastReportAt >= cooldownMs) {
      lastReportAt = now;
      onOpen(reason!);
    }
    wasOpen = isOpen;
  };

  const timer = window.setInterval(check, intervalMs);
  return () => window.clearInterval(timer);
}
