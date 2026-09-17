// Localiza o repositório ronin-api a partir do ronin-web.
//
// Ordem: variável de ambiente RONIN_API_DIR -> RONIN_API_DIR no `.env` do ronin-web -> `../ronin-api`.
// Caminhos relativos são resolvidos a partir da raiz do ronin-web. Usado pelo vite.config.ts (porta
// da API para o proxy), pelo e2e/run.mjs (banco local e migrations) e pelo e2e/playwright.config.ts
// (sobe a API com `tsx src/server.ts`).
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_API_DIR = '../ronin-api';

/**
 * Lê um arquivo `.env` sem alterar `process.env`. Sem arquivo, retorna `{}`.
 * @param {string} file
 * @returns {Record<string, string | undefined>}
 */
export function readEnvFile(file) {
  try {
    return parseEnv(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/** Caminho absoluto do ronin-api. */
export function resolveApiDir() {
  const raw =
    process.env.RONIN_API_DIR?.trim() ||
    readEnvFile(join(WEB_ROOT, '.env')).RONIN_API_DIR?.trim() ||
    DEFAULT_API_DIR;
  return isAbsolute(raw) ? raw : resolve(WEB_ROOT, raw);
}

/** `.env` do ronin-api (ex.: PORT da API). Sem arquivo, `{}`. */
export function readApiEnv() {
  return readEnvFile(join(resolveApiDir(), '.env'));
}
