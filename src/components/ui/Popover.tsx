import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useAnchoredPosition } from './use-anchored-position';

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
  /** Chamado a cada abertura (ex.: limpar uma busca da abertura anterior). */
  onOpen?: () => void;
  children: ReactNode;
}

/**
 * Painel não modal preso a um botão (filtros, responsáveis): abre com o foco no primeiro controle,
 * Esc fecha e devolve o foco, clicar fora ou sair com Tab fecha. Abre abaixo ou acima do botão,
 * conforme o espaço, e acompanha a rolagem em vez de fechar.
 */
export function Popover({
  trigger,
  triggerLabel,
  triggerClassName = '',
  panelLabel,
  align = 'left',
  disabled = false,
  onOpen,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const position = useAnchoredPosition({
    open,
    anchorRef: buttonRef,
    panelRef,
    width: PANEL_WIDTH,
    align,
  });

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

    const closeIfOutside = (event: Event) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // No toque, o painel só fecha com um toque de verdade: arrastar para rolar a tela não fecha.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') closeIfOutside(event);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('click', closeIfOutside);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('click', closeIfOutside);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    onOpen?.();
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
          className="anim-pop-in fixed z-40 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-3 text-text shadow-md"
        >
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}
