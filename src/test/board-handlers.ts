import {
  activitiesResponseSchema,
  applyPlacement,
  archivedCardSchema,
  boardArchivedResponseSchema,
  boardCoverUploadUrlRequestSchema,
  boardCoverUploadUrlResponseSchema,
  boardPayloadSchema,
  boardResponseSchema,
  boardsResponseSchema,
  boardViewersResponseSchema,
  canAccessBoard,
  confirmBoardCoverRequestSchema,
  isBoardCoverKey,
  lockedBoardSchema,
  updateBoardVisibilityRequestSchema,
  cardDetailResponseSchema,
  cardMutationResultSchema,
  cardSummaryResponseSchema,
  cardAssigneesResponseSchema,
  cardLabelsResponseSchema,
  cardSummarySchema,
  checklistItemResponseSchema,
  checklistProgress,
  checklistResponseSchema,
  commentResponseSchema,
  comparePriority,
  completeTargetListId,
  completionChangeOnMove,
  createChecklistItemRequestSchema,
  createChecklistRequestSchema,
  createCommentRequestSchema,
  createLabelRequestSchema,
  labelResponseSchema,
  moveChecklistItemRequestSchema,
  updateChecklistItemRequestSchema,
  updateChecklistRequestSchema,
  updateCommentRequestSchema,
  updateLabelRequestSchema,
  createBoardRequestSchema,
  createBoardResponseSchema,
  createCardRequestSchema,
  createListRequestSchema,
  DEFAULT_BOARD_LISTS,
  deleteBoardRequestSchema,
  listResponseSchema,
  moveCardRequestSchema,
  moveListRequestSchema,
  myCardsResponseSchema,
  nextPaletteColor,
  reopenTargetListId,
  updateCardRequestSchema,
  sortByPosition,
  updateBoardRequestSchema,
  updateListRequestSchema,
  updateListResponseSchema,
  usersResponseSchema,
  type Activity,
  type ActivityEntry,
  type AuthSessionResponse,
  type BoardDetail,
  type CardSummary,
  type Checklist,
  type Comment,
  type Label,
  type List,
} from '@raphasparda/ronin-shared';
import {
  board as boardFixture,
  cardSummary,
  ID,
  T0,
} from '@raphasparda/ronin-shared/test-fixtures';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { randomUUID } from 'node:crypto';
import { http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw';
import type { z } from 'zod';

import { dueInputToIso } from '../lib/due';
import { adminDb, MEMBER_ID, type RecordedRequest } from './admin-handlers';
import { apiErrorResponse, sessionFixture } from './auth-handlers';

export const BOARD_ID = ID.board;
export const ARCHIVED_BOARD_ID = ID.board2;
export const OTHER_BOARD_ID = '8f5a3b4c-6d7e-4f8a-9b0c-2d3e4f5a6b7c';
/** Quadro restrito do seed: só a Ana (e Admins) enxergam (ADR 0015). */
export const RESTRICTED_BOARD_ID = '9e6b4c5d-7e8f-4a9b-8c0d-3e4f5a6b7c8d';
export const OTHER_LIST_IDS = {
  backlog: '4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d',
  delivered: '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e',
} as const;
export const CARD_IDS = {
  budget: '11111111-1111-4111-8111-111111111111',
  campaign: '22222222-2222-4222-8222-222222222222',
  report: '33333333-3333-4333-8333-333333333333',
} as const;
export const LABEL_ID = ID.label;
export const LIST_IDS = {
  todo: ID.list,
  doing: ID.list2,
  done: '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f',
} as const;

/** Card no "banco": face + campos do detalhe. */
export type CardRecord = CardSummary & {
  description: string;
  completedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** Quadro no "banco": o quadro aberto, a lista de acesso e quem criou (ADR 0015). */
export type BoardRecord = BoardDetail & { createdBy: string };

interface BoardDb {
  boards: BoardRecord[];
  lists: List[];
  cards: CardRecord[];
  labels: Label[];
  checklists: Checklist[];
  comments: Comment[];
  activities: Activity[];
  /** Chaves de objeto já enviadas ao "R2" (ADR 0016): só elas podem ser confirmadas. */
  storage: Set<string>;
  requests: RecordedRequest[];
}

const position = (index: number) => `p${String(index).padStart(4, '0')}`;
const ACTOR_ID = sessionFixture.user.id;

function seedCard(id: string, listId: string, title: string, key: string): CardRecord {
  return {
    ...cardSummary,
    id,
    listId,
    title,
    position: key,
    dueAt: null,
    labelIds: [],
    assigneeIds: [],
    priority: null,
    checklist: { done: 0, total: 0 },
    commentCount: 0,
    hasDescription: false,
    description: '',
    completedBy: null,
    createdBy: ACTOR_ID,
    createdAt: T0,
    updatedAt: T0,
  };
}

/** Quadro do seed: visível para a equipe e sem capa (a capa entra no teste que a envia). */
function seedBoard(id: string, name: string, changes: Partial<BoardRecord> = {}): BoardRecord {
  return {
    ...boardFixture,
    id,
    name,
    locked: false,
    visibility: 'team',
    cover: null,
    viewerIds: [],
    createdBy: ACTOR_ID,
    archivedAt: null,
    ...changes,
  };
}

function seed(): BoardDb {
  const [k0, k1, k2] = generateNKeysBetween(null, null, 3) as [string, string, string];
  return {
    boards: [
      seedBoard(BOARD_ID, 'Marketing'),
      seedBoard(ARCHIVED_BOARD_ID, 'Antigo', { archivedAt: T0 }),
      seedBoard(OTHER_BOARD_ID, 'Vendas'),
      // Quadro restrito à Ana (Admin): o Member Bruno o vê com cadeado na lista.
      seedBoard(RESTRICTED_BOARD_ID, 'Diretoria', {
        visibility: 'restricted',
        viewerIds: [ACTOR_ID],
      }),
    ],
    lists: [
      {
        id: LIST_IDS.todo,
        boardId: BOARD_ID,
        name: 'A fazer',
        position: position(0),
        isDoneList: false,
        color: 'blue',
        archivedAt: null,
      },
      {
        id: LIST_IDS.doing,
        boardId: BOARD_ID,
        name: 'Fazendo',
        position: position(1),
        isDoneList: false,
        color: 'orange',
        archivedAt: null,
      },
      {
        id: LIST_IDS.done,
        boardId: BOARD_ID,
        name: 'Concluído',
        position: position(2),
        isDoneList: true,
        color: 'green',
        archivedAt: null,
      },
      {
        id: randomUUID(),
        boardId: ARCHIVED_BOARD_ID,
        name: 'Backlog',
        position: position(0),
        isDoneList: false,
        color: 'gray',
        archivedAt: null,
      },
      {
        id: OTHER_LIST_IDS.backlog,
        boardId: OTHER_BOARD_ID,
        name: 'Backlog',
        position: position(0),
        isDoneList: false,
        color: 'purple',
        archivedAt: null,
      },
      {
        id: OTHER_LIST_IDS.delivered,
        boardId: OTHER_BOARD_ID,
        name: 'Entregue',
        position: position(1),
        isDoneList: true,
        color: 'green',
        archivedAt: null,
      },
    ],
    cards: [
      {
        ...seedCard(CARD_IDS.budget, LIST_IDS.doing, 'Revisar orçamento', k0),
        labelIds: [LABEL_ID],
      },
      {
        ...seedCard(CARD_IDS.campaign, LIST_IDS.doing, 'Publicar campanha', k1),
        description: 'Lançar **segunda-feira**.',
        hasDescription: true,
      },
      {
        ...seedCard(CARD_IDS.report, LIST_IDS.doing, 'Fechar relatório', k2),
        status: 'completed',
        completedAt: T0,
        completedBy: ACTOR_ID,
      },
    ],
    labels: [{ id: LABEL_ID, boardId: BOARD_ID, name: 'Financeiro', color: 'green' }],
    checklists: [],
    comments: [],
    activities: [],
    storage: new Set<string>(),
    requests: [],
  };
}

export let boardDb: BoardDb = seed();

export function resetBoardDb(): void {
  boardDb = seed();
  mockActor.id = sessionFixture.user.id;
  mockActor.role = 'admin';
  coverStorage.enabled = true;
}

export function boardRequests(path: string): RecordedRequest[] {
  return boardDb.requests.filter((item) => item.path === path);
}

async function readBody(request: StrictRequest<DefaultBodyType>, path: string): Promise<unknown> {
  const text = await request.text();
  const body: unknown = text === '' ? undefined : JSON.parse(text);
  boardDb.requests.push({ method: request.method, path, body });
  return body;
}

function validationError(error: z.ZodError) {
  return apiErrorResponse('VALIDATION_ERROR', {
    message: 'Dados inválidos.',
    details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

const now = () => new Date().toISOString();

/** Quem está logado no mock (o `me` padrão): muda nos testes de permissão e de quadro restrito. */
export const mockActor = { id: sessionFixture.user.id, role: 'admin' as 'admin' | 'member' };

/** Sessão do Member Bruno Lima (sem acesso implícito a quadro restrito). */
export const memberSession: AuthSessionResponse = {
  ...sessionFixture,
  user: { id: MEMBER_ID, name: 'Bruno Lima', email: 'bruno@empresa.com', role: 'member' },
};

/** Faz o mock responder como o Member Bruno Lima (use junto com `authHandlers.me(memberSession)`). */
export function signInAsMember(): void {
  mockActor.id = MEMBER_ID;
  mockActor.role = 'member';
}

/** R2 simulado (ADR 0016): `enabled: false` = instância sem capa (`features.boardCovers: false`). */
export const coverStorage = { enabled: true };
export const R2_ORIGIN = 'https://capas.exemplo';

/** Acesso ao quadro (ADR 0015): `team`, Admin ou estar na lista de acesso. */
function canOpenBoard(board: BoardRecord): boolean {
  return canAccessBoard(board, { id: mockActor.id, role: mockActor.role });
}

/** Quadro restrito para quem não tem acesso: só `{ id, name, locked }`. */
const lockedBoard = (board: BoardRecord) => lockedBoardSchema.parse({ ...board, locked: true });

const boardRestricted = () =>
  apiErrorResponse('BOARD_RESTRICTED', { message: 'Você não tem acesso a este quadro.' });

/** Dá uma capa já enviada ao quadro (para os testes de trocar e remover). */
export function seedBoardCover(boardId: string, { width = 1600, height = 900 } = {}): string {
  const objectKey = `covers/${boardId}/${randomUUID().replaceAll('-', '').slice(0, 32)}`;
  boardDb.storage.add(objectKey);
  setBoard(boardId, {
    cover: {
      url: `${R2_ORIGIN}/${objectKey}?X-Amz-Signature=leitura`,
      width,
      height,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    },
  });
  return objectKey;
}

function activeLists(boardId: string): List[] {
  return sortByPosition(
    boardDb.lists.filter((list) => list.boardId === boardId && !list.archivedAt),
  );
}

/** Reescreve as posições das listas ativas na ordem dada. */
function resequence(order: readonly string[]) {
  boardDb.lists = boardDb.lists.map((list) => {
    const index = order.indexOf(list.id);
    return index === -1 ? list : { ...list, position: position(index) };
  });
}

function findBoard(boardId: unknown) {
  return boardDb.boards.find((board) => board.id === boardId);
}

function findList(listId: unknown) {
  return boardDb.lists.find((list) => list.id === listId);
}

function updateList(listId: string, changes: Partial<List>): List {
  let updated: List | undefined;
  boardDb.lists = boardDb.lists.map((list) => {
    if (list.id !== listId) return list;
    updated = { ...list, ...changes };
    return updated;
  });
  return updated as List;
}

function setBoard(boardId: string, changes: Partial<BoardRecord>): BoardRecord {
  let updated: BoardRecord | undefined;
  boardDb.boards = boardDb.boards.map((board) => {
    if (board.id !== boardId) return board;
    updated = { ...board, ...changes, updatedAt: now() };
    return updated;
  });
  return updated as BoardRecord;
}

// ---------------------------------------------------------------------------
// Cards e atividade (api.md §11): mesmas regras de estado do contrato
// ---------------------------------------------------------------------------

function findCard(cardId: unknown): CardRecord | undefined {
  return boardDb.cards.find((card) => card.id === cardId);
}

function activeCards(listId: string): CardRecord[] {
  return sortByPosition(boardDb.cards.filter((card) => card.listId === listId && !card.archivedAt));
}

function updateCard(cardId: string, changes: Partial<CardRecord>): CardRecord {
  let updated: CardRecord | undefined;
  boardDb.cards = boardDb.cards.map((card) => {
    if (card.id !== cardId) return card;
    updated = { ...card, ...changes, updatedAt: now() };
    return updated;
  });
  return updated as CardRecord;
}

function record(cardId: string, entry: ActivityEntry) {
  boardDb.activities.push({
    id: randomUUID(),
    cardId,
    actorId: ACTOR_ID,
    createdAt: new Date(Date.now() + boardDb.activities.length).toISOString(),
    ...entry,
  });
}

/** Registra atividades direto no "banco" (para testes do histórico). */
export function seedActivities(
  cardId: string,
  entries: readonly ActivityEntry[],
  actorId = ACTOR_ID,
) {
  for (const entry of entries) {
    record(cardId, entry);
    const last = boardDb.activities.at(-1);
    if (last) last.actorId = actorId;
  }
}

/** Agregados da face calculados como no backend: soma dos checklists e contagem de comentários. */
function withAggregates<T extends CardRecord>(card: T): T {
  return {
    ...card,
    checklist: checklistProgress(boardDb.checklists.filter((item) => item.cardId === card.id)),
    commentCount: boardDb.comments.filter((item) => item.cardId === card.id).length,
  };
}

const summary = (card: CardRecord) => cardSummarySchema.parse(withAggregates(card));

function detail(card: CardRecord) {
  const board = findBoard(card.boardId);
  const list = findList(card.listId);
  return cardDetailResponseSchema.parse({
    card: {
      ...withAggregates(card),
      hasDescription: card.description !== '',
      board: { id: card.boardId, name: board?.name ?? '', archived: Boolean(board?.archivedAt) },
      list: {
        id: card.listId,
        name: list?.name ?? '',
        color: list?.color ?? 'gray',
        isDoneList: list?.isDoneList ?? false,
        archived: Boolean(list?.archivedAt),
      },
      checklists: boardDb.checklists
        .filter((item) => item.cardId === card.id)
        .map((item) => ({ ...item, items: sortByPosition(item.items) })),
      comments: boardDb.comments
        .filter((item) => item.cardId === card.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    },
  });
}

const completed = () => ({
  status: 'completed' as const,
  completedAt: now(),
  completedBy: ACTOR_ID,
});
const reopened = () => ({ status: 'open' as const, completedAt: null, completedBy: null });

// ---------------------------------------------------------------------------
// Responsáveis, etiquetas, checklists e comentários (api.md §11 a §14)
// ---------------------------------------------------------------------------

function writableCard(cardId: unknown) {
  const card = findCard(cardId);
  if (!card) return { error: apiErrorResponse('NOT_FOUND') } as const;
  if (findBoard(card.boardId)?.archivedAt) {
    return { error: apiErrorResponse('BOARD_ARCHIVED') } as const;
  }
  return { card } as const;
}

function findChecklist(checklistId: unknown) {
  return boardDb.checklists.find((item) => item.id === checklistId);
}

function findItem(itemId: unknown) {
  for (const checklist of boardDb.checklists) {
    const item = checklist.items.find((current) => current.id === itemId);
    if (item) return { checklist, item };
  }
  return undefined;
}

function setChecklist(checklistId: string, update: (checklist: Checklist) => Checklist): Checklist {
  let updated: Checklist | undefined;
  boardDb.checklists = boardDb.checklists.map((checklist) => {
    if (checklist.id !== checklistId) return checklist;
    updated = update(checklist);
    return updated;
  });
  return updated as Checklist;
}

const checklistResponse = (checklist: Checklist) =>
  checklistResponseSchema.parse({
    checklist: { ...checklist, items: sortByPosition(checklist.items) },
  });

const assigneeHandlers = [
  http.put('/api/cards/:cardId/assignees/:userId', async ({ request, params }) => {
    await readBody(request, 'cards/assignees/add');
    const found = writableCard(params.cardId);
    if (found.error) return found.error;
    const user = adminDb.users.find((item) => item.id === params.userId);
    if (!user) return apiErrorResponse('NOT_FOUND');
    if (user.status !== 'active') {
      return apiErrorResponse('USER_NOT_ACTIVE', { message: 'Usuário desativado.' });
    }
    let { assigneeIds } = found.card;
    if (!assigneeIds.includes(user.id)) {
      assigneeIds = [...assigneeIds, user.id];
      updateCard(found.card.id, { assigneeIds });
      record(found.card.id, { type: 'card_assignee_added', data: { userId: user.id } });
    }
    return HttpResponse.json(cardAssigneesResponseSchema.parse({ assigneeIds }));
  }),

  http.delete('/api/cards/:cardId/assignees/:userId', async ({ request, params }) => {
    await readBody(request, 'cards/assignees/remove');
    const found = writableCard(params.cardId);
    if (found.error) return found.error;
    let { assigneeIds } = found.card;
    const userId = String(params.userId);
    if (assigneeIds.includes(userId)) {
      assigneeIds = assigneeIds.filter((id) => id !== userId);
      updateCard(found.card.id, { assigneeIds });
      record(found.card.id, { type: 'card_assignee_removed', data: { userId } });
    }
    return HttpResponse.json(cardAssigneesResponseSchema.parse({ assigneeIds }));
  }),
];

const labelHandlers = [
  http.put('/api/cards/:cardId/labels/:labelId', async ({ request, params }) => {
    await readBody(request, 'cards/labels/add');
    const found = writableCard(params.cardId);
    if (found.error) return found.error;
    const label = boardDb.labels.find((item) => item.id === params.labelId);
    if (!label) return apiErrorResponse('NOT_FOUND');
    if (label.boardId !== found.card.boardId) return apiErrorResponse('LABEL_BOARD_MISMATCH');
    const ids = new Set([...found.card.labelIds, label.id]);
    const labelIds = boardDb.labels
      .filter((item) => ids.has(item.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((item) => item.id);
    updateCard(found.card.id, { labelIds });
    return HttpResponse.json(cardLabelsResponseSchema.parse({ labelIds }));
  }),

  http.delete('/api/cards/:cardId/labels/:labelId', async ({ request, params }) => {
    await readBody(request, 'cards/labels/remove');
    const found = writableCard(params.cardId);
    if (found.error) return found.error;
    const labelIds = found.card.labelIds.filter((id) => id !== params.labelId);
    updateCard(found.card.id, { labelIds });
    return HttpResponse.json(cardLabelsResponseSchema.parse({ labelIds }));
  }),

  http.patch('/api/labels/:labelId', async ({ request, params }) => {
    const parsed = updateLabelRequestSchema.safeParse(await readBody(request, 'labels/update'));
    if (!parsed.success) return validationError(parsed.error);
    const label = boardDb.labels.find((item) => item.id === params.labelId);
    if (!label) return apiErrorResponse('NOT_FOUND');
    if (findBoard(label.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    const updated: Label = { ...label, ...parsed.data };
    boardDb.labels = boardDb.labels.map((item) => (item.id === label.id ? updated : item));
    return HttpResponse.json(labelResponseSchema.parse({ label: updated }));
  }),

  http.delete('/api/labels/:labelId', async ({ request, params }) => {
    await readBody(request, 'labels/delete');
    const label = boardDb.labels.find((item) => item.id === params.labelId);
    if (!label) return apiErrorResponse('NOT_FOUND');
    if (findBoard(label.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    boardDb.labels = boardDb.labels.filter((item) => item.id !== label.id);
    boardDb.cards = boardDb.cards.map((card) => ({
      ...card,
      labelIds: card.labelIds.filter((id) => id !== label.id),
    }));
    return new HttpResponse(null, { status: 204 });
  }),
];

const checklistHandlers = [
  http.post('/api/cards/:cardId/checklists', async ({ request, params }) => {
    const parsed = createChecklistRequestSchema.safeParse(
      await readBody(request, 'checklists/create'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const found = writableCard(params.cardId);
    if (found.error) return found.error;
    const checklist: Checklist = {
      id: randomUUID(),
      cardId: found.card.id,
      title: parsed.data.title,
      createdAt: now(),
      items: [],
    };
    boardDb.checklists.push(checklist);
    return HttpResponse.json(checklistResponse(checklist), { status: 201 });
  }),

  http.patch('/api/checklists/:checklistId', async ({ request, params }) => {
    const parsed = updateChecklistRequestSchema.safeParse(
      await readBody(request, 'checklists/update'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const checklist = findChecklist(params.checklistId);
    if (!checklist) return apiErrorResponse('NOT_FOUND');
    const found = writableCard(checklist.cardId);
    if (found.error) return found.error;
    const updated = setChecklist(checklist.id, (item) => ({ ...item, title: parsed.data.title }));
    return HttpResponse.json(checklistResponse(updated));
  }),

  http.delete('/api/checklists/:checklistId', async ({ request, params }) => {
    await readBody(request, 'checklists/delete');
    const checklist = findChecklist(params.checklistId);
    if (!checklist) return apiErrorResponse('NOT_FOUND');
    const found = writableCard(checklist.cardId);
    if (found.error) return found.error;
    boardDb.checklists = boardDb.checklists.filter((item) => item.id !== checklist.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/checklists/:checklistId/items', async ({ request, params }) => {
    const parsed = createChecklistItemRequestSchema.safeParse(
      await readBody(request, 'checklist-items/create'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const checklist = findChecklist(params.checklistId);
    if (!checklist) return apiErrorResponse('NOT_FOUND');
    const found = writableCard(checklist.cardId);
    if (found.error) return found.error;
    const last = sortByPosition(checklist.items).at(-1)?.position ?? null;
    const item = {
      id: randomUUID(),
      checklistId: checklist.id,
      text: parsed.data.text,
      position: generateKeyBetween(last, null),
      isChecked: false,
      checkedBy: null,
      checkedAt: null,
    };
    setChecklist(checklist.id, (current) => ({ ...current, items: [...current.items, item] }));
    return HttpResponse.json(checklistItemResponseSchema.parse({ item }), { status: 201 });
  }),

  http.patch('/api/checklist-items/:itemId', async ({ request, params }) => {
    const parsed = updateChecklistItemRequestSchema.safeParse(
      await readBody(request, 'checklist-items/update'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const found = findItem(params.itemId);
    if (!found) return apiErrorResponse('NOT_FOUND');
    const card = writableCard(found.checklist.cardId);
    if (card.error) return card.error;
    const { text, isChecked } = parsed.data;
    const item = {
      ...found.item,
      ...(text !== undefined && { text }),
      ...(isChecked !== undefined && {
        isChecked,
        checkedBy: isChecked ? mockActor.id : null,
        checkedAt: isChecked ? now() : null,
      }),
    };
    setChecklist(found.checklist.id, (current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === item.id ? item : entry)),
    }));
    return HttpResponse.json(checklistItemResponseSchema.parse({ item }));
  }),

  http.post('/api/checklist-items/:itemId/move', async ({ request, params }) => {
    const parsed = moveChecklistItemRequestSchema.safeParse(
      await readBody(request, 'checklist-items/move'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const found = findItem(params.itemId);
    if (!found) return apiErrorResponse('NOT_FOUND');
    const card = writableCard(found.checklist.cardId);
    if (card.error) return card.error;
    const siblings = sortByPosition(found.checklist.items).filter(
      (entry) => entry.id !== found.item.id,
    );
    const order = applyPlacement(
      siblings.map((entry) => entry.id),
      found.item.id,
      parsed.data.placement,
    );
    if (order === null) return apiErrorResponse('INVALID_PLACEMENT');
    const index = order.indexOf(found.item.id);
    const item = {
      ...found.item,
      position: generateKeyBetween(
        siblings[index - 1]?.position ?? null,
        siblings[index]?.position ?? null,
      ),
    };
    setChecklist(found.checklist.id, (current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === item.id ? item : entry)),
    }));
    return HttpResponse.json(checklistItemResponseSchema.parse({ item }));
  }),

  http.delete('/api/checklist-items/:itemId', async ({ request, params }) => {
    await readBody(request, 'checklist-items/delete');
    const found = findItem(params.itemId);
    if (!found) return apiErrorResponse('NOT_FOUND');
    const card = writableCard(found.checklist.cardId);
    if (card.error) return card.error;
    setChecklist(found.checklist.id, (current) => ({
      ...current,
      items: current.items.filter((entry) => entry.id !== found.item.id),
    }));
    return new HttpResponse(null, { status: 204 });
  }),
];

const commentHandlers = [
  http.post('/api/cards/:cardId/comments', async ({ request, params }) => {
    const parsed = createCommentRequestSchema.safeParse(await readBody(request, 'comments/create'));
    if (!parsed.success) return validationError(parsed.error);
    const found = writableCard(params.cardId);
    if (found.error) return found.error;
    const comment: Comment = {
      id: randomUUID(),
      cardId: found.card.id,
      authorId: mockActor.id,
      body: parsed.data.body,
      editedAt: null,
      createdAt: new Date(Date.now() + boardDb.comments.length).toISOString(),
    };
    boardDb.comments.push(comment);
    return HttpResponse.json(commentResponseSchema.parse({ comment }), { status: 201 });
  }),

  http.patch('/api/comments/:commentId', async ({ request, params }) => {
    const parsed = updateCommentRequestSchema.safeParse(await readBody(request, 'comments/update'));
    if (!parsed.success) return validationError(parsed.error);
    const comment = boardDb.comments.find((item) => item.id === params.commentId);
    if (!comment) return apiErrorResponse('NOT_FOUND');
    if (comment.authorId !== mockActor.id) return apiErrorResponse('FORBIDDEN');
    const found = writableCard(comment.cardId);
    if (found.error) return found.error;
    const updated: Comment = { ...comment, body: parsed.data.body, editedAt: now() };
    boardDb.comments = boardDb.comments.map((item) => (item.id === comment.id ? updated : item));
    return HttpResponse.json(commentResponseSchema.parse({ comment: updated }));
  }),

  http.delete('/api/comments/:commentId', async ({ request, params }) => {
    await readBody(request, 'comments/delete');
    const comment = boardDb.comments.find((item) => item.id === params.commentId);
    if (!comment) return apiErrorResponse('NOT_FOUND');
    if (comment.authorId !== mockActor.id && mockActor.role !== 'admin') {
      return apiErrorResponse('FORBIDDEN');
    }
    const found = writableCard(comment.cardId);
    if (found.error) return found.error;
    boardDb.comments = boardDb.comments.filter((item) => item.id !== comment.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

function recordMove(card: CardRecord, toListId: string) {
  const from = findList(card.listId);
  const to = findList(toListId);
  const boardName = findBoard(card.boardId)?.name ?? '';
  record(card.id, {
    type: 'card_moved',
    data: {
      fromListId: card.listId,
      fromListName: from?.name ?? '',
      toListId,
      toListName: to?.name ?? '',
      fromBoardId: card.boardId,
      fromBoardName: boardName,
      toBoardId: card.boardId,
      toBoardName: boardName,
    },
  });
}

/**
 * `complete` e `reopen` (api.md §11): concluir leva ao **fim** da lista de conclusão; reabrir,
 * a partir dela, leva ao **topo** da primeira lista ativa não-conclusão. No-op se já no estado.
 */
function changeCompletion(card: CardRecord, action: 'complete' | 'reopen') {
  const lists = boardDb.lists.filter((list) => list.boardId === card.boardId);
  const alreadyDone = (action === 'complete') === (card.status === 'completed');
  if (alreadyDone) {
    return cardMutationResultSchema.parse({
      card: summary(card),
      completionChange: null,
      removedLabelIds: [],
    });
  }
  const targetListId =
    action === 'complete' ? completeTargetListId(card, lists) : reopenTargetListId(card, lists);
  let position = card.position;
  if (targetListId !== null) {
    const siblings = activeCards(targetListId);
    position =
      action === 'complete'
        ? generateKeyBetween(siblings.at(-1)?.position ?? null, null)
        : generateKeyBetween(null, siblings[0]?.position ?? null);
    recordMove(card, targetListId);
  }
  const updated = updateCard(card.id, {
    listId: targetListId ?? card.listId,
    position,
    ...(action === 'complete' ? completed() : reopened()),
  });
  record(card.id, { type: action === 'complete' ? 'card_completed' : 'card_reopened', data: {} });
  return cardMutationResultSchema.parse({
    card: summary(updated),
    completionChange: action === 'complete' ? 'completed' : 'reopened',
    removedLabelIds: [],
  });
}

/** `GET /api/me/cards` (api.md §6): abertos, ativos, atribuídos a quem está logado, na ordem D1. */
function myCards() {
  const cards = boardDb.cards
    .filter((card) => {
      const list = findList(card.listId);
      return (
        card.assigneeIds.includes(mockActor.id) &&
        card.status === 'open' &&
        !card.archivedAt &&
        list !== undefined &&
        !list.archivedAt &&
        !findBoard(card.boardId)?.archivedAt
      );
    })
    .sort((a, b) => {
      if (a.dueAt !== b.dueAt) {
        if (a.dueAt === null) return 1;
        if (b.dueAt === null) return -1;
        return a.dueAt.localeCompare(b.dueAt);
      }
      return comparePriority(a.priority, b.priority) || a.createdAt.localeCompare(b.createdAt);
    })
    .map((card) => {
      const list = findList(card.listId);
      return {
        ...summary(card),
        boardName: findBoard(card.boardId)?.name ?? '',
        listName: list?.name ?? '',
        listColor: list?.color ?? 'gray',
      };
    });
  return myCardsResponseSchema.parse({ cards });
}

const cardHandlers = [
  http.get('/api/me/cards', () => HttpResponse.json(myCards())),

  http.get('/api/users', () =>
    HttpResponse.json(usersResponseSchema.parse({ users: adminDb.users })),
  ),

  http.post('/api/lists/:listId/cards', async ({ request, params }) => {
    const parsed = createCardRequestSchema.safeParse(await readBody(request, 'cards/create'));
    if (!parsed.success) return validationError(parsed.error);
    const list = findList(params.listId);
    if (!list) return apiErrorResponse('NOT_FOUND');
    if (findBoard(list.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    if (list.archivedAt) return apiErrorResponse('LIST_ARCHIVED');
    if (list.isDoneList) return apiErrorResponse('LIST_IS_DONE_LIST');
    const last = activeCards(list.id).at(-1)?.position ?? null;
    const card: CardRecord = {
      id: randomUUID(),
      boardId: list.boardId,
      listId: list.id,
      title: parsed.data.title,
      position: generateKeyBetween(last, null),
      status: 'open',
      completedAt: null,
      dueAt: null,
      dueHasTime: false,
      priority: null,
      labelIds: [],
      assigneeIds: [],
      checklist: { done: 0, total: 0 },
      commentCount: 0,
      hasDescription: false,
      archivedAt: null,
      description: '',
      completedBy: null,
      createdBy: ACTOR_ID,
      createdAt: now(),
      updatedAt: now(),
    };
    boardDb.cards.push(card);
    record(card.id, { type: 'card_created', data: { listId: list.id, listName: list.name } });
    return HttpResponse.json(cardSummaryResponseSchema.parse({ card }), { status: 201 });
  }),

  http.get('/api/cards/:cardId', ({ params }) => {
    const card = findCard(params.cardId);
    if (!card) return apiErrorResponse('NOT_FOUND', { message: 'Card não encontrado.' });
    return HttpResponse.json(detail(card));
  }),

  http.get('/api/cards/:cardId/activity', ({ params }) => {
    const card = findCard(params.cardId);
    if (!card) return apiErrorResponse('NOT_FOUND');
    const activities = boardDb.activities
      .filter((item) => item.cardId === card.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(activitiesResponseSchema.parse({ activities }));
  }),

  http.patch('/api/cards/:cardId', async ({ request, params }) => {
    const parsed = updateCardRequestSchema.safeParse(await readBody(request, 'cards/update'));
    if (!parsed.success) return validationError(parsed.error);
    const card = findCard(params.cardId);
    if (!card) return apiErrorResponse('NOT_FOUND');
    if (findBoard(card.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    const { title, description, priority, due } = parsed.data;
    const dueAt =
      due === undefined
        ? card.dueAt
        : due === null
          ? null
          : dueInputToIso(due, adminDb.workspace.timezone);
    const dueHasTime = due === undefined ? card.dueHasTime : due !== null && due.time !== null;
    if (dueAt !== card.dueAt || dueHasTime !== card.dueHasTime) {
      record(card.id, {
        type: 'card_due_changed',
        data: { from: card.dueAt, to: dueAt, hasTime: dueAt !== null && dueHasTime },
      });
    }
    if (title !== undefined && title !== card.title) {
      record(card.id, { type: 'card_title_changed', data: { from: card.title, to: title } });
    }
    if (priority !== undefined && priority !== card.priority) {
      record(card.id, {
        type: 'card_priority_changed',
        data: { from: card.priority, to: priority },
      });
    }
    const updated = updateCard(card.id, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description, hasDescription: description !== '' }),
      ...(priority !== undefined && { priority }),
      dueAt,
      dueHasTime: dueAt !== null && dueHasTime,
    });
    return HttpResponse.json(detail(updated));
  }),

  ...assigneeHandlers,
  ...labelHandlers,
  ...checklistHandlers,
  ...commentHandlers,

  http.post('/api/cards/:cardId/:action', async ({ request, params }) => {
    const action = String(params.action);
    const body = await readBody(request, `cards/${action}`);
    const card = findCard(params.cardId);
    if (!card) return apiErrorResponse('NOT_FOUND');
    if (findBoard(card.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');

    if (action === 'move') {
      const parsed = moveCardRequestSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      const target = findList(parsed.data.toListId);
      if (!target) return apiErrorResponse('NOT_FOUND');
      if (findBoard(target.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
      if (target.archivedAt) return apiErrorResponse('LIST_ARCHIVED');
      if (card.archivedAt) return apiErrorResponse('CONFLICT');

      const siblings = activeCards(target.id).filter((item) => item.id !== card.id);
      const order = applyPlacement(
        siblings.map((item) => item.id),
        card.id,
        parsed.data.placement,
      );
      if (order === null) return apiErrorResponse('INVALID_PLACEMENT');
      const index = order.indexOf(card.id);
      const from = findList(card.listId);
      const completionChange = completionChangeOnMove({
        status: card.status,
        fromListIsDone: from?.isDoneList ?? false,
        toListIsDone: target.isDoneList,
      });
      const targetLabels = new Set(
        boardDb.labels.filter((label) => label.boardId === target.boardId).map((label) => label.id),
      );
      const removedLabelIds = card.labelIds.filter((id) => !targetLabels.has(id));
      const moved = updateCard(card.id, {
        boardId: target.boardId,
        listId: target.id,
        labelIds: card.labelIds.filter((id) => targetLabels.has(id)),
        position: generateKeyBetween(
          siblings[index - 1]?.position ?? null,
          siblings[index]?.position ?? null,
        ),
        ...(completionChange === 'completed' && completed()),
        ...(completionChange === 'reopened' && reopened()),
      });
      if (from && from.id !== target.id) {
        const fromBoard = findBoard(from.boardId);
        const toBoard = findBoard(target.boardId);
        record(card.id, {
          type: 'card_moved',
          data: {
            fromListId: from.id,
            fromListName: from.name,
            toListId: target.id,
            toListName: target.name,
            fromBoardId: from.boardId,
            fromBoardName: fromBoard?.name ?? '',
            toBoardId: target.boardId,
            toBoardName: toBoard?.name ?? '',
          },
        });
      }
      if (completionChange === 'completed') record(card.id, { type: 'card_completed', data: {} });
      if (completionChange === 'reopened') record(card.id, { type: 'card_reopened', data: {} });
      return HttpResponse.json(
        cardMutationResultSchema.parse({
          card: summary(moved),
          completionChange,
          removedLabelIds,
        }),
      );
    }

    if (action === 'archive') {
      if (!card.archivedAt) {
        updateCard(card.id, { archivedAt: now() });
        record(card.id, { type: 'card_archived', data: {} });
      }
      return HttpResponse.json(
        cardSummaryResponseSchema.parse({ card: summary(findCard(card.id) as CardRecord) }),
      );
    }

    if (action === 'restore') {
      const list = findList(card.listId);
      if (list?.archivedAt) return apiErrorResponse('LIST_ARCHIVED');
      if (card.archivedAt) {
        const last = activeCards(card.listId).at(-1)?.position ?? null;
        const completes = list?.isDoneList === true && card.status === 'open';
        updateCard(card.id, {
          archivedAt: null,
          position: generateKeyBetween(last, null),
          ...(completes && completed()),
        });
        record(card.id, { type: 'card_restored', data: {} });
        if (completes) record(card.id, { type: 'card_completed', data: {} });
      }
      return HttpResponse.json(
        cardSummaryResponseSchema.parse({ card: summary(findCard(card.id) as CardRecord) }),
      );
    }

    if (action === 'complete' || action === 'reopen') {
      if (card.archivedAt) return apiErrorResponse('CONFLICT');
      return HttpResponse.json(changeCompletion(card, action));
    }

    return apiErrorResponse('NOT_FOUND');
  }),

  http.delete('/api/cards/:cardId', async ({ request, params }) => {
    await readBody(request, 'cards/delete');
    const card = findCard(params.cardId);
    if (!card) return apiErrorResponse('NOT_FOUND');
    boardDb.cards = boardDb.cards.filter((item) => item.id !== card.id);
    boardDb.activities = boardDb.activities.filter((item) => item.cardId !== card.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

/** `PUT /api/boards/:boardId/visibility` e lista de acesso (Fatia 11, ADR 0015). */
const visibilityHandlers = [
  http.put('/api/boards/:boardId/visibility', async ({ request, params }) => {
    const parsed = updateBoardVisibilityRequestSchema.safeParse(
      await readBody(request, 'boards/visibility'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (!canOpenBoard(board)) return boardRestricted();
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');

    const { visibility } = parsed.data;
    if (visibility === board.visibility) return HttpResponse.json({ board });
    if (visibility === 'team') {
      return HttpResponse.json(
        boardResponseSchema.parse({ board: setBoard(board.id, { visibility, viewerIds: [] }) }),
      );
    }
    // RN30: a lista inicial é quem restringiu mais quem criou o quadro — ninguém se tranca fora.
    const viewerIds = [...board.viewerIds];
    for (const userId of [mockActor.id, board.createdBy]) {
      if (!viewerIds.includes(userId)) viewerIds.push(userId);
    }
    return HttpResponse.json(
      boardResponseSchema.parse({ board: setBoard(board.id, { visibility, viewerIds }) }),
    );
  }),

  http.put('/api/boards/:boardId/viewers/:userId', async ({ request, params }) => {
    await readBody(request, 'boards/viewers');
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (!canOpenBoard(board)) return boardRestricted();
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    if (board.visibility !== 'restricted') {
      return apiErrorResponse('BOARD_NOT_RESTRICTED', {
        message: 'Este quadro voltou a ser visível para a equipe.',
      });
    }
    const user = adminDb.users.find((item) => item.id === params.userId);
    if (!user) return apiErrorResponse('NOT_FOUND');
    if (user.status !== 'active') {
      return apiErrorResponse('USER_NOT_ACTIVE', { message: 'Essa pessoa foi desativada.' });
    }
    const viewerIds = board.viewerIds.includes(user.id)
      ? board.viewerIds
      : [...board.viewerIds, user.id];
    setBoard(board.id, { viewerIds });
    return HttpResponse.json(boardViewersResponseSchema.parse({ viewerIds }));
  }),

  http.delete('/api/boards/:boardId/viewers/:userId', async ({ request, params }) => {
    await readBody(request, 'boards/viewers/delete');
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (!canOpenBoard(board)) return boardRestricted();
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    if (board.visibility !== 'restricted') {
      return apiErrorResponse('BOARD_NOT_RESTRICTED', {
        message: 'Este quadro voltou a ser visível para a equipe.',
      });
    }
    // A lista pode ficar vazia: o quadro segue restrito e só Admins abrem (RN38).
    const viewerIds = board.viewerIds.filter((id) => id !== params.userId);
    setBoard(board.id, { viewerIds });
    return HttpResponse.json(boardViewersResponseSchema.parse({ viewerIds }));
  }),
];

const coverUnavailable = () =>
  apiErrorResponse('COVER_STORAGE_UNAVAILABLE', {
    message: 'As capas de quadro não estão disponíveis agora.',
  });

const randomKey = () => randomUUID().replaceAll('-', '').slice(0, 32).padEnd(32, 'a');

/** URL assinada de leitura: muda a cada troca de capa, como a do R2. */
function signedCover(objectKey: string, width: number | null, height: number | null) {
  return {
    url: `${R2_ORIGIN}/${objectKey}?X-Amz-Signature=${randomKey()}`,
    width,
    height,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

/** Capa do quadro em três passos (ADR 0016) mais o `PUT` direto no "R2". */
const coverHandlers = [
  http.put(`${R2_ORIGIN}/*`, async ({ request }) => {
    const objectKey = new URL(request.url).pathname.slice(1);
    boardDb.requests.push({
      method: 'PUT',
      path: 'r2/upload',
      body: { objectKey, contentType: request.headers.get('Content-Type') },
    });
    await request.arrayBuffer();
    boardDb.storage.add(objectKey);
    return new HttpResponse(null, { status: 200 });
  }),

  http.post('/api/boards/:boardId/cover/upload-url', async ({ request, params }) => {
    const parsed = boardCoverUploadUrlRequestSchema.safeParse(
      await readBody(request, 'boards/cover/upload-url'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (!canOpenBoard(board)) return boardRestricted();
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    if (!coverStorage.enabled) return coverUnavailable();
    const objectKey = `covers/${board.id}/${randomKey()}`;
    return HttpResponse.json(
      boardCoverUploadUrlResponseSchema.parse({
        uploadUrl: `${R2_ORIGIN}/${objectKey}`,
        objectKey,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        headers: { 'Content-Type': parsed.data.contentType },
      }),
    );
  }),

  http.put('/api/boards/:boardId/cover', async ({ request, params }) => {
    const parsed = confirmBoardCoverRequestSchema.safeParse(
      await readBody(request, 'boards/cover'),
    );
    if (!parsed.success) return validationError(parsed.error);
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (!canOpenBoard(board)) return boardRestricted();
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    if (!coverStorage.enabled) return coverUnavailable();
    const { objectKey, width, height } = parsed.data;
    // A chave precisa ser deste quadro e ter sido criada por uma URL que a API assinou.
    if (!isBoardCoverKey(objectKey, board.id) || !boardDb.storage.has(objectKey)) {
      return apiErrorResponse('COVER_UPLOAD_INVALID', {
        message: 'Não foi possível confirmar a capa.',
      });
    }
    const updated = setBoard(board.id, {
      cover: signedCover(objectKey, width ?? null, height ?? null),
    });
    return HttpResponse.json(boardResponseSchema.parse({ board: updated }));
  }),

  http.delete('/api/boards/:boardId/cover', async ({ request, params }) => {
    await readBody(request, 'boards/cover/delete');
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (!canOpenBoard(board)) return boardRestricted();
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    if (!coverStorage.enabled) return coverUnavailable();
    // Idempotente: quadro sem capa responde 200 sem mudar nada.
    if (!board.cover) return HttpResponse.json(boardResponseSchema.parse({ board }));
    return HttpResponse.json(
      boardResponseSchema.parse({ board: setBoard(board.id, { cover: null }) }),
    );
  }),
];

export const boardHandlers = [
  ...cardHandlers,
  ...visibilityHandlers,
  ...coverHandlers,
  http.get('/api/boards', ({ request }) => {
    const archived = new URL(request.url).searchParams.get('archived') === 'true';
    // Quadro restrito sem acesso vem como `LockedBoard`: o corte é no servidor (scope §11.8).
    const boards = boardDb.boards
      .filter((board) => (board.archivedAt !== null) === archived)
      .map((board) => (canOpenBoard(board) ? board : lockedBoard(board)));
    return HttpResponse.json(boardsResponseSchema.parse({ boards }));
  }),

  http.post('/api/boards', async ({ request }) => {
    const parsed = createBoardRequestSchema.safeParse(await readBody(request, 'boards'));
    if (!parsed.success) return validationError(parsed.error);
    const board: BoardRecord = {
      locked: false,
      id: randomUUID(),
      name: parsed.data.name,
      visibility: 'team',
      cover: null,
      viewerIds: [],
      createdBy: mockActor.id,
      archivedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    const lists: List[] = DEFAULT_BOARD_LISTS.map((item, index) => ({
      id: randomUUID(),
      boardId: board.id,
      name: item.name,
      color: item.color,
      isDoneList: item.isDoneList,
      position: position(index),
      archivedAt: null,
    }));
    boardDb.boards.push(board);
    boardDb.lists.push(...lists);
    return HttpResponse.json(createBoardResponseSchema.parse({ board, lists }), { status: 201 });
  }),

  http.get('/api/boards/:boardId', ({ params }) => {
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND', { message: 'Quadro não encontrado.' });
    // Ordem 404 → 403: o quadro existe e o nome já é público na lista (scope §11.8).
    if (!canOpenBoard(board)) return boardRestricted();
    const lists = activeLists(board.id);
    const listIds = new Set(lists.map((list) => list.id));
    const cards = boardDb.cards
      .filter((card) => listIds.has(card.listId) && !card.archivedAt)
      .map(withAggregates);
    const labels = boardDb.labels
      .filter((label) => label.boardId === board.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return HttpResponse.json(boardPayloadSchema.parse({ board, lists, cards, labels }));
  }),

  http.patch('/api/boards/:boardId', async ({ request, params }) => {
    const parsed = updateBoardRequestSchema.safeParse(await readBody(request, 'board/rename'));
    if (!parsed.success) return validationError(parsed.error);
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    return HttpResponse.json(
      boardResponseSchema.parse({ board: setBoard(board.id, { name: parsed.data.name }) }),
    );
  }),

  http.post('/api/boards/:boardId/:action', async ({ request, params }) => {
    const action = String(params.action);
    const board = findBoard(params.boardId);
    if (action === 'lists') {
      const parsed = createListRequestSchema.safeParse(await readBody(request, 'lists/create'));
      if (!parsed.success) return validationError(parsed.error);
      if (!board) return apiErrorResponse('NOT_FOUND');
      if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
      const current = activeLists(board.id);
      const list: List = {
        id: randomUUID(),
        boardId: board.id,
        name: parsed.data.name,
        color: parsed.data.color ?? nextPaletteColor(current.at(-1)?.color ?? null),
        isDoneList: false,
        position: position(current.length),
        archivedAt: null,
      };
      boardDb.lists.push(list);
      return HttpResponse.json(listResponseSchema.parse({ list }), { status: 201 });
    }
    if (action === 'labels') {
      const parsed = createLabelRequestSchema.safeParse(await readBody(request, 'labels/create'));
      if (!parsed.success) return validationError(parsed.error);
      if (!board) return apiErrorResponse('NOT_FOUND');
      if (board.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
      const label: Label = { id: randomUUID(), boardId: board.id, ...parsed.data };
      boardDb.labels.push(label);
      return HttpResponse.json(labelResponseSchema.parse({ label }), { status: 201 });
    }
    await readBody(request, `board/${action}`);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (action === 'archive' || action === 'restore') {
      const updated =
        action === 'archive'
          ? setBoard(board.id, { archivedAt: board.archivedAt ?? now() })
          : setBoard(board.id, { archivedAt: null });
      return HttpResponse.json(boardResponseSchema.parse({ board: updated }));
    }
    return apiErrorResponse('NOT_FOUND');
  }),

  http.delete('/api/boards/:boardId', async ({ request, params }) => {
    const parsed = deleteBoardRequestSchema.safeParse(await readBody(request, 'board/delete'));
    if (!parsed.success) return validationError(parsed.error);
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    if (parsed.data.confirmName !== board.name.trim()) {
      return apiErrorResponse('CONFIRMATION_MISMATCH', { message: 'O nome não confere.' });
    }
    boardDb.boards = boardDb.boards.filter((item) => item.id !== board.id);
    boardDb.lists = boardDb.lists.filter((list) => list.boardId !== board.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/boards/:boardId/archived', ({ params }) => {
    const board = findBoard(params.boardId);
    if (!board) return apiErrorResponse('NOT_FOUND');
    const lists = boardDb.lists.filter((list) => list.boardId === board.id && list.archivedAt);
    const cards = boardDb.cards
      .filter((card) => card.boardId === board.id && card.archivedAt)
      .sort((x, y) => (y.archivedAt ?? '').localeCompare(x.archivedAt ?? ''))
      .map((card) => {
        const list = findList(card.listId);
        return archivedCardSchema.parse({
          ...card,
          listName: list?.name ?? '',
          listArchived: Boolean(list?.archivedAt),
        });
      });
    return HttpResponse.json(boardArchivedResponseSchema.parse({ lists, cards }));
  }),

  http.patch('/api/lists/:listId', async ({ request, params }) => {
    const parsed = updateListRequestSchema.safeParse(await readBody(request, 'lists/update'));
    if (!parsed.success) return validationError(parsed.error);
    const list = findList(params.listId);
    if (!list) return apiErrorResponse('NOT_FOUND');
    if (findBoard(list.boardId)?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');
    const { name, color, isDoneList } = parsed.data;
    let completedCardIds: string[] = [];
    if (isDoneList === true) {
      if (list.archivedAt) return apiErrorResponse('LIST_ARCHIVED');
      boardDb.lists = boardDb.lists.map((item) =>
        item.boardId === list.boardId ? { ...item, isDoneList: item.id === list.id } : item,
      );
      completedCardIds = boardDb.cards
        .filter((card) => card.listId === list.id && card.status === 'open' && !card.archivedAt)
        .map((card) => card.id);
      boardDb.cards = boardDb.cards.map((card) =>
        completedCardIds.includes(card.id)
          ? { ...card, status: 'completed', completedAt: now() }
          : card,
      );
    }
    updateList(list.id, {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(isDoneList === false && { isDoneList: false }),
    });
    return HttpResponse.json(
      updateListResponseSchema.parse({ lists: activeLists(list.boardId), completedCardIds }),
    );
  }),

  http.post('/api/lists/:listId/:action', async ({ request, params }) => {
    const action = String(params.action);
    const body = await readBody(request, `lists/${action}`);
    const list = findList(params.listId);
    if (!list) return apiErrorResponse('NOT_FOUND');
    const board = findBoard(list.boardId);
    if (board?.archivedAt) return apiErrorResponse('BOARD_ARCHIVED');

    if (action === 'move') {
      const parsed = moveListRequestSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      const order = applyPlacement(
        activeLists(list.boardId).map((item) => item.id),
        list.id,
        parsed.data.placement,
      );
      if (order === null) return apiErrorResponse('INVALID_PLACEMENT');
      resequence(order);
    } else if (action === 'archive') {
      updateList(list.id, { archivedAt: list.archivedAt ?? T0, isDoneList: false });
      resequence(activeLists(list.boardId).map((item) => item.id));
    } else if (action === 'restore') {
      if (list.archivedAt) {
        updateList(list.id, {
          archivedAt: null,
          position: position(activeLists(list.boardId).length),
        });
      }
    } else {
      return apiErrorResponse('NOT_FOUND');
    }
    return HttpResponse.json(listResponseSchema.parse({ list: findList(list.id) }));
  }),
];
