import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEV_HOST = '127.0.0.1';
const DEV_PORT = 5310;

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

/**
 * A API exige `Origin === APP_ORIGIN` (`http://127.0.0.1:5310`): quem abre `localhost:5310`
 * tomaria 403 em toda mutação. Em dev, redireciona para o mesmo caminho em `127.0.0.1`.
 */
function redirectLocalhost(): Plugin {
  return {
    name: 'ronin:redirect-localhost',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
        if (hostname !== 'localhost') {
          next();
          return;
        }
        res.statusCode = 307;
        res.setHeader('Location', `http://${DEV_HOST}:${DEV_PORT}${req.url ?? '/'}`);
        res.end();
      });
    },
  };
}

export default defineConfig(() => {
  const rootEnv = readRootEnv();
  const port = process.env.PORT ?? rootEnv.PORT ?? '3000';
  const apiTarget = process.env.API_PROXY_TARGET ?? `http://127.0.0.1:${port}`;

  return {
    plugins: [react(), tailwindcss(), redirectLocalhost()],
    server: {
      // 5173 é usada por outro projeto na máquina do cliente: porta fixa e falha se ocupada.
      host: DEV_HOST,
      port: DEV_PORT,
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
