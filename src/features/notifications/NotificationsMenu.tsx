import type { Notification } from '@raphasparda/ronin-shared';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/toast-store';
import { NOTIFICATION_MESSAGES, NotificationList } from './NotificationList';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadCount,
} from './notifications-api';

/** Anúncio só quando o contador sobe (nunca na primeira leitura). */
function useArrivalAnnouncement(count: number | undefined): string {
  const previous = useRef<number | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (count === undefined) return;
    const before = previous.current;
    previous.current = count;
    if (before !== undefined && count > before) {
      setAnnouncement(NOTIFICATION_MESSAGES.arrived(count - before));
    }
  }, [count]);

  return announcement;
}

/**
 * Sino do cabeçalho (screens §10): contador com polling, popover de 380px no desktop e painel de
 * tela cheia no mobile. Esc, clicar fora ou sair com Tab fecham; o foco volta ao sino.
 */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const announcement = useArrivalAnnouncement(unread.data);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const count = unread.data ?? 0;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && !containerRef.current?.contains(next)) setOpen(false);
  };

  const openNotification = (notification: Notification) => {
    if (notification.readAt === null) markRead.mutate(notification.id);
    setOpen(false);
  };

  const markAllRead = () =>
    markAll.mutate(undefined, {
      onError: () => toast.error(NOTIFICATION_MESSAGES.markAllFailed),
    });

  return (
    <div ref={containerRef} className="md:relative" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={NOTIFICATION_MESSAGES.buttonLabel(count)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-9"
      >
        <Bell aria-hidden size={20} />
        {count > 0 && (
          <span
            aria-hidden
            data-status="overdue"
            className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-(--c-bg) px-1 text-[11px] leading-none font-bold text-(--c-fg) tabular-nums"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col bg-surface text-text outline-none md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:max-h-[70vh] md:w-[380px] md:rounded-xl md:border md:border-border md:shadow-md"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <h2 id={titleId} className="flex-1 text-md font-semibold">
              {NOTIFICATION_MESSAGES.title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              icon={<CheckCheck size={14} />}
              disabled={count === 0}
              onClick={markAllRead}
            >
              {NOTIFICATION_MESSAGES.markAll}
            </Button>
            <button
              type="button"
              aria-label="Fechar notificações"
              onClick={() => close(true)}
              className="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:hidden"
            >
              <X aria-hidden size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NotificationList onOpen={openNotification} />
          </div>
        </div>
      )}
    </div>
  );
}
