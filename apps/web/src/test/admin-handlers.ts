import {
  acceptInviteRequestSchema,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  authSessionResponseSchema,
  changePasswordRequestSchema,
  completePasswordResetRequestSchema,
  createInviteRequestSchema,
  createInviteResponseSchema,
  inviteLookupRequestSchema,
  inviteLookupResponseSchema,
  invitesResponseSchema,
  isPasswordSameAsEmail,
  passwordResetLinkResponseSchema,
  passwordResetLookupRequestSchema,
  passwordResetLookupResponseSchema,
  updateAdminUserRequestSchema,
  updateMeRequestSchema,
  updateMeResponseSchema,
  updateWorkspaceRequestSchema,
  workspaceResponseSchema,
  type AdminUser,
  type Invite,
  type Workspace,
} from '@kanban/shared';
import { randomUUID } from 'node:crypto';
import { http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw';
import type { z } from 'zod';

import { invite as inviteFixture, T0, TOKEN } from '../../../../packages/shared/src/test-fixtures';
import { apiErrorResponse, sessionFixture } from './auth-handlers';

export { TOKEN };

export const MEMBER_ID = '5a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
export const DEACTIVATED_ID = '6b2e3d4c-5f6a-4b7c-9d8e-0f1a2b3c4d5e';
export const ANONYMIZED_ID = '7c3f4e5d-6a7b-4c8d-8e9f-1a2b3c4d5e6f';

/** Senha atual aceita por `POST /api/me/password` no mock. */
export const CURRENT_PASSWORD = 'senha-correta-1';

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

interface AdminDb {
  users: AdminUser[];
  invites: Invite[];
  workspace: Workspace;
  requests: RecordedRequest[];
}

function seed(): AdminDb {
  return {
    users: [
      {
        id: sessionFixture.user.id,
        name: sessionFixture.user.name,
        email: sessionFixture.user.email,
        role: 'admin',
        status: 'active',
        anonymized: false,
        createdAt: T0,
      },
      {
        id: MEMBER_ID,
        name: 'Bruno Lima',
        email: 'bruno@empresa.com',
        role: 'member',
        status: 'active',
        anonymized: false,
        createdAt: T0,
      },
      {
        id: DEACTIVATED_ID,
        name: 'Carla Dias',
        email: 'carla@empresa.com',
        role: 'member',
        status: 'deactivated',
        anonymized: false,
        createdAt: T0,
      },
      {
        id: ANONYMIZED_ID,
        name: 'Usuário removido',
        email: null,
        role: 'member',
        status: 'deactivated',
        anonymized: true,
        createdAt: T0,
      },
    ],
    invites: [
      {
        ...inviteFixture,
        createdBy: sessionFixture.user.id,
        expiresAt: '2099-09-23T14:03:00.000Z',
      },
      {
        ...inviteFixture,
        id: randomUUID(),
        email: 'bruno@empresa.com',
        state: 'used',
        createdBy: sessionFixture.user.id,
        usedByUserId: MEMBER_ID,
      },
    ],
    workspace: { ...sessionFixture.workspace },
    requests: [],
  };
}

export let adminDb: AdminDb = seed();

export function resetAdminDb(): void {
  adminDb = seed();
}

async function readBody(request: StrictRequest<DefaultBodyType>, path: string): Promise<unknown> {
  const text = await request.text();
  const body: unknown = text === '' ? undefined : JSON.parse(text);
  adminDb.requests.push({ method: request.method, path, body });
  return body;
}

function validationError(error: z.ZodError) {
  return apiErrorResponse('VALIDATION_ERROR', {
    message: 'Dados inválidos.',
    details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

function findUser(userId: unknown): AdminUser | undefined {
  return adminDb.users.find((user) => user.id === userId);
}

function replaceUser(updated: AdminUser) {
  adminDb.users = adminDb.users.map((user) => (user.id === updated.id ? updated : user));
  return HttpResponse.json(adminUserResponseSchema.parse({ user: updated }));
}

export const adminHandlers = [
  http.get('/api/admin/users', () =>
    HttpResponse.json(adminUsersResponseSchema.parse({ users: adminDb.users })),
  ),

  http.patch('/api/admin/users/:userId', async ({ request, params }) => {
    const parsed = updateAdminUserRequestSchema.safeParse(await readBody(request, 'role'));
    if (!parsed.success) return validationError(parsed.error);
    const user = findUser(params.userId);
    if (!user) return apiErrorResponse('NOT_FOUND');
    if (user.id === sessionFixture.user.id) return apiErrorResponse('CANNOT_TARGET_SELF');
    if (user.anonymized) return apiErrorResponse('USER_ANONYMIZED');
    return replaceUser({ ...user, role: parsed.data.role });
  }),

  http.post('/api/admin/users/:userId/:action', async ({ request, params }) => {
    await readBody(request, String(params.action));
    const user = findUser(params.userId);
    if (!user) return apiErrorResponse('NOT_FOUND');
    if (params.action === 'deactivate') {
      if (user.id === sessionFixture.user.id) return apiErrorResponse('CANNOT_TARGET_SELF');
      return replaceUser({ ...user, status: 'deactivated' });
    }
    if (params.action === 'reactivate') {
      if (user.anonymized) return apiErrorResponse('USER_ANONYMIZED');
      return replaceUser({ ...user, status: 'active' });
    }
    if (params.action === 'password-reset-links') {
      if (user.anonymized) return apiErrorResponse('USER_ANONYMIZED');
      if (user.status !== 'active') return apiErrorResponse('USER_NOT_ACTIVE');
      return HttpResponse.json(
        passwordResetLinkResponseSchema.parse({
          url: `http://localhost:5310/redefinir-senha#token=${TOKEN}`,
          expiresAt: '2099-09-17T14:03:00.000Z',
        }),
        { status: 201 },
      );
    }
    return apiErrorResponse('NOT_FOUND');
  }),

  http.get('/api/admin/invites', () =>
    HttpResponse.json(invitesResponseSchema.parse({ invites: adminDb.invites })),
  ),

  http.post('/api/admin/invites', async ({ request }) => {
    const parsed = createInviteRequestSchema.safeParse(await readBody(request, 'invites'));
    if (!parsed.success) return validationError(parsed.error);
    const { email, role } = parsed.data;
    if (email !== null && adminDb.users.some((user) => user.email === email)) {
      return apiErrorResponse('EMAIL_TAKEN', { message: 'E-mail já cadastrado.' });
    }
    const created: Invite = {
      id: randomUUID(),
      email,
      role,
      createdBy: sessionFixture.user.id,
      createdAt: T0,
      expiresAt: '2099-09-23T14:03:00.000Z',
      state: 'pending',
      usedByUserId: null,
    };
    adminDb.invites = [created, ...adminDb.invites];
    return HttpResponse.json(
      createInviteResponseSchema.parse({
        invite: created,
        url: `http://localhost:5310/convite#token=${TOKEN}`,
      }),
      { status: 201 },
    );
  }),

  http.delete('/api/admin/invites/:inviteId', async ({ request, params }) => {
    await readBody(request, 'revoke');
    adminDb.invites = adminDb.invites.map((item) =>
      item.id === params.inviteId && item.state === 'pending'
        ? { ...item, state: 'revoked' }
        : item,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch('/api/admin/workspace', async ({ request }) => {
    const parsed = updateWorkspaceRequestSchema.safeParse(await readBody(request, 'workspace'));
    if (!parsed.success) return validationError(parsed.error);
    adminDb.workspace = {
      name: parsed.data.name ?? adminDb.workspace.name,
      timezone: parsed.data.timezone ?? adminDb.workspace.timezone,
    };
    return HttpResponse.json(workspaceResponseSchema.parse({ workspace: adminDb.workspace }));
  }),

  http.patch('/api/me', async ({ request }) => {
    const parsed = updateMeRequestSchema.safeParse(await readBody(request, 'me'));
    if (!parsed.success) return validationError(parsed.error);
    return HttpResponse.json(
      updateMeResponseSchema.parse({ user: { ...sessionFixture.user, name: parsed.data.name } }),
    );
  }),

  http.post('/api/me/password', async ({ request }) => {
    const parsed = changePasswordRequestSchema.safeParse(await readBody(request, 'me/password'));
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.currentPassword !== CURRENT_PASSWORD) {
      return apiErrorResponse('PASSWORD_INCORRECT', { message: 'Senha atual incorreta.' });
    }
    if (isPasswordSameAsEmail(parsed.data.newPassword, sessionFixture.user.email)) {
      return apiErrorResponse('VALIDATION_ERROR', {
        details: [{ path: 'newPassword', message: 'A senha não pode ser igual ao e-mail' }],
      });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/auth/invites/lookup', async ({ request }) => {
    const parsed = inviteLookupRequestSchema.safeParse(await readBody(request, 'invites/lookup'));
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.token !== TOKEN) {
      return apiErrorResponse('TOKEN_INVALID', { message: 'Convite inválido.' });
    }
    return HttpResponse.json(
      inviteLookupResponseSchema.parse({
        email: null,
        role: 'member',
        expiresAt: '2099-09-23T14:03:00.000Z',
      }),
    );
  }),

  http.post('/api/auth/invites/accept', async ({ request }) => {
    const parsed = acceptInviteRequestSchema.safeParse(await readBody(request, 'invites/accept'));
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.token !== TOKEN) {
      return apiErrorResponse('TOKEN_INVALID', { message: 'Convite inválido.' });
    }
    if (adminDb.users.some((user) => user.email === parsed.data.email)) {
      return apiErrorResponse('EMAIL_TAKEN', { message: 'E-mail já cadastrado.' });
    }
    return HttpResponse.json(
      authSessionResponseSchema.parse({
        user: {
          id: randomUUID(),
          name: parsed.data.name,
          email: parsed.data.email,
          role: 'member',
        },
        workspace: adminDb.workspace,
      }),
      { status: 201 },
    );
  }),

  http.post('/api/auth/password-resets/lookup', async ({ request }) => {
    const parsed = passwordResetLookupRequestSchema.safeParse(
      await readBody(request, 'password-resets/lookup'),
    );
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.token !== TOKEN) {
      return apiErrorResponse('TOKEN_INVALID', { message: 'Link de redefinição inválido.' });
    }
    return HttpResponse.json(
      passwordResetLookupResponseSchema.parse({
        userName: 'Bruno Lima',
        expiresAt: '2099-09-17T14:03:00.000Z',
      }),
    );
  }),

  http.post('/api/auth/password-resets/complete', async ({ request }) => {
    const parsed = completePasswordResetRequestSchema.safeParse(
      await readBody(request, 'password-resets/complete'),
    );
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.token !== TOKEN) {
      return apiErrorResponse('TOKEN_INVALID', { message: 'Link de redefinição inválido.' });
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

/** Últimas requisições registradas de um tipo (ex.: `'invites'`). */
export function requestsTo(path: string): RecordedRequest[] {
  return adminDb.requests.filter((item) => item.path === path);
}
