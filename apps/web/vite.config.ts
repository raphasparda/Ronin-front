import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Lê só o que o proxy precisa do `.env` da raiz. Não usar `loadEnv` do Vite aqui: ele
 * propaga o `NODE_ENV=development` do `.env` e o build de produção sairia em modo dev.
 */
function readRootEnv(): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(new URL('../../.env', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
}

export default defineConfig(() => {
  const rootEnv = readRootEnv();
  const port = process.env.PORT ?? rootEnv.PORT ?? '3000';
  const apiTarget = process.env.API_PROXY_TARGET ?? `http://127.0.0.1:${port}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // 5173 é usada por outro projeto na máquina do cliente: porta fixa e falha se ocupada.
      host: '127.0.0.1',
      port: 5310,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
    },
  };
});
