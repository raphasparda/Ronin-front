import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

const VIEWPORT_MARGIN = 16;
const PANEL_WIDTH = 288;
const FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface PopoverProps {
  /** Conteúdo visual do botão. */
  trigger: ReactNode;
  /** Nome acessível do botão, quando o conteúdo visual não basta. */
  triggerLabel?: string;
  triggerClassName?: string;
  /** Nome acessível do painel. */
  panelLabel: string;
  align?: 'left' | 'right';
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Painel não modal preso a um botão (filtros): abre com o foco no primeiro controle, Esc fecha e
 * devolve o foco, clicar fora ou sair com Tab fecha.
 */
export function Popover({
  trigger,
  triggerLabel,
  triggerClassName = '',
  panelLabel,
  align = 'left',
  disabled = false,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

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
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN);
      const preferred = align === 'right' ? rect.right - width : rect.left;
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(VIEWPORT_MARGIN, Math.min(preferred, maxLeft)),
      });
    }
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && !containerRef.current?.contains(next)) setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        onClick={toggle}
        className={`disabled:cursor-not-allowed ${triggerClassName}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={panelLabel}
          style={position ?? undefined}
          className="fixed z-40 max-h-[calc(100dvh-8rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-surface p-3 text-text shadow-md"
        >
          {children}
        </div>
      )}
    </div>
  );
}
