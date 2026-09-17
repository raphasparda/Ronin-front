import { listNameSchema, nextPaletteColor, type PaletteColor } from '@raphasparda/ronin-shared';
import { Plus, X } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '../../components/ui/Button';
import { ColorSwatchPicker } from '../../components/ui/ColorSwatchPicker';
import { Input } from '../../components/ui/Input';

export const ADD_LIST_MESSAGES = {
  empty: 'Dê um nome à lista.',
  tooLong: 'O nome da lista pode ter no máximo 100 caracteres.',
} as const;

interface AddListFormProps {
  lastColor: PaletteColor | null;
  pending: boolean;
  onAdd: (name: string, color: PaletteColor) => Promise<boolean>;
}

/** "+ Adicionar lista": nome + cor (próxima do ciclo pré-selecionada); fica aberto para a próxima. */
export function AddListForm({ lastColor, pending, onAdd }: AddListFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [chosenColor, setChosenColor] = useState<PaletteColor | null>(null);
  const [error, setError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const color = chosenColor ?? nextPaletteColor(lastColor);

  const close = () => {
    setOpen(false);
    setName('');
    setError(undefined);
    setChosenColor(null);
    requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = listNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.code === 'too_big'
          ? ADD_LIST_MESSAGES.tooLong
          : ADD_LIST_MESSAGES.empty,
      );
      inputRef.current?.focus();
      return;
    }
    const ok = await onAdd(parsed.data, color);
    if (ok) {
      setName('');
      setChosenColor(null);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  if (!open) {
    return (
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-[calc(100vw-3rem)] shrink-0 snap-start items-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-surface-sunken px-3 font-medium text-text hover:bg-hover sm:w-72"
      >
        <Plus aria-hidden size={16} />
        Adicionar lista
      </button>
    );
  }

  return (
    <form
      noValidate
      aria-label="Adicionar lista"
      onSubmit={(event) => void submit(event)}
      onKeyDown={onKeyDown}
      className="flex w-[calc(100vw-3rem)] shrink-0 snap-start flex-col gap-3 rounded-lg border-2 border-dashed border-border-strong bg-surface-sunken p-3 sm:w-72"
    >
      <Input
        ref={inputRef}
        autoFocus
        label="Nome da lista"
        maxLength={100}
        autoComplete="off"
        value={name}
        error={error}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
      />
      <div className="flex flex-col gap-1.5">
        <span aria-hidden className="font-medium">
          Cor
        </span>
        <ColorSwatchPicker
          label="Cor da nova lista"
          size="sm"
          value={color}
          onChange={setChosenColor}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" loading={pending} loadingText="Adicionando…">
          Adicionar
        </Button>
        <Button variant="ghost" aria-label="Fechar" icon={<X size={16} />} onClick={close} />
      </div>
    </form>
  );
}
