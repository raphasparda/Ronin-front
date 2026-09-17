import { NavLink } from 'react-router';

import { UserMenu } from '../../features/auth/UserMenu';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { Logo } from './Logo';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `relative flex h-14 items-center px-1 no-underline ${
    isActive
      ? 'font-semibold text-text after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-accent'
      : 'font-medium text-muted hover:text-text'
  }`;
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface shadow-sm">
      <div className="flex h-14 items-center gap-6 px-4 md:px-6">
        <Logo asLink />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-5">
            <li>
              <NavLink to="/" end className={navLinkClass}>
                Quadros
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ThemeSwitch />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
