import { Check } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';

interface MenuContextValue {
  close: (restoreFocus: boolean) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error('Item de menu fora de <Menu>.');
  return context;
}

const MENU_WIDTH = 256;
const VIEWPORT_MARGIN = 16;

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu
    ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'))
    : [];
}

export interface MenuProps {
  /** Nome acessível do botão (ex.: "Opções da lista A fazer"). */
  label: string;
  /** Conteúdo visual do botão. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Conteúdo acima dos itens, fora do `role="menu"` (ex.: nome e e-mail). */
  header?: ReactNode;
  align?: 'left' | 'right';
  disabled?: boolean;
  children: ReactNode;
}

/** Botão de menu (padrão ARIA menu button): setas, Home/End, Esc devolve o foco. */
export function Menu({
  label,
  trigger,
  triggerClassName = '',
  header,
  align = 'right',
  disabled = false,
  children,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last'>('first');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;
    const items = menuItems(menuRef.current).filter(
      (item) => item.getAttribute('aria-disabled') !== 'true',
    );
    (focusOnOpen === 'last' ? items.at(-1) : items[0])?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onViewportChange = (event: Event) => {
      if (event.type === 'scroll' && containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, focusOnOpen]);

  const openMenu = (focus: 'first' | 'last') => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(MENU_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN);
      const preferred = align === 'right' ? rect.right - width : rect.left;
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(VIEWPORT_MARGIN, Math.min(preferred, maxLeft)),
      });
    }
    setFocusOnOpen(focus);
    setOpen(true);
  };

  const close = (restoreFocus: boolean) => {
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
      event.stopPropagation();
      close(true);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onButtonKeyDown}
        className={`disabled:cursor-not-allowed ${triggerClassName}`}
      >
        {trigger}
      </button>

      {open && (
        <div
          style={position ? { top: position.top, left: position.left } : undefined}
          className="fixed z-40 max-h-[calc(100dvh-5rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-surface p-1 text-text shadow-md"
        >
          {header}
          <MenuContext value={{ close }}>
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-labelledby={buttonId}
              onKeyDown={onMenuKeyDown}
            >
              {children}
            </div>
          </MenuContext>
        </div>
      )}
    </div>
  );
}

const ITEM_CLASS =
  'focus-inset flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 text-left no-underline hover:bg-hover md:min-h-8';

export interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Motivo exibido abaixo do texto quando o item está desabilitado. */
  hint?: string;
  /** Item de escolha única (`menuitemradio`): marca a opção atual com um check. */
  checked?: boolean;
}

export function MenuItem({
  onSelect,
  children,
  icon,
  tone = 'default',
  disabled = false,
  hint,
  checked,
}: MenuItemProps) {
  const { close } = useMenuContext();
  const hintId = useId();

  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      aria-describedby={hint ? hintId : undefined}
      onClick={() => {
        if (disabled) return;
        close(true);
        onSelect();
      }}
      className={`${ITEM_CLASS} ${
        disabled ? 'cursor-not-allowed text-muted' : tone === 'danger' ? 'text-danger' : 'text-text'
      }`}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col py-1.5">
        <span>{children}</span>
        {hint && (
          <span id={hintId} className="text-xs text-muted">
            {hint}
          </span>
        )}
      </span>
      {checked && <Check aria-hidden size={16} className="ml-auto shrink-0" />}
    </button>
  );
}

export function MenuLink({
  to,
  children,
  icon,
}: {
  to: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const { close } = useMenuContext();

  return (
    <Link
      to={to}
      role="menuitem"
      tabIndex={-1}
      onClick={() => close(false)}
      className={`${ITEM_CLASS} text-text`}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-border" />;
}

export function MenuGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" className="px-2.5 pt-2 pb-1 text-xs font-semibold text-muted">
      {children}
    </div>
  );
}
