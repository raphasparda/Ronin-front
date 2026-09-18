/**
 * Portas e banco dos E2E. Diferentes do `pnpm dev` (API 3000, web 5310) para os dois poderem
 * rodar juntos; 5173 é de outro projeto da máquina do cliente e nunca é usada.
 */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5320);

export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
export const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;

/** Definido pelo `e2e/run.mjs`; o padrão casa com o PostgreSQL local de dev (porta 5433). */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL?.trim() || 'postgres://ronin:ronin@127.0.0.1:5433/ronin_e2e';
