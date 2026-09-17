import type { BoardCard, List } from '@raphasparda/ronin-shared';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleOff,
  GripVertical,
  MoreHorizontal,
  Palette,
  Pencil,
} from 'lucide-react';
import { memo, useId, useMemo } from 'react';

import { InlineEdit } from '../../components/ui/InlineEdit';
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import { AddCardForm } from '../cards/AddCardForm';
import { listBodyDroppableId } from '../cards/card-drag';
import { CardFace, LockedCardFace, type CardFaceActions } from '../cards/CardFace';

export const DONE_LIST_HELP = 'Cards movidos para cá são concluídos.';

export interface ListColumnActions {
  onRename: (list: List, name: string) => void;
  onStartRename: (list: List) => void;
  onStopRename: () => void;
  onEmptyName: () => void;
  onChangeColor: (list: List) => void;
  onToggleDone: (list: List) => void;
  onMove: (list: List, targetIndex: number) => void;
  onArchive: (list: List) => void;
}

interface ListColumnProps {
  list: List;
  index: number;
  total: number;
  cardCount: number;
  /** Filtro ativo: o contador vira "3 de 5" e a lista vazia explica o motivo. */
  filtered: boolean;
  /** Ids dos cards exibidos, na ordem (durante o arraste, a ordem provisória). */
  cardIds: readonly string[];
  cardsById: ReadonlyMap<string, BoardCard>;
  pendingCardIds: ReadonlySet<string>;
  /** A coluna recebe o card sendo arrastado: contorno na cor da lista. */
  dropTarget: boolean;
  readOnly: boolean;
  renaming: boolean;
  actions: ListColumnActions;
  cardActions: CardFaceActions;
  onAddCard: (list: List, title: string) => Promise<boolean>;
}

/** Memoizada: arrastar um card re-renderiza só as colunas cuja ordem mudou. Callbacks estáveis. */
export const ListColumn = memo(function ListColumn({
  list,
  index,
  total,
  cardCount,
  filtered,
  cardIds,
  cardsById,
  pendingCardIds,
  dropTarget,
  readOnly,
  renaming,
  actions,
  cardActions,
  onAddCard,
}: ListColumnProps) {
  const titleId = useId();
  const cards = useMemo(
    () => cardIds.flatMap((id) => cardsById.get(id) ?? []),
    [cardIds, cardsById],
  );
  const { setNodeRef: setBodyRef } = useDroppable({
    id: listBodyDroppableId(list.id),
    data: { type: 'list-body', listId: list.id },
    disabled: readOnly,
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id, data: { type: 'list' }, disabled: readOnly });

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={titleId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex w-[calc(100vw-3rem)] shrink-0 snap-start flex-col rounded-lg bg-surface-sunken sm:w-72 ${
        isDragging ? 'z-10 shadow-lg' : ''
      }`}
    >
      <header
        data-color={list.color}
        className="flex h-11 items-center gap-1 rounded-t-lg bg-(--c-bg) px-1.5 text-(--c-fg)"
      >
        {!readOnly && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Arrastar lista ${list.name}`}
            className="inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md hover:bg-(--c-fg)/15 active:cursor-grabbing"
          >
            <GripVertical aria-hidden size={16} />
          </button>
        )}
        {list.isDoneList && (
          <span title={DONE_LIST_HELP} className="inline-flex shrink-0 pl-1">
            <CircleCheck aria-hidden size={16} strokeWidth={2.5} />
          </span>
        )}
        {renaming ? (
          <>
            <h2 id={titleId} className="sr-only">
              {list.name}
            </h2>
            <InlineEdit
              value={list.name}
              label="Nome da lista"
              maxLength={100}
              className="flex-1"
              onSave={(name) => actions.onRename(list, name)}
              onCancel={actions.onStopRename}
              onEmpty={actions.onEmptyName}
            />
          </>
        ) : (
          <h2 id={titleId} className="min-w-0 flex-1 truncate px-1 text-sm font-bold">
            {list.name}
            {list.isDoneList && <span className="sr-only"> (lista de conclusão)</span>}
          </h2>
        )}
        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-(--c-fg) px-1.5 text-xs font-semibold whitespace-nowrap text-(--c-bg)">
          {filtered ? `${cards.length} de ${cardCount}` : cardCount}
          <span className="sr-only"> {cardCount === 1 ? 'card' : 'cards'}</span>
        </span>
        {!readOnly && (
          <Menu
            label={`Opções da lista ${list.name}`}
            trigger={<MoreHorizontal aria-hidden size={18} />}
            triggerClassName="inline-flex size-8 items-center justify-center rounded-md hover:bg-(--c-fg)/15"
          >
            <MenuItem icon={<Pencil size={16} />} onSelect={() => actions.onStartRename(list)}>
              Renomear
            </MenuItem>
            <MenuItem icon={<Palette size={16} />} onSelect={() => actions.onChangeColor(list)}>
              Cor da lista…
            </MenuItem>
            <MenuItem
              icon={list.isDoneList ? <CircleOff size={16} /> : <CircleCheck size={16} />}
              onSelect={() => actions.onToggleDone(list)}
            >
              {list.isDoneList ? 'Desmarcar lista de conclusão' : 'Marcar como lista de conclusão'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<ArrowLeft size={16} />}
              disabled={index === 0}
              onSelect={() => actions.onMove(list, index - 1)}
            >
              Mover lista para a esquerda
            </MenuItem>
            <MenuItem
              icon={<ArrowRight size={16} />}
              disabled={index === total - 1}
              onSelect={() => actions.onMove(list, index + 1)}
            >
              Mover lista para a direita
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Archive size={16} />}
              tone="danger"
              onSelect={() => actions.onArchive(list)}
            >
              Arquivar lista
            </MenuItem>
          </Menu>
        )}
      </header>

      <div
        ref={setBodyRef}
        style={dropTarget ? { outlineColor: `var(--palette-${list.color}-border)` } : undefined}
        className={`flex min-h-24 flex-col gap-2 rounded-b-lg p-3 ${
          dropTarget ? 'outline-2 -outline-offset-2' : ''
        }`}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length > 0 && (
            <ol aria-label={`Cards de ${list.name}`} className="flex flex-col gap-2">
              {cards.map((card) => (
                <li key={card.id}>
                  {card.locked ? (
                    <LockedCardFace card={card} color={list.color} />
                  ) : (
                    <CardFace
                      card={card}
                      color={list.color}
                      readOnly={readOnly}
                      pending={pendingCardIds.has(card.id)}
                      actions={cardActions}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </SortableContext>
        {filtered && cards.length === 0 && (
          <p className="text-xs text-muted">Nenhum card com estes filtros</p>
        )}
        {!readOnly && !list.isDoneList && (
          <AddCardForm listName={list.name} onAdd={(title) => onAddCard(list, title)} />
        )}
        {list.isDoneList && (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <CircleCheck aria-hidden size={14} className="mt-px shrink-0" />
            <span>
              <span className="font-semibold">Lista de conclusão.</span> Cards chegam aqui ao serem
              concluídos.
            </span>
          </p>
        )}
      </div>
    </section>
  );
});
