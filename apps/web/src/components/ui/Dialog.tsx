import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  return root
    ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex !== -1)
    : [];
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  /** Elemento que recebe o foco ao abrir (padrão: o próprio painel). */
  getInitialFocus?: () => HTMLElement | null | undefined;
  className: string;
  children: ReactNode;
}

/**
 * Base dos diálogos: portal, fundo, foco preso, Esc fecha e o foco volta ao elemento que abriu.
 * Quem usa define o layout do painel por `className`.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  getInitialFocus,
  className,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRef = useRef(getInitialFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRef.current = getInitialFocus;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const target = initialFocusRef.current?.() ?? panelRef.current;
    target?.focus();

    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(panelRef.current);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (!panelRef.current?.contains(active)) return;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex h-full w-full flex-col bg-surface text-text shadow-lg outline-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl sm:border sm:border-border ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Elemento que recebe o foco ao abrir (padrão: primeiro focável do conteúdo). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: 'sm' | 'md';
}

/**
 * Diálogo modal: foco preso, Esc fecha e o foco volta ao elemento que o abriu.
 * Abaixo de 640px ocupa a tela inteira (design-system §6).
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  description,
  footer,
  initialFocusRef,
  size = 'sm',
}: DialogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      getInitialFocus={() => initialFocusRef?.current ?? focusables(bodyRef.current)[0]}
      className={size === 'md' ? 'sm:max-w-xl' : 'sm:max-w-md'}
    >
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="-m-1 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8"
        >
          <X aria-hidden size={18} />
        </button>
      </div>
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {description && (
          <div id={descriptionId} className="flex flex-col gap-2 text-text">
            {description}
          </div>
        )}
        {children}
      </div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </Modal>
  );
}
