// pnpm test:e2e — prepara o banco ISOLADO dos E2E e roda o Playwright.
//
// A API vem do repositório irmão ronin-api (RONIN_API_DIR, padrão ../ronin-api; veja
// scripts/ronin-api-dir.mjs), que precisa estar com `pnpm install` feito.
// 1. Sobe (ou reaproveita) o PostgreSQL local de dev do ronin-api (scripts/dev-db, dados em
//    <ronin-api>/.data) e cria o banco `kanban_e2e` no mesmo servidor do DATABASE_URL (lido do
//    ambiente ou do .env do ronin-api). Os bancos `kanban` (dev) e `kanban_test` (Vitest) nunca
//    são tocados: os testes truncam só o banco E2E.
// 2. Aplica as migrations nesse banco (`pnpm run db:migrate` no ronin-api).
// 3. Roda `playwright test` (argumentos extras são repassados, ex.: `pnpm test:e2e --headed`).
//    O `webServer` do Playwright sobe API (3100, `tsx src/server.ts` no ronin-api) e web (5320)
//    apontando para o banco E2E, em portas próprias para não colidir com `pnpm dev` (3000/5310)
//    nem com a 5173 de outro projeto.
// 4. Para o PostgreSQL só se foi este processo que o subiu.
//
// O banco é preparado aqui, e não no `globalSetup`, porque o Playwright sobe o `webServer` antes
// do `globalSetup`, e no Windows derruba o `webServer` com `taskkill /F` (sem chance de limpeza).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { WEB_ROOT, resolveApiDir } from '../scripts/ronin-api-dir.mjs';

const WEB_DIR = WEB_ROOT;
const API_DIR = resolveApiDir();

/** @param {string} message */
const log = (message) => process.stdout.write(`[e2e] ${message}\n`);

const devDbModule = join(API_DIR, 'scripts', 'dev-db', 'postgres.mjs');
if (!existsSync(devDbModule)) {
  log(
    `ronin-api não encontrado em ${API_DIR}. Clone o repositório ao lado deste (../ronin-api) ou defina RONIN_API_DIR.`,
  );
  process.exit(1);
}
if (!existsSync(join(API_DIR, 'node_modules'))) {
  log(`dependências do ronin-api não instaladas: rode "pnpm install" em ${API_DIR}.`);
  process.exit(1);
}
log(`API: ${API_DIR}`);

// Contrato com o ronin-api: scripts/dev-db/postgres.mjs exporta readDevEnv e startDevDatabase.
const { readDevEnv, startDevDatabase } = await import(pathToFileURL(devDbModule).href);

const { databaseUrl } = await readDevEnv();

/** Mesmo servidor/credenciais do DATABASE_URL, banco `kanban_e2e` (ou E2E_DATABASE_URL). */
function e2eDatabaseUrl() {
  const explicit = process.env.E2E_DATABASE_URL?.trim();
  if (explicit) return explicit;
  const url = new URL(databaseUrl);
  url.pathname = '/kanban_e2e';
  return url.toString();
}

const e2eUrl = e2eDatabaseUrl();
const e2eName = decodeURIComponent(new URL(e2eUrl).pathname.replace(/^\//, ''));
const devName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
if (!/e2e/i.test(e2eName) || e2eName === devName) {
  log(`recusado: o banco E2E ("${e2eName}") precisa conter "e2e" e ser diferente do de dev.`);
  process.exit(1);
}

/**
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} options
 * @returns {Promise<number>}
 */
function runPnpm(args, { cwd, env = process.env }) {
  const execPath = process.env.npm_execpath;
  const child =
    execPath && /\.c?js$/.test(execPath)
      ? spawn(process.execPath, [execPath, ...args], { cwd, stdio: 'inherit', env })
      : spawn(`pnpm ${args.join(' ')}`, { cwd, stdio: 'inherit', shell: true, env });
  return new Promise((resolvePromise) => {
    child.on('error', () => resolvePromise(1));
    child.on('exit', (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)));
  });
}

let db;
try {
  db = await startDevDatabase({
    databaseUrl: e2eUrl,
    log: (message) => process.stdout.write(`[db] ${message}\n`),
  });
} catch (err) {
  log(`erro ao preparar o banco: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

let exitCode = 1;
let stopping = false;
async function finish() {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(exitCode);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => void finish());
}

try {
  log(`aplicando migrations em ${e2eName}...`);
  const migrateCode = await runPnpm(['run', 'db:migrate'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: e2eUrl },
  });
  if (migrateCode !== 0) {
    log(`migrations falharam (código ${migrateCode}).`);
  } else {
    exitCode = await runPnpm(
      [
        'exec',
        'playwright',
        'test',
        '--config',
        'e2e/playwright.config.ts',
        ...process.argv.slice(2),
      ],
      {
        cwd: WEB_DIR,
        env: { ...process.env, E2E_DATABASE_URL: e2eUrl, RONIN_API_DIR: API_DIR },
      },
    );
  }
} finally {
  await finish();
}
