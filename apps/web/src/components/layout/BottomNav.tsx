import { LayoutGrid, SquareCheckBig, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { isBoardsSection, isMyCardsSection } from './nav-sections';

function BottomNavLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`focus-inset relative flex h-14 flex-1 items-center justify-center gap-2 no-underline ${
        active
          ? 'font-semibold text-accent-text before:absolute before:inset-x-6 before:top-0 before:h-[3px] before:rounded-full before:bg-accent'
          : 'font-medium text-muted hover:text-text'
      }`}
    >
      <Icon aria-hidden size={20} />
      {label}
    </Link>
  );
}

/** Navegação principal no mobile (< 768px, screens §1.2): Quadros e Meus cards embaixo. */
export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        <li className="flex flex-1">
          <BottomNavLink
            to="/"
            label="Quadros"
            icon={LayoutGrid}
            active={isBoardsSection(pathname)}
          />
        </li>
        <li className="flex flex-1">
          <BottomNavLink
            to="/meus-cards"
            label="Meus cards"
            icon={SquareCheckBig}
            active={isMyCardsSection(pathname)}
          />
        </li>
      </ul>
    </nav>
  );
}
