/** Parâmetro da URL que leva direto para uma sala: /termo?sala=ABCDE */
export const INVITE_PARAM = 'sala';

/** Código de sala numa query string (ex.: "?sala=abcde" -> "ABCDE"), ou string vazia. */
export function parseInviteCode(search: string): string {
  const raw = new URLSearchParams(search).get(INVITE_PARAM) ?? '';
  return raw.trim().toUpperCase().slice(0, 5);
}

/** Código de sala presente na URL atual, ou string vazia. */
export function inviteCodeFromUrl(): string {
  return parseInviteCode(window.location.search);
}

/** Link completo para convidar alguém para a sala `code` do jogo em `path`. */
export function inviteLinkFor(path: string, code: string): string {
  return `${window.location.origin}${path}?${INVITE_PARAM}=${encodeURIComponent(code)}`;
}

/** Remove o parâmetro `sala` da URL depois de entrar, sem recarregar a página. */
export function clearInviteFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(INVITE_PARAM)) return;
  url.searchParams.delete(INVITE_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
