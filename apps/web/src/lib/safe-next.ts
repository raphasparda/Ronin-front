const PLACEHOLDER_ORIGIN = 'http://ronin.invalid';
const AUTH_PATHS = new Set(['/login', '/setup']);

function hasUnsafeCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || char === '\\') return true;
  }
  return false;
}

/**
 * Destino do `?next=` do login. Aceita só caminhos internos (`/b/123?x=1`); qualquer coisa
 * que possa sair da origem (`//evil.com`, `https://…`, `/\evil.com`, `javascript:`) vira `/`.
 * Telas de autenticação também viram `/` para não criar laço.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || hasUnsafeCharacters(raw)) return '/';

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return '/';
  }
  if (url.origin !== PLACEHOLDER_ORIGIN || AUTH_PATHS.has(url.pathname)) return '/';

  // A normalização pode recriar um caminho protocol-relative: `/..//evil.com` vira `//evil.com`.
  const out = `${url.pathname}${url.search}${url.hash}`;
  if (out.startsWith('//') || hasUnsafeCharacters(out)) return '/';
  return out;
}

/** `/login?next=<rota atual>` (sem `next` quando a rota atual é `/`). */
export function loginPath(currentPath: string): string {
  const next = safeNextPath(currentPath);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
