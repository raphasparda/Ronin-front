import {
  cardsCompletedByMarkingDoneList,
  findDoneList,
  matchesBoardFilter,
  PALETTE_LABELS,
  PRIORITY_LABELS,
  placementForPosition,
  sortByPosition,
  type BoardFilter,
  type BoardPayload,
  type CardSummary,
  type List,
  type PaletteColor,
} from '@raphasparda/ronin-shared';
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useMemo, useRef, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { ColorSwatchPicker } from '../../components/ui/ColorSwatchPicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Dialog } from '../../components/ui/Dialog';
import { toast } from '../../components/ui/toast-store';
import { useStableHandlers } from '../../lib/use-stable-handlers';
import { CARD_MESSAGES } from '../cards/card-messages';
import {
  buildCardOrder,
  moveAcrossLists,
  resolveCardDrop,
  type CardOrder,
  type DragTarget,
} from '../cards/card-drag';
import { useCardFaceData } from '../cards/card-face-data';
import { CardFaceOverlay, type CardFaceActions } from '../cards/CardFace';
import { useCreateCard, usePendingCardIds, useSetCardPriority } from '../cards/cards-api';
import { MoveCardDialog } from '../cards/MoveCardDialog';
import { useCardArchiving, useCardCompletionAction, useCardMover } from '../cards/use-card-actions';
import { AddListForm } from './AddListForm';
import { useBoardErrorHandler } from './board-errors';
import {
  useArchiveList,
  useCreateList,
  useMoveList,
  useRestoreList,
  useUpdateList,
} from './boards-api';
import { ListColumn, type ListColumnActions } from './ListColumn';

export const LIST_MESSAGES = {
  emptyName: 'O nome não pode ficar vazio.',
  createFailed: 'Não foi possível adicionar a lista. Tente de novo.',
  renameFailed: 'Não foi possível renomear a lista. Tente de novo.',
  colorFailed: 'Não foi possível trocar a cor da lista. Tente de novo.',
  doneFailed: 'Não foi possível alterar a lista de conclusão. Tente de novo.',
  moveFailed: 'Não foi possível mover a lista. Ela voltou para onde estava.',
  archiveFailed: 'Não foi possível arquivar a lista. Tente de novo.',
  moved: (name: string, position: number, total: number) =>
    `Lista ${name} movida para a posição ${position} de ${total}.`,
  colorChanged: (name: string, color: PaletteColor) =>
    `Cor da lista ${name} alterada para ${PALETTE_LABELS[color]}.`,
  markedDone: (name: string, previous: string | null, completed: number) =>
    [
      `${name} agora é a lista de conclusão.`,
      previous ? `${previous} deixou de ser.` : null,
      completed === 1
        ? '1 card foi concluído.'
        : completed > 1
          ? `${completed} cards foram concluídos.`
          : null,
    ]
      .filter(Boolean)
      .join(' '),
  unmarkedDone: (name: string) =>
    `${name} deixou de ser a lista de conclusão. Os cards dela continuam concluídos.`,
  archived: (name: string, wasDone: boolean) =>
    `Lista ${name} arquivada.${wasDone ? ' Ela deixou de ser a lista de conclusão.' : ''}`,
  restored: 'Lista restaurada no fim do quadro.',
} as const;

interface BoardListsProps {
  payload: BoardPayload;
  /** Filtro ativo: só os cards que passam aparecem (e o arraste usa os vizinhos visíveis). */
  filter: BoardFilter | null;
  readOnly: boolean;
  onDraggingChange: (dragging: boolean) => void;
  announce: (message: string) => void;
}

function cardCountLabel(count: number): string {
  return count === 1 ? '1 card' : `${count} cards`;
}

const NO_CARDS: readonly string[] = [];

/** Tempo em que o clique que encerra um arraste é ignorado (não abre o card). */
const CLICK_AFTER_DRAG_MS = 250;

const capitalize = (text: string) => `${text.charAt(0).toLocaleUpperCase('pt-BR')}${text.slice(1)}`;

const isCardDrag = (active: Active) => active.data.current?.type === 'card';

function dragTarget(over: Over | null): DragTarget | null {
  if (!over) return null;
  const data = over.data.current;
  if (data?.type === 'card') return { type: 'card', id: String(over.id) };
  if (data?.type === 'list-body') return { type: 'list-body', listId: String(data.listId) };
  return null;
}

/** Listas só colidem com listas; cards, com cards e corpos de lista (card sob o ponteiro primeiro). */
const collisionDetection: CollisionDetection = (args) => {
  if (!isCardDrag(args.active)) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === 'list',
      ),
    });
  }
  const droppableContainers = args.droppableContainers.filter(
    (container) => container.data.current?.type !== 'list',
  );
  const within = pointerWithin({ ...args, droppableContainers });
  if (within.length > 0) {
    const cards = within.filter(
      (collision) =>
        droppableContainers.find((container) => container.id === collision.id)?.data.current
          ?.type === 'card',
    );
    return cards.length > 0 ? cards : within;
  }
  return closestCorners({ ...args, droppableContainers });
};

export function BoardLists({
  payload,
  filter,
  readOnly,
  onDraggingChange,
  announce,
}: BoardListsProps) {
  const boardId = payload.board.id;
  const lists = useMemo(() => sortByPosition(payload.lists), [payload.lists]);
  const listIds = useMemo(() => lists.map((list) => list.id), [lists]);

  const handleError = useBoardErrorHandler(boardId);
  const createList = useCreateList(boardId);
  const updateList = useUpdateList(boardId);
  const moveList = useMoveList(boardId);
  const archiveList = useArchiveList(boardId);
  const restoreList = useRestoreList(boardId);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [colorListId, setColorListId] = useState<string | null>(null);
  const [confirmDone, setConfirmDone] = useState<{ list: List; count: number } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<{ list: List; count: number } | null>(null);

  const colorList = lists.find((list) => list.id === colorListId) ?? null;

  const createCard = useCreateCard(boardId);
  const mover = useCardMover(boardId);
  const archiving = useCardArchiving(boardId);
  const setPriority = useSetCardPriority(boardId);
  const completion = useCardCompletionAction();
  const { now } = useCardFaceData();
  const [movingCard, setMovingCard] = useState<CardSummary | null>(null);
  const [dragOrder, setDragOrder] = useState<CardOrder | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const dragStartOrder = useRef<CardOrder | null>(null);
  const lastDragEnd = useRef(0);

  const pendingCardIds = usePendingCardIds(boardId);

  const cardsById = useMemo(
    () => new Map(payload.cards.map((card) => [card.id, card])),
    [payload.cards],
  );
  const visibleCards = useMemo(() => {
    if (!filter) return payload.cards;
    return payload.cards.filter(
      (card) => pendingCardIds.has(card.id) || matchesBoardFilter(card, filter, now),
    );
  }, [filter, now, payload.cards, pendingCardIds]);
  const cardOrder = useMemo(
    () => dragOrder ?? buildCardOrder(lists, visibleCards),
    [dragOrder, lists, visibleCards],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) => lists.find((list) => list.id === id)?.name ?? '';
  const positionOf = (id: string | number) => listIds.indexOf(String(id)) + 1;
  const cardTitle = (id: string | number) => cardsById.get(String(id))?.title ?? '';
  const cardPlace = (id: string | number) => {
    const listId = Object.keys(cardOrder).find((key) => cardOrder[key]?.includes(String(id)));
    const ids = cardOrder[listId ?? ''] ?? [];
    return `posição ${ids.indexOf(String(id)) + 1} de ${ids.length} em ${nameOf(listId ?? '')}`;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      isCardDrag(active)
        ? `Card ${cardTitle(active.id)} pego. ${capitalize(cardPlace(active.id))}.`
        : `Lista ${nameOf(active.id)} pega. Posição ${positionOf(active.id)} de ${lists.length}.`,
    onDragOver: ({ active, over }) => {
      if (isCardDrag(active)) return `Card ${cardTitle(active.id)} na ${cardPlace(active.id)}.`;
      return over
        ? `Lista ${nameOf(active.id)} sobre a posição ${positionOf(over.id)} de ${lists.length}.`
        : `Lista ${nameOf(active.id)} fora da área das listas.`;
    },
    onDragEnd: ({ active, over }) => {
      if (isCardDrag(active))
        return `Card ${cardTitle(active.id)} solto na ${cardPlace(active.id)}.`;
      return over
        ? `Lista ${nameOf(active.id)} solta na posição ${positionOf(over.id)} de ${lists.length}.`
        : 'Movimento cancelado.';
    },
    onDragCancel: () => 'Movimento cancelado.',
  };

  const endCardDrag = () => {
    lastDragEnd.current = Date.now();
    dragStartOrder.current = null;
    setActiveCardId(null);
    setDragOrder(null);
    onDraggingChange(false);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    onDraggingChange(true);
    if (!isCardDrag(active)) return;
    const order = buildCardOrder(lists, visibleCards);
    dragStartOrder.current = order;
    setDragOrder(order);
    setActiveCardId(String(active.id));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const target = dragTarget(over);
    if (!isCardDrag(active) || !target) return;
    setDragOrder((order) => (order ? moveAcrossLists(order, String(active.id), target) : order));
  };

  const dropCard = (cardId: string, over: Over | null) => {
    const original = dragStartOrder.current;
    const card = cardsById.get(cardId);
    const drop =
      original && dragOrder && over
        ? resolveCardDrop(
            original,
            dragOrder,
            cardId,
            dragTarget(over),
            filter ? buildCardOrder(lists, payload.cards) : undefined,
            pendingCardIds,
          )
        : null;
    const list = drop ? lists.find((item) => item.id === drop.listId) : undefined;
    if (card && drop && list) {
      mover.move({
        card,
        toBoard: { id: boardId, name: payload.board.name },
        toList: { id: list.id, name: list.name },
        placement: drop.placement,
        position: drop.position,
        source: 'drag',
      });
    }
    endCardDrag();
  };

  const cardActions = useStableHandlers<CardFaceActions>({
    onMove: setMovingCard,
    onArchive: (card) =>
      archiving.archive({
        card,
        listName: lists.find((list) => list.id === card.listId)?.name ?? '',
      }),
    onPriority: (card, priority) => {
      announce(
        priority === null
          ? CARD_MESSAGES.priorityRemoved
          : CARD_MESSAGES.priorityChanged(PRIORITY_LABELS[priority]),
      );
      setPriority.mutate(
        { cardId: card.id, priority },
        { onError: (error) => handleError(error, CARD_MESSAGES.priorityFailed) },
      );
    },
    onToggleComplete: (card) => {
      const list = lists.find((item) => item.id === card.listId);
      completion.run({
        card,
        action: card.status === 'completed' ? 'reopen' : 'complete',
        list: list ? { name: list.name, isDoneList: list.isDoneList } : null,
        source: 'board',
        announce,
      });
    },
    isClickSuppressed: () => Date.now() - lastDragEnd.current < CLICK_AFTER_DRAG_MS,
  });

  const addCard = async (list: List, title: string) => {
    try {
      await createCard.mutateAsync({ listId: list.id, title, tempId: crypto.randomUUID() });
      announce(CARD_MESSAGES.created(list.name));
      return true;
    } catch (error) {
      handleError(error, CARD_MESSAGES.createFailed);
      return false;
    }
  };

  const activeCard = activeCardId ? cardsById.get(activeCardId) : undefined;
  const activeCardColor = lists.find((list) => list.id === activeCard?.listId)?.color ?? 'gray';

  const move = (list: List, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= lists.length) return;
    if (listIds[targetIndex] === list.id) return;
    const placement = placementForPosition(listIds, targetIndex + 1, list.id);
    announce(LIST_MESSAGES.moved(list.name, targetIndex + 1, lists.length));
    moveList.mutate(
      { listId: list.id, placement },
      { onError: (error) => handleError(error, LIST_MESSAGES.moveFailed) },
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (isCardDrag(active)) {
      dropCard(String(active.id), over);
      return;
    }
    onDraggingChange(false);
    if (!over || active.id === over.id) return;
    const list = lists.find((item) => item.id === active.id);
    if (list) move(list, listIds.indexOf(String(over.id)));
  };

  const applyDone = (list: List) => {
    const previous = findDoneList(lists);
    updateList.mutate(
      { listId: list.id, changes: { isDoneList: true } },
      {
        onSuccess: ({ completedCardIds }) => {
          setConfirmDone(null);
          toast.success(
            LIST_MESSAGES.markedDone(
              list.name,
              previous && previous.id !== list.id ? previous.name : null,
              completedCardIds.length,
            ),
          );
        },
        onError: (error) => {
          setConfirmDone(null);
          handleError(error, LIST_MESSAGES.doneFailed);
        },
      },
    );
  };

  const archive = (list: List) => {
    archiveList.mutate(list.id, {
      onSuccess: () => {
        setConfirmArchive(null);
        toast.success(LIST_MESSAGES.archived(list.name, list.isDoneList), {
          label: 'Desfazer',
          onClick: () =>
            restoreList.mutate(list.id, {
              onSuccess: () => toast.success(LIST_MESSAGES.restored),
              onError: (error) => handleError(error, LIST_MESSAGES.archiveFailed),
            }),
        });
      },
      onError: (error) => {
        setConfirmArchive(null);
        handleError(error, LIST_MESSAGES.archiveFailed);
      },
    });
  };

  const actions = useStableHandlers<ListColumnActions>({
    onStartRename: (list) => setRenamingId(list.id),
    onStopRename: () => setRenamingId(null),
    onEmptyName: () => toast.error(LIST_MESSAGES.emptyName),
    onRename: (list, name) => {
      setRenamingId(null);
      updateList.mutate(
        { listId: list.id, changes: { name } },
        { onError: (error) => handleError(error, LIST_MESSAGES.renameFailed) },
      );
    },
    onChangeColor: (list) => setColorListId(list.id),
    onToggleDone: (list) => {
      if (list.isDoneList) {
        updateList.mutate(
          { listId: list.id, changes: { isDoneList: false } },
          {
            onSuccess: () => toast.success(LIST_MESSAGES.unmarkedDone(list.name)),
            onError: (error) => handleError(error, LIST_MESSAGES.doneFailed),
          },
        );
        return;
      }
      const count = cardsCompletedByMarkingDoneList(payload.cards, list.id).length;
      if (count === 0) applyDone(list);
      else setConfirmDone({ list, count });
    },
    onMove: move,
    onArchive: (list) => {
      const count = payload.cards.filter((card) => card.listId === list.id).length;
      if (count === 0) archive(list);
      else setConfirmArchive({ list, count });
    },
  });
  const { addCard: onAddCard } = useStableHandlers({ addCard });

  const changeColor = (list: List, color: PaletteColor) => {
    if (color === list.color) return;
    announce(LIST_MESSAGES.colorChanged(list.name, color));
    updateList.mutate(
      { listId: list.id, changes: { color } },
      { onError: (error) => handleError(error, LIST_MESSAGES.colorFailed) },
    );
  };

  const addList = async (name: string, color: PaletteColor) => {
    try {
      await createList.mutateAsync({ name, color });
      announce(`Lista ${name} adicionada.`);
      return true;
    } catch (error) {
      handleError(error, LIST_MESSAGES.createFailed);
      return false;
    }
  };

  const currentDone = findDoneList(lists);
  const lastColor = lists.at(-1)?.color ?? null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'Para mover a lista, pressione Espaço ou Enter. Use as setas para a esquerda e para a direita e pressione Espaço ou Enter para soltar, ou Esc para cancelar. Para mover um card pelo teclado, use Mover para… no menu do card ou a tecla M.',
          },
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={() => {
          endCardDrag();
        }}
        onDragEnd={onDragEnd}
      >
        <div className="relative -mx-4 flex scroll-px-4 snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-4 sm:snap-none md:-mx-6 md:px-6">
          <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
            <ol aria-label="Listas do quadro" className="flex items-start gap-4">
              {lists.map((list, index) => (
                <li key={list.id} className="contents">
                  <ListColumn
                    list={list}
                    index={index}
                    total={lists.length}
                    cardCount={payload.cards.filter((card) => card.listId === list.id).length}
                    filtered={filter !== null}
                    cardIds={cardOrder[list.id] ?? NO_CARDS}
                    cardsById={cardsById}
                    pendingCardIds={pendingCardIds}
                    dropTarget={
                      activeCard !== undefined && (cardOrder[list.id] ?? []).includes(activeCard.id)
                    }
                    readOnly={readOnly}
                    renaming={renamingId === list.id}
                    actions={actions}
                    cardActions={cardActions}
                    onAddCard={onAddCard}
                  />
                </li>
              ))}
            </ol>
          </SortableContext>
          {!readOnly && (
            <AddListForm lastColor={lastColor} pending={createList.isPending} onAdd={addList} />
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard && <CardFaceOverlay card={activeCard} color={activeCardColor} />}
        </DragOverlay>
      </DndContext>

      <MoveCardDialog
        card={movingCard}
        source={payload}
        onMove={mover.move}
        onClose={() => setMovingCard(null)}
      />

      <Dialog
        open={colorList !== null}
        title={`Cor da lista ${colorList?.name ?? ''}`}
        onClose={() => setColorListId(null)}
        description={
          <p>A cor muda para toda a equipe na hora. O nome da lista continua visível.</p>
        }
        footer={<Button onClick={() => setColorListId(null)}>Concluir</Button>}
      >
        {colorList && (
          <ColorSwatchPicker
            label="Cor da lista"
            value={colorList.color}
            onChange={(color) => changeColor(colorList, color)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDone !== null}
        title={`Marcar "${confirmDone?.list.name ?? ''}" como lista de conclusão?`}
        description={
          confirmDone && (
            <>
              <p>
                {confirmDone.count === 1
                  ? 'O card aberto desta lista será marcado como concluído, com a conclusão registrada em seu nome.'
                  : `Os ${confirmDone.count} cards abertos desta lista serão marcados como concluídos, com a conclusão registrada em seu nome.`}
              </p>
              {currentDone && currentDone.id !== confirmDone.list.id && (
                <p>
                  A lista {currentDone.name} deixa de ser a lista de conclusão. Os cards que estão
                  nela continuam concluídos.
                </p>
              )}
              <p>
                A partir de agora, cards movidos para {confirmDone.list.name} são concluídos e não é
                possível criar card direto nela.
              </p>
            </>
          )
        }
        confirmLabel={`Marcar e concluir ${cardCountLabel(confirmDone?.count ?? 0)}`}
        pending={updateList.isPending}
        pendingLabel="Marcando…"
        onConfirm={() => confirmDone && applyDone(confirmDone.list)}
        onClose={() => setConfirmDone(null)}
      />

      <ConfirmDialog
        open={confirmArchive !== null}
        tone="danger"
        title={`Arquivar a lista "${confirmArchive?.list.name ?? ''}"?`}
        description={
          confirmArchive && (
            <>
              <p>
                {confirmArchive.count === 1
                  ? 'O card dela também sai do quadro.'
                  : `Os ${confirmArchive.count} cards dela também saem do quadro.`}{' '}
                Você pode restaurar tudo em Listas arquivadas.
              </p>
              {confirmArchive.list.isDoneList && <p>Ela deixa de ser a lista de conclusão.</p>}
            </>
          )
        }
        confirmLabel="Arquivar lista"
        pending={archiveList.isPending}
        pendingLabel="Arquivando…"
        onConfirm={() => confirmArchive && archive(confirmArchive.list)}
        onClose={() => setConfirmArchive(null)}
      />
    </>
  );
}
