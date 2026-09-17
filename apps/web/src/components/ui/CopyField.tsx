import { Check, Copy } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { copyText } from '../../lib/clipboard';
import { Button } from './Button';

export const COPY_MESSAGES = {
  copied: 'Link copiado.',
  failed: 'Não foi possível copiar. Selecione o link e copie manualmente.',
} as const;

const COPIED_VISIBLE_MS = 2000;

export interface CopyFieldProps {
  label: string;
  value: string;
}

/**
 * Link exibido uma única vez: campo somente leitura + "Copiar link". O resultado da cópia é
 * anunciado numa região `aria-live` ("Link copiado." ou a instrução de copiar manualmente).
 */
export function CopyField({ label, value }: CopyFieldProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = window.setTimeout(() => setStatus('idle'), COPIED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    const ok = await copyText(value);
    setStatus(ok ? 'copied' : 'failed');
    if (!ok) inputRef.current?.select();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={inputId}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-md border border-border-strong bg-surface-sunken px-3 font-mono text-[13px] text-text md:h-9"
        />
        <Button
          variant="secondary"
          icon={status === 'copied' ? <Check size={16} /> : <Copy size={16} />}
          onClick={() => void copy()}
        >
          {status === 'copied' ? 'Copiado' : 'Copiar link'}
        </Button>
      </div>
      <p aria-live="polite" className={status === 'failed' ? 'text-danger' : 'sr-only'}>
        {status === 'copied'
          ? COPY_MESSAGES.copied
          : status === 'failed'
            ? COPY_MESSAGES.failed
            : ''}
      </p>
    </div>
  );
}
