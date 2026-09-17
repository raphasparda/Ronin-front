import {
  placementForPosition,
  sortByPosition,
  type CardSummary,
  type List,
  type Placement,
} from '@kanban/shared';
import { arrayMove } from '@dnd-kit/sortable';

/** Ids dos cards por lista, na ordem exibida. */
export type CardOrder = Record<string, string[]>;

export type DragTarget = { type: 'card'; id: string } | { type: 'list-body'; listId: string };

export const listBodyDroppableId = (listId: string) => `lista:${listId}`;

export function buildCardOrder(lists: readonly List[], cards: readonly CardSummary[]): CardOrder {
  const order: CardOrder = Object.fromEntries(lists.map((list) => [list.id, [] as string[]]));
  for (const card of sortByPosition(cards)) order[card.listId]?.push(card.id);
  return order;
}

export function listOfCard(order: CardOrder, cardId: string): string | undefined {
  return Object.keys(order).find((listId) => order[listId]?.includes(cardId));
}

function targetListId(order: CardOrder, target: DragTarget): string | undefined {
  return target.type === 'card' ? listOfCard(order, target.id) : target.listId;
}

/** Durante o arraste: ao passar para outra lista, o card entra no lugar do card apontado. */
export function moveAcrossLists(order: CardOrder, cardId: string, target: DragTarget): CardOrder {
  const from = listOfCard(order, cardId);
  const to = targetListId(order, target);
  if (!from || !to || from === to) return order;

  const destination = (order[to] ?? []).filter((id) => id !== cardId);
  const overIndex = target.type === 'card' ? destination.indexOf(target.id) : -1;
  const index = overIndex === -1 ? destination.length : overIndex;
  destination.splice(index, 0, cardId);

  return {
    ...order,
    [from]: (order[from] ?? []).filter((id) => id !== cardId),
    [to]: destination,
  };
}

export interface CardDrop {
  listId: string;
  /** Posição 1-based no destino. */
  position: number;
  placement: Placement;
}

/**
 * Com filtro ativo (screens §7.5), o card fica **entre os vizinhos visíveis**: logo depois do
 * visível anterior; sem anterior, logo antes do próximo visível (depois do card oculto que o
 * precede, ou no início). `fullIds` é a ordem completa da lista de destino.
 */
export function placementAmongVisible(
  fullIds: readonly string[],
  visibleIds: readonly string[],
  cardId: string,
): Placement {
  const index = visibleIds.indexOf(cardId);
  const previous = index > 0 ? visibleIds[index - 1] : undefined;
  if (previous !== undefined) return { type: 'after', id: previous };
  const next = visibleIds[index + 1];
  if (next === undefined) return { type: 'end' };
  const siblings = fullIds.filter((id) => id !== cardId);
  const before = siblings[siblings.indexOf(next) - 1];
  return before === undefined ? { type: 'start' } : { type: 'after', id: before };
}

const NO_PENDING: ReadonlySet<string> = new Set();

/**
 * Ao soltar: resolve lista e posição finais e converte em `placement`.
 * `null` quando o card voltou para o mesmo lugar (nada a enviar).
 * `fullOrder` (com filtro ativo) é a ordem completa das listas: `original` e `current` têm só os
 * cards visíveis, e o `placement` usa os vizinhos visíveis.
 * `pendingIds` são cards ainda sendo criados (id temporário): o servidor não os conhece, então
 * nunca servem de vizinho no `placement` (a posição exibida continua contando com eles).
 */
export function resolveCardDrop(
  original: CardOrder,
  current: CardOrder,
  cardId: string,
  target: DragTarget | null,
  fullOrder?: CardOrder,
  pendingIds: ReadonlySet<string> = NO_PENDING,
): CardDrop | null {
  const listId = listOfCard(current, cardId);
  if (!listId) return null;
  let ids = current[listId] ?? [];
  if (target?.type === 'card' && target.id !== cardId && ids.includes(target.id)) {
    ids = arrayMove(ids, ids.indexOf(cardId), ids.indexOf(target.id));
  }

  const position = ids.indexOf(cardId) + 1;
  const originalList = listOfCard(original, cardId);
  const originalPosition = (original[originalList ?? ''] ?? []).indexOf(cardId) + 1;
  if (originalList === listId && originalPosition === position) return null;

  const known = (list: readonly string[]) => list.filter((id) => !pendingIds.has(id));
  const knownIds = known(ids);
  const placement = fullOrder
    ? placementAmongVisible(known(fullOrder[listId] ?? []), knownIds, cardId)
    : placementForPosition(knownIds, knownIds.indexOf(cardId) + 1, cardId);
  return { listId, position, placement };
}
