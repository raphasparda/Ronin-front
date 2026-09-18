import { cardTitleSchema } from '@raphasparda/ronin-shared';
import { Plus, X } from 'lucide-react';
import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { Button } from '../../../../components/ui/Button';

interface AddCardFormProps {
  listName: string;
  /** `false` quando a criação falhou: o texto volta ao campo. */
  onAdd: (title: string) => Promise<boolean>;
}

/**
 * "+ Adicionar card" (screens §7.4): Enter cria no fim, limpa e mantém o foco; Esc fecha;
 * clicar fora só fecha se o campo estiver vazio.
 */
export function AddCardForm({ listName, onAdd }: AddCardFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldId = useId();
  const hintId = useId();

  const close = () => {
    setOpen(false);
    setTitle('');
    requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const parsed = cardTitleSchema.safeParse(title);
    if (!parsed.success) return;
    setTitle('');
    fieldRef.current?.focus();
    formRef.current?.scrollIntoView?.({ block: 'nearest' });
    const ok = await onAdd(parsed.data);
    if (!ok) setTitle((current) => (current === '' ? parsed.data : current));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (formRef.current?.contains(event.relatedTarget)) return;
    if (title.trim() === '') {
      setOpen(false);
      setTitle('');
    }
  };

  if (!open) {
    return (
      <Button
        ref={openButtonRef}
        variant="ghost"
        icon={<Plus size={16} />}
        className="w-full justify-start"
        onClick={() => setOpen(true)}
      >
        Adicionar card
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={`Adicionar card em ${listName}`}
      onSubmit={(event) => void submit(event)}
      onBlur={onBlur}
      className="anim-pop-in flex flex-col gap-2"
    >
      <label htmlFor={fieldId} className="sr-only">
        Título do card
      </label>
      <textarea
        ref={fieldRef}
        id={fieldId}
        autoFocus
        rows={3}
        maxLength={500}
        placeholder="Título do card"
        aria-describedby={hintId}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full resize-none rounded-lg border border-border-strong bg-surface p-2.5 text-md text-text shadow-sm md:text-sm"
      />
      <p id={hintId} className="text-xs text-muted">
        Enter adiciona · Esc fecha
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" size="md" disabled={title.trim() === ''}>
          Adicionar card
        </Button>
        <Button variant="ghost" aria-label="Fechar" icon={<X size={16} />} onClick={close} />
      </div>
    </form>
  );
}
