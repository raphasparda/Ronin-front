import { ShieldAlert } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { EmptyState } from '../../../components/ui/EmptyState';
import { usePageTransition } from '../../../lib/use-page-transition';
import { MESSAGES } from '../../../lib/query-client';
import { useSessionUser } from '../auth/auth-api';

const TABS = [
  { to: '/admin/membros', label: 'Membros' },
  { to: '/admin/convites', label: 'Convites' },
  { to: '/admin/workspace', label: 'Equipe' },
] as const;

function tabClass({ isActive }: { isActive: boolean }) {
  return `relative flex h-11 shrink-0 items-center px-1 no-underline ${
    isActive
      ? 'font-semibold text-text after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-accent'
      : 'font-medium text-muted hover:text-text'
  }`;
}

/** Área de administração: só Admin. Member vê o aviso de permissão, sem chamar a API. */
export function AdminLayout() {
  const user = useSessionUser();

  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <title>Sem permissão · Ronin</title>
        <EmptyState
          icon={ShieldAlert}
          headingLevel="h1"
          title="Área de administração"
          description={`${MESSAGES.forbidden} Só Admins acessam esta área.`}
          action={<Link to="/">Voltar para Quadros</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-xl">Administração</h1>
      <nav
        aria-label="Administração"
        className="relative -mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0"
      >
        <ul className="flex gap-5">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink to={tab.to} className={tabClass}>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <AdminTabContent />
    </div>
  );
}

function AdminTabContent() {
  const { pathname } = useLocation();
  const ref = usePageTransition<HTMLDivElement>(pathname);
  return (
    <div ref={ref}>
      <Outlet />
    </div>
  );
}
