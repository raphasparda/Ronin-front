import { Outlet, useLocation } from 'react-router';

import { pageTransitionKey, usePageTransition } from '../../lib/use-page-transition';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  const { pathname } = useLocation();
  // As abas de /admin ficam paradas: o AdminLayout anima só o conteúdo da aba.
  const key = pathname.startsWith('/admin') ? '/admin' : pageTransitionKey(pathname);
  const pageRef = usePageTransition<HTMLDivElement>(key);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a
        href="#conteudo"
        className="sr-only z-40 rounded-md bg-accent px-3 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <AppHeader />
      <main
        id="conteudo"
        tabIndex={-1}
        className="flex-1 px-4 pt-6 pb-20 outline-none md:px-6 md:pb-6"
      >
        <div ref={pageRef}>
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
