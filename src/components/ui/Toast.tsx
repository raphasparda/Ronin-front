import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  TOAST_DURATION_MS,
  getToasts,
  subscribeToasts,
  toast,
  type ToastItem,
  type ToastTone,
} from './toast-store';

const TONE_STYLES: Record<ToastTone, { bar: string; icon: LucideIcon; iconClass: string }> = {
  success: { bar: 'border-l-(--status-done-bg)', icon: CircleCheck, iconClass: 'text-success' },
  error: { bar: 'border-l-(--status-overdue-bg)', icon: CircleAlert, iconClass: 'text-danger' },
  info: { bar: 'border-l-accent', icon: Info, iconClass: 'text-accent-text' },
};

function ToastView({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const { bar, icon: Icon, iconClass } = TONE_STYLES[item.tone];
  const isError = item.tone === 'error';

  useEffect(() => {
    if (isError || paused) return;
    const timer = window.setTimeout(() => toast.dismiss(item.id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isError, paused, item.id]);

  return (
    <li
      role={isError ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-l-4 border-border bg-surface p-3 text-text shadow-md ${bar}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon aria-hidden size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
      <p className="min-w-0 flex-1">{item.message}</p>
      {item.action && (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 font-semibold text-accent-text hover:bg-hover"
          onClick={() => {
            item.action?.onClick();
            toast.dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar aviso"
        className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text"
        onClick={() => toast.dismiss(item.id)}
      >
        <X aria-hidden size={16} />
      </button>
    </li>
  );
}

export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);

  return (
    <section
      aria-label="Avisos"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <ol className="flex w-full flex-col gap-2 sm:w-90">
        {items.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </ol>
    </section>
  );
}
