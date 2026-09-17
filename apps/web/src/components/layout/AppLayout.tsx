import { Outlet } from 'react-router';

import { AppHeader } from './AppHeader';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a
        href="#conteudo"
        className="sr-only z-40 rounded-md bg-accent px-3 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <AppHeader />
      <main id="conteudo" tabIndex={-1} className="flex-1 px-4 py-6 outline-none md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
