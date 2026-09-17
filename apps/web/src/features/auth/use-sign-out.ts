import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { setupStatusQueryKey, useLogout } from './auth-api';

/** "Sair": encerra a sessão, vai para o login e limpa o cache (menos o status do setup). */
export function useSignOut() {
  const logout = useLogout();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = () => {
    if (logout.isPending) return;
    logout.mutate(undefined, {
      onSuccess: () => {
        void Promise.resolve(navigate('/login', { replace: true })).then(() =>
          queryClient.removeQueries({
            predicate: (query) => query.queryKey[0] !== setupStatusQueryKey[0],
          }),
        );
      },
    });
  };

  return { signOut, pending: logout.isPending };
}
