import { createHash, randomBytes } from 'node:crypto';

import pg from 'pg';

import { resetDatabase } from './db';
import { E2E_DATABASE_URL } from './env';

/** Senha de todos os usuários semeados. */
export const SEED_PASSWORD = 'senha-muito-segura-e2e';

/**
 * Hash Argon2id de `SEED_PASSWORD` com os parâmetros de produção da API (m=19456, t=2, p=1),
 * gerado uma vez com `@node-rs/argon2`. O login real verifica contra ele.
 */
const SEED_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$sGqbvjmvshDE3U7fO+v62A$Xpelzzoim+Zuy+WcPUSzXytAXqJta+HmQCS51/emDuU';

/** Cookie de sessão fora de produção (apps/api/src/plugins/session.ts). */
export const SESSION_COOKIE = 'kanban_sid';

export const WORKSPACE = { name: 'Equipe E2E', timezone: 'America/Sao_Paulo' } as const;

export interface SeedUserInput {
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export interface SeededUser extends SeedUserInput {
  id: string;
  /** Token cru da sessão já criada (vai no cookie). */
  token: string;
}

const DAY_MS = 86_400_000;

/**
 * Instância configurada sem passar por `POST /api/setup` (limite de 5 / 15 min por IP, em
 * memória, já usado por smoke e auth-flow): trunca o banco E2E e grava workspace, usuários e
 * uma sessão para cada um, no mesmo formato da API (token base64url, `sessions.id` = SHA-256).
 */
export async function seedTeam<const T extends Record<string, SeedUserInput>>(
  users: T,
): Promise<{ [K in keyof T]: SeededUser }> {
  await resetDatabase();
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  client.on('error', () => undefined);
  await client.connect();
  try {
    await client.query('INSERT INTO workspace (id, name, timezone) VALUES (1, $1, $2)', [
      WORKSPACE.name,
      WORKSPACE.timezone,
    ]);
    const seeded: Record<string, SeededUser> = {};
    const now = Date.now();
    for (const [key, user] of Object.entries(users)) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.email, user.name, SEED_PASSWORD_HASH, user.role],
      );
      const id = rows[0]?.id;
      if (!id) throw new Error(`seed: usuário ${user.email} não foi criado`);
      const token = randomBytes(32).toString('base64url');
      await client.query(
        `INSERT INTO sessions (id, user_id, idle_expires_at, absolute_expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          createHash('sha256').update(token, 'utf8').digest('hex'),
          id,
          new Date(now + 14 * DAY_MS),
          new Date(now + 30 * DAY_MS),
        ],
      );
      seeded[key] = { ...user, id, token };
    }
    return seeded as { [K in keyof T]: SeededUser };
  } finally {
    await client.end();
  }
}

export const ANA: SeedUserInput = { name: 'Ana Admin', email: 'ana@exemplo.com', role: 'admin' };
export const BRUNO: SeedUserInput = {
  name: 'Bruno Membro',
  email: 'bruno@exemplo.com',
  role: 'member',
};
export const CARLA: SeedUserInput = {
  name: 'Carla Costa',
  email: 'carla@exemplo.com',
  role: 'member',
};
