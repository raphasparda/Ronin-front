import pg from 'pg';

import { E2E_DATABASE_URL } from './env';

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

/**
 * Volta o banco E2E ao estado de instância limpa: esvazia todas as tabelas do schema `public`
 * (as migrations, no schema `drizzle`, ficam). Só aceita bancos com "e2e" no nome, para nunca
 * apagar o banco de desenvolvimento (`kanban`) por engano.
 */
export async function resetDatabase(): Promise<void> {
  const name = databaseName(E2E_DATABASE_URL);
  if (!/e2e/i.test(name)) {
    throw new Error(`resetDatabase recusado: "${name}" não parece um banco de E2E.`);
  }
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  client.on('error', () => undefined);
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT format('%I.%I', schemaname, tablename) AS name
         FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    if (rows.length === 0) return;
    await client.query(
      `TRUNCATE TABLE ${rows.map((r) => r.name).join(', ')} RESTART IDENTITY CASCADE`,
    );
  } finally {
    await client.end();
  }
}
