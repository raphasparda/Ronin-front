import { Link, useLocation } from 'react-router';

import { useSessionUser } from '../../features/auth/auth-api';
import { UserMenu } from '../../features/auth/UserMenu';
import { NotificationsMenu } from '../../features/notifications/NotificationsMenu';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { Logo } from './Logo';
import { isBoardsSection, isMyCardsSection } from './nav-sections';

function navLinkClass(isActive: boolean) {
  return `relative flex h-14 items-center px-1 no-underline ${
    isActive
      ? 'font-semibold text-text after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-accent'
      : 'font-medium text-muted hover:text-text'
  }`;
}

export function AppHeader() {
  const { pathname } = useLocation();
  const user = useSessionUser();
  const boardsActive = isBoardsSection(pathname);
  const myCardsActive = isMyCardsSection(pathname);
  const adminActive = pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface shadow-sm">
      <div className="flex h-14 items-center gap-6 px-4 md:px-6">
        <Logo asLink />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-5">
            <li>
              <Link
                to="/"
                aria-current={boardsActive ? 'page' : undefined}
                className={navLinkClass(boardsActive)}
              >
                Quadros
              </Link>
            </li>
            <li>
              <Link
                to="/meus-cards"
                aria-current={myCardsActive ? 'page' : undefined}
                className={navLinkClass(myCardsActive)}
              >
                Meus cards
              </Link>
            </li>
            {user?.role === 'admin' && (
              <li>
                <Link
                  to="/admin/membros"
                  aria-current={adminActive ? 'page' : undefined}
                  className={navLinkClass(adminActive)}
                >
                  Administração
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <NotificationsMenu />
          <ThemeSwitch />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
