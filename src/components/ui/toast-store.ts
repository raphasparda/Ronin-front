export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

export const MAX_TOASTS = 3;
export const TOAST_DURATION_MS = 5000;

type Listener = () => void;

let items: readonly ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function setItems(next: readonly ToastItem[]) {
  items = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): readonly ToastItem[] {
  return items;
}

function show(tone: ToastTone, message: string, action?: ToastAction): number {
  const duplicate = items.find((item) => item.tone === tone && item.message === message);
  if (duplicate) return duplicate.id;

  const item: ToastItem = { id: nextId++, tone, message, action };
  setItems([...items, item].slice(-MAX_TOASTS));
  return item.id;
}

/** Toasts globais: podem ser disparados fora do React (ex.: tratamento de erro do QueryClient). */
export const toast = {
  success: (message: string, action?: ToastAction) => show('success', message, action),
  error: (message: string, action?: ToastAction) => show('error', message, action),
  info: (message: string, action?: ToastAction) => show('info', message, action),
  dismiss: (id: number) => setItems(items.filter((item) => item.id !== id)),
  clear: () => setItems([]),
};
