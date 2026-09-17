import { Outlet } from 'react-router';

import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { BrandWatermark } from './BrandWatermark';
import { Credit } from './Credit';

/** A troca de página anima via View Transitions (lib/page-transitions.ts). */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a
        href="#conteudo"
        className="sr-only z-40 rounded-md bg-accent px-3 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <BrandWatermark />
      <AppHeader />
      <main
        id="conteudo"
        tabIndex={-1}
        className="relative z-10 flex-1 px-4 pt-6 pb-6 outline-none md:px-6"
      >
        <Outlet />
      </main>
      {/* no celular, a folga de baixo evita a barra de navegação fixa */}
      <Credit className="relative z-10 px-4 pt-2 pb-20 md:pb-4" />
      <BottomNav />
    </div>
  );
}
