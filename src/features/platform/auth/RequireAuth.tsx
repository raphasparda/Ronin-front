import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router';

import { loginPath } from '../../../lib/safe-next';
import { sessionQueryKey, useSession, useSetupStatus } from './auth-api';
import { BootError, BootLoading } from './BootScreen';

export interface LoginLocationState {
  sessionExpired?: boolean;
  /** Veio de `/redefinir-senha` com sucesso. */
  passwordReset?: boolean;
}

/**
 * Boot das rotas logadas: `setup/status` (instância nova → `/setup`) e depois `auth/me`
 * (sem sessão → `/login?next=<rota>`).
 */
export function RequireAuth() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const setup = useSetupStatus();
  const needsSetup = setup.data?.needsSetup;
  const session = useSession({ enabled: needsSetup === false });

  if (needsSetup === undefined) {
    return setup.isError ? (
      <BootError onRetry={() => void setup.refetch()} retrying={setup.isFetching} />
    ) : (
      <BootLoading />
    );
  }
  if (needsSetup) return <Navigate to="/setup" replace />;

  if (session.data) return <Outlet />;

  if (session.data === null) {
    const hadSession = (queryClient.getQueryState(sessionQueryKey)?.dataUpdateCount ?? 0) > 1;
    const state: LoginLocationState | undefined = hadSession ? { sessionExpired: true } : undefined;
    const current = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={loginPath(current)} replace state={state} />;
  }

  return session.isError ? (
    <BootError onRetry={() => void session.refetch()} retrying={session.isFetching} />
  ) : (
    <BootLoading />
  );
}
