import {
  checklistItemTextSchema,
  checklistProgress,
  checklistTitleSchema,
  DEFAULT_CHECKLIST_TITLE,
  placementForPosition,
  sortByPosition,
  type CardDetail,
  type Checklist,
  type ChecklistItem,
} from '@kanban/shared';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutationState } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { InlineEdit } from '../../components/ui/InlineEdit';
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { toast } from '../../components/ui/toast-store';
import { useBoardErrorHandler } from '../boards/board-errors';
import {
  useCreateChecklist,
  useCreateChecklistItem,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useMoveChecklistItem,
  useRenameChecklist,
  useUpdateChecklistItem,
  type CreateItemVariables,
} from './checklists-api';

export const CHECKLIST_MESSAGES = {
  emptyTitle: 'O título não pode ficar vazio.',
  emptyItem: 'Escreva o item antes de adicionar.',
  createFailed: 'Não foi possível criar a checklist. Tente de novo.',
  renameFailed: 'Não foi possível renomear a checklist. Tente de novo.',
  deleteFailed: 'Não foi possível excluir a checklist. Tente de novo.',
  itemCreateFailed: 'Não foi possível adicionar o item. O texto continua no campo.',
  itemUpdateFailed: 'Não foi possível salvar o item. Tente de novo.',
  itemMoveFailed: 'Não foi possível mover o item. Ele voltou para onde estava.',
  itemDeleteFailed: 'Não foi possível excluir o item. Tente de novo.',
  itemMoved: (position: number, total: number) =>
    `Item movido para a posição ${position} de ${total}.`,
} as const;

const ICON_BUTTON =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8';

interface Context {
  cardId: string;
  boardId: string;
  readOnly: boolean;
  announce: (message: string) => void;
}

interface ItemRowProps {
  item: ChecklistItem;
  index: number;
  total: number;
  pending: boolean;
  ctx: Context;
  onMove: (item: ChecklistItem, position: number) => void;
}

function ItemRow({ item, index, total, pending, ctx, onMove }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateChecklistItem(ctx.cardId);
  const remove = useDeleteChecklistItem(ctx.cardId);
  const handleError = useBoardErrorHandler(ctx.boardId);
  const disabled = ctx.readOnly || pending;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const save = (text: string) => {
    setEditing(false);
    const parsed = checklistItemTextSchema.safeParse(text);
    if (!parsed.success) return;
    update.mutate(
      { checklistId: item.checklistId, itemId: item.id, changes: { text: parsed.data } },
      { onError: (error) => handleError(error, CHECKLIST_MESSAGES.itemUpdateFailed) },
    );
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex min-h-10 items-start gap-1 rounded-md bg-surface ${
        isDragging ? 'relative z-10 shadow-md' : ''
      }`}
    >
      {!disabled && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar item ${item.text}`}
          className={`${ICON_BUTTON} cursor-grab touch-none active:cursor-grabbing`}
        >
          <GripVertical aria-hidden size={16} />
        </button>
      )}
      <input
        type="checkbox"
        checked={item.isChecked}
        disabled={disabled}
        aria-label={item.text}
        onChange={(event) =>
          update.mutate(
            {
              checklistId: item.checklistId,
              itemId: item.id,
              changes: { isChecked: event.target.checked },
            },
            { onError: (error) => handleError(error, CHECKLIST_MESSAGES.itemUpdateFailed) },
          )
        }
        className="mt-3 size-4 shrink-0 accent-(--color-accent) md:mt-2"
      />
      <div className="min-w-0 flex-1 py-2 md:py-1.5">
        {editing ? (
          <InlineEdit
            value={item.text}
            label="Texto do item"
            maxLength={500}
            className="w-full"
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        ) : disabled ? (
          <span className={`break-words ${item.isChecked ? 'text-muted' : ''}`}>{item.text}</span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`w-full rounded-sm text-left break-words ${item.isChecked ? 'text-muted' : ''}`}
          >
            {item.text}
            <span className="sr-only"> (editar)</span>
          </button>
        )}
      </div>
      {!disabled && (
        <Menu
          label={`Opções do item ${item.text}`}
          trigger={<MoreHorizontal aria-hidden size={16} />}
          triggerClassName={`${ICON_BUTTON} md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100`}
        >
          <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditing(true)}>
            Editar
          </MenuItem>
          <MenuItem
            icon={<ArrowUp size={16} />}
            disabled={index === 0}
            onSelect={() => onMove(item, index)}
          >
            Mover para cima
          </MenuItem>
          <MenuItem
            icon={<ArrowDown size={16} />}
            disabled={index === total - 1}
            onSelect={() => onMove(item, index + 2)}
          >
            Mover para baixo
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 size={16} />}
            tone="danger"
            onSelect={() =>
              remove.mutate(
                { checklistId: item.checklistId, itemId: item.id },
                { onError: (error) => handleError(error, CHECKLIST_MESSAGES.itemDeleteFailed) },
              )
            }
          >
            Excluir item
          </MenuItem>
        </Menu>
      )}
    </li>
  );
}

function AddItemForm({ checklist, ctx }: { checklist: Checklist; ctx: Context }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const create = useCreateChecklistItem(ctx.cardId);
  const handleError = useBoardErrorHandler(ctx.boardId);

  const close = () => {
    setOpen(false);
    setText('');
    setError(undefined);
    requestAnimationFrame(() => openRef.current?.focus());
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const parsed = checklistItemTextSchema.safeParse(text.replace(/\r?\n/g, ' '));
    if (!parsed.success) {
      setError(CHECKLIST_MESSAGES.emptyItem);
      return;
    }
    setText('');
    fieldRef.current?.focus();
    try {
      await create.mutateAsync({
        checklistId: checklist.id,
        text: parsed.data,
        tempId: crypto.randomUUID(),
      });
    } catch (mutationError) {
      setText((current) => (current === '' ? parsed.data : current));
      handleError(mutationError, CHECKLIST_MESSAGES.itemCreateFailed);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  if (!open) {
    return (
      <Button
        ref={openRef}
        variant="ghost"
        size="sm"
        icon={<Plus size={16} />}
        className="self-start"
        aria-label={`Adicionar item em ${checklist.title}`}
        onClick={() => setOpen(true)}
      >
        Adicionar item
      </Button>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
      <textarea
        ref={fieldRef}
        autoFocus
        rows={2}
        maxLength={500}
        value={text}
        aria-label={`Novo item em ${checklist.title}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="Novo item"
        onChange={(event) => {
          setText(event.target.value);
          setError(undefined);
        }}
        onKeyDown={onKeyDown}
        className="field-sizing-content min-h-10 w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-md text-text md:text-sm"
      />
      {error && (
        <p id={errorId} className="text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Adicionar
        </Button>
        <button type="button" aria-label="Fechar" onClick={close} className={ICON_BUTTON}>
          <X aria-hidden size={16} />
        </button>
        <span className="text-xs text-muted">Enter adiciona · Esc fecha</span>
      </div>
    </form>
  );
}

function ChecklistBlock({ checklist, ctx }: { checklist: Checklist; ctx: Context }) {
  const titleId = useId();
  const [renaming, setRenaming] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rename = useRenameChecklist(ctx.cardId);
  const remove = useDeleteChecklist(ctx.cardId);
  const move = useMoveChecklistItem(ctx.cardId);
  const handleError = useBoardErrorHandler(ctx.boardId);

  const pendingIds = new Set(
    useMutationState({
      filters: { mutationKey: ['checklists', ctx.cardId], status: 'pending' },
      select: (mutation) => (mutation.state.variables as Partial<CreateItemVariables>).tempId,
    }).filter((id): id is string => id !== undefined),
  );

  const items = sortByPosition(checklist.items);
  const ids = items.map((item) => item.id);
  const { done, total } = checklistProgress([checklist]);
  const shown = hideChecked ? items.filter((item) => !item.isChecked) : items;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveTo = (item: ChecklistItem, position: number) => {
    if (position < 1 || position > items.length) return;
    if (ids.indexOf(item.id) + 1 === position) return;
    ctx.announce(CHECKLIST_MESSAGES.itemMoved(position, items.length));
    move.mutate(
      {
        checklistId: checklist.id,
        itemId: item.id,
        placement: placementForPosition(ids, position, item.id),
      },
      { onError: (error) => handleError(error, CHECKLIST_MESSAGES.itemMoveFailed) },
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const item = items.find((entry) => entry.id === active.id);
    if (item) moveTo(item, ids.indexOf(String(over.id)) + 1);
  };

  const textOf = (id: string | number) => items.find((item) => item.id === id)?.text ?? '';
  const positionOf = (id: string | number) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Item ${textOf(active.id)} pego. Posição ${positionOf(active.id)} de ${items.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Item ${textOf(active.id)} sobre a posição ${positionOf(over.id)} de ${items.length}.`
        : `Item ${textOf(active.id)} fora da lista.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Item ${textOf(active.id)} solto na posição ${positionOf(over.id)} de ${items.length}.`
        : 'Movimento cancelado.',
    onDragCancel: () => 'Movimento cancelado.',
  };

  const saveTitle = (title: string) => {
    setRenaming(false);
    const parsed = checklistTitleSchema.safeParse(title);
    if (!parsed.success) return;
    rename.mutate(
      { checklistId: checklist.id, title: parsed.data },
      { onError: (error) => handleError(error, CHECKLIST_MESSAGES.renameFailed) },
    );
  };

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ListChecks aria-hidden size={18} className="shrink-0 text-muted" />
        {renaming ? (
          <>
            <h4 id={titleId} className="sr-only">
              {checklist.title}
            </h4>
            <InlineEdit
              value={checklist.title}
              label="Título da checklist"
              maxLength={200}
              className="flex-1 font-semibold"
              onSave={saveTitle}
              onCancel={() => setRenaming(false)}
              onEmpty={() => toast.error(CHECKLIST_MESSAGES.emptyTitle)}
            />
          </>
        ) : (
          <h4 id={titleId} className="min-w-0 flex-1 font-semibold break-words">
            {checklist.title}
          </h4>
        )}
        {!ctx.readOnly && (
          <Menu
            label={`Opções da checklist ${checklist.title}`}
            trigger={<MoreHorizontal aria-hidden size={16} />}
            triggerClassName={ICON_BUTTON}
          >
            <MenuItem icon={<Pencil size={16} />} onSelect={() => setRenaming(true)}>
              Renomear
            </MenuItem>
            <MenuItem
              icon={hideChecked ? <Eye size={16} /> : <EyeOff size={16} />}
              onSelect={() => setHideChecked((hide) => !hide)}
            >
              {hideChecked ? 'Mostrar itens marcados' : 'Ocultar itens marcados'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 size={16} />}
              tone="danger"
              onSelect={() => setConfirmDelete(true)}
            >
              Excluir checklist
            </MenuItem>
          </Menu>
        )}
      </div>

      <ProgressBar done={done} total={total} label={`Progresso de ${checklist.title}`} />

      {shown.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'Para mover o item, pressione Espaço ou Enter, use as setas para cima e para baixo e pressione Espaço ou Enter para soltar, ou Esc para cancelar. Também dá para usar Mover para cima e Mover para baixo no menu do item.',
            },
          }}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={shown.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol aria-label={`Itens de ${checklist.title}`} className="flex flex-col">
              {shown.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={ids.indexOf(item.id)}
                  total={items.length}
                  pending={pendingIds.has(item.id)}
                  ctx={ctx}
                  onMove={moveTo}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      {hideChecked && done > 0 && (
        <p className="text-xs text-muted">
          {done === 1 ? '1 item marcado oculto.' : `${done} itens marcados ocultos.`}
        </p>
      )}

      {!ctx.readOnly && <AddItemForm checklist={checklist} ctx={ctx} />}

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title={
          total === 0
            ? `Excluir a checklist "${checklist.title}"?`
            : `Excluir a checklist "${checklist.title}" e ${total === 1 ? 'o item' : `os ${total} itens`}?`
        }
        description={<p>Não dá para desfazer.</p>}
        confirmLabel="Excluir checklist"
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate(checklist.id, {
            onError: (error) => handleError(error, CHECKLIST_MESSAGES.deleteFailed),
          });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  );
}

function AddChecklistForm({ ctx }: { ctx: Context }) {
  const [title, setTitle] = useState<string | null>(null);
  const create = useCreateChecklist(ctx.cardId);
  const handleError = useBoardErrorHandler(ctx.boardId);
  const fieldId = useId();

  if (title === null) {
    return (
      <Button
        variant="secondary"
        size="sm"
        icon={<Plus size={16} />}
        className="self-start"
        onClick={() => setTitle(DEFAULT_CHECKLIST_TITLE)}
      >
        Adicionar checklist
      </Button>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = checklistTitleSchema.safeParse(title);
    if (!parsed.success) {
      toast.error(CHECKLIST_MESSAGES.emptyTitle);
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: () => setTitle(null),
      onError: (error) => handleError(error, CHECKLIST_MESSAGES.createFailed),
    });
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setTitle(null);
        }
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor={fieldId} className="font-medium">
        Título da checklist
      </label>
      <input
        id={fieldId}
        autoFocus
        value={title}
        maxLength={200}
        onFocus={(event) => event.target.select()}
        onChange={(event) => setTitle(event.target.value)}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-md text-text md:h-9 md:text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={create.isPending} loadingText="Criando…">
          Criar checklist
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setTitle(null)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

interface CardChecklistsProps {
  card: CardDetail;
  readOnly: boolean;
  announce: (message: string) => void;
}

/** Checklists do card (screens §8.8). Marcar itens não conclui o card nem gera histórico. */
export function CardChecklists({ card, readOnly, announce }: CardChecklistsProps) {
  const ctx: Context = { cardId: card.id, boardId: card.boardId, readOnly, announce };

  return (
    <div className="flex flex-col gap-6">
      {card.checklists.map((checklist) => (
        <ChecklistBlock key={checklist.id} checklist={checklist} ctx={ctx} />
      ))}
      {!readOnly && <AddChecklistForm ctx={ctx} />}
    </div>
  );
}
