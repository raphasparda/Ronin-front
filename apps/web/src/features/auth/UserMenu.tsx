import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, LogOut } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { Avatar } from '../../components/ui/Avatar';
import { setupStatusQueryKey, useLogout, useSession } from './auth-api';

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
}

export function UserMenu() {
  const session = useSession({ enabled: false }).data;
  const logout = useLogout();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last'>('first');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;
    const items = menuItems(menuRef.current);
    (focusOnOpen === 'last' ? items.at(-1) : items[0])?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, focusOnOpen]);

  if (!session) return null;
  const { user } = session;

  const openMenu = (focus: 'first' | 'last') => {
    setFocusOnOpen(focus);
    setOpen(true);
  };

  const closeMenu = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(menuRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) =>
      items[((next % items.length) + items.length) % items.length]?.focus();

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(-1);
    }
  };

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

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-label={`Menu da conta de ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu('first'))}
        onKeyDown={onButtonKeyDown}
        className="inline-flex size-10 items-center justify-center rounded-full hover:bg-hover md:size-9"
      >
        <Avatar id={user.id} name={user.name} />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-1 shadow-md">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar id={user.id} name={user.name} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-text">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <hr className="my-1 border-border" />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={buttonId}
            onKeyDown={onMenuKeyDown}
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={logout.isPending || undefined}
              onClick={signOut}
              className="focus-inset flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-text hover:bg-hover md:h-8"
            >
              {logout.isPending ? (
                <LoaderCircle aria-hidden size={16} className="animate-spin" />
              ) : (
                <LogOut aria-hidden size={16} />
              )}
              {logout.isPending ? 'Saindo…' : 'Sair'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
