import { limitToLast, onValue, push, query, ref } from 'firebase/database';
import { onBeforeUnmount, ref as vueRef, watch, type Ref } from 'vue';
import { db, ensureSignedIn } from '../firebase';
import { serverNow } from './time';
import { startDevtoolsWatch } from './devtools';

export type AlertGame = 'qual-e-a-obra' | 'bomb' | 'onde' | 'termo';

export interface AlertItem {
  id: string;
  uid: string;
  name: string;
  reason: string;
  ts: number;
}

const MAX_ALERTS = 20;

/** Avisos ficam em alerts/{jogo}/{sala}. As regras só deixam cada pessoa gravar o próprio uid. */
function alertsPath(game: AlertGame, code: string) {
  return `alerts/${game}/${code}`;
}

export function subscribeAlerts(game: AlertGame, code: string, callback: (list: AlertItem[]) => void) {
  return onValue(query(ref(db, alertsPath(game, code)), limitToLast(MAX_ALERTS)), (snap) => {
    const list: AlertItem[] = [];
    snap.forEach((child) => {
      list.push({ id: child.key ?? '', ...child.val() } as AlertItem);
    });
    callback(list);
  });
}

export async function reportAlert(game: AlertGame, code: string, name: string, reason: string) {
  const user = await ensureSignedIn();
  await push(ref(db, alertsPath(game, code)), {
    uid: user.uid,
    name: name.trim().slice(0, 20) || 'Alguém',
    reason,
    ts: serverNow(),
  });
}

/**
 * Liga o aviso de DevTools durante a partida e mostra os avisos da sala.
 * Chame dentro do setup do componente. `active` diz quando a partida está rolando.
 */
export function useDevtoolsAlerts(
  game: AlertGame,
  code: Ref<string>,
  name: Ref<string>,
  active: Ref<boolean>,
): Ref<AlertItem[]> {
  const alerts = vueRef<AlertItem[]>([]);
  let unsubAlerts: (() => void) | null = null;
  let stopWatch: (() => void) | null = null;

  watch(
    code,
    (c) => {
      unsubAlerts?.();
      unsubAlerts = null;
      alerts.value = [];
      if (c) unsubAlerts = subscribeAlerts(game, c, (list) => (alerts.value = list));
    },
    { immediate: true },
  );

  watch(
    [code, active],
    ([c, on]) => {
      stopWatch?.();
      stopWatch = null;
      if (!c || !on) return;
      stopWatch = startDevtoolsWatch((reason) => {
        reportAlert(game, c, name.value, reason).catch(() => {});
      });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    unsubAlerts?.();
    stopWatch?.();
  });

  return alerts;
}
