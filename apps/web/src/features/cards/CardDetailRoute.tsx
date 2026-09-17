import type { CardDetail } from '@kanban/shared';
import {
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Link2,
  MoreHorizontal,
  RotateCcw,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import { DuePill } from '../../components/ui/DuePill';
import { Pill } from '../../components/ui/Pill';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { LoadError } from '../../components/ui/QueryState';
import { tabPanelProps, Tabs } from '../../components/ui/Tabs';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { copyText } from '../../lib/clipboard';
import { useNow } from '../../lib/use-now';
import { useSession, useSessionUser } from '../auth/auth-api';
import { useBoardErrorHandler } from '../boards/board-errors';
import { useBoard } from '../boards/boards-api';
import { CardActivity } from './CardActivity';
import { CardChecklists } from './CardChecklists';
import { CardCompletion } from './CardCompletion';
import { CardComments } from './CardComments';
import { CardDescription, DiscardDescriptionDialog } from './CardDescription';
import { CardAssigneesField, CardDueField, CardLabelsField, CardPriorityField } from './CardFields';
import { CARD_MESSAGES } from './card-messages';
import {
  cardPath,
  toCardSummary,
  useCard,
  useDeleteCard,
  useUpdateCard,
  type CardLinkState,
} from './cards-api';
import { CardTitle } from './CardTitle';
import { MoveCardDialog } from './MoveCardDialog';
import { useCardArchiving, useCardMover } from './use-card-actions';

/** Espaço invisível: faz o leitor de tela repetir um anúncio igual ao anterior. */
const REPEAT_MARK = String.fromCharCode(160);

const PANEL_CLASS = 'sm:max-w-[52.5rem]';

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 font-medium text-text hover:bg-hover sm:hidden"
      >
        <ArrowLeft aria-hidden size={18} />
        Voltar
      </button>
      <button
        type="button"
        aria-label="Fechar"
        title="Fechar"
        onClick={onClose}
        className="hidden h-10 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text sm:inline-flex md:h-8"
      >
        <X aria-hidden size={18} />
      </button>
    </>
  );
}

interface CardDetailViewProps {
  card: CardDetail;
  onClose: () => void;
}

function CardDetailView({ card, onClose }: CardDetailViewProps) {
  const boardId = card.boardId;
  const titleId = useId();
  const checklistsId = useId();
  const tabsId = useId();
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback(
    (message: string) =>
      setAnnouncement((current) => (current === message ? `${message}${REPEAT_MARK}` : message)),
    [],
  );
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isAdmin = useSessionUser()?.role === 'admin';
  const board = useBoard(boardId, { paused: true });
  const update = useUpdateCard(card.id);
  const mover = useCardMover(boardId);
  const archiving = useCardArchiving(boardId);
  const deleteCard = useDeleteCard(boardId);
  const handleError = useBoardErrorHandler(boardId);

  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archived = card.archivedAt !== null;
  const boardArchived = card.board.archived;
  const readOnly = archived || boardArchived;
  const restoreTarget = { card, listName: card.list.name };

  const requestClose = () => (descriptionDirty ? setConfirmDiscard(true) : onClose());

  const copyLink = async () => {
    const ok = await copyText(`${window.location.origin}${cardPath(boardId, card.id)}`);
    if (ok) toast.success(CARD_MESSAGES.linkCopied);
    else toast.error(CARD_MESSAGES.linkCopyFailed);
  };

  const saveTitle = (title: string) =>
    update.mutate({ title }, { onError: (error) => handleError(error, CARD_MESSAGES.titleFailed) });

  const removeCard = () =>
    deleteCard.mutate(card.id, {
      onSuccess: () => {
        toast.success(CARD_MESSAGES.deleted);
        onClose();
      },
      onError: (error) => {
        setConfirmDelete(false);
        handleError(error, CARD_MESSAGES.deleteFailed);
      },
    });

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        labelledBy={titleId}
        getInitialFocus={() => headingRef.current}
        getFallbackFocus={() => headingRef.current}
        className={PANEL_CLASS}
      >
        <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-5 sm:py-3">
          <nav
            aria-label="Local do card"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm"
          >
            <span className="truncate text-muted">{card.board.name}</span>
            <ChevronRight aria-hidden size={14} className="shrink-0 text-muted" />
            <Pill color={card.list.color} className="max-w-full">
              <span className="truncate">{card.list.name}</span>
              {card.list.isDoneList && <span className="sr-only"> (lista de conclusão)</span>}
            </Pill>
          </nav>
          <Menu
            label="Opções do card"
            trigger={<MoreHorizontal aria-hidden size={18} />}
            triggerClassName="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8"
          >
            <MenuItem icon={<Link2 size={16} />} onSelect={() => void copyLink()}>
              Copiar link do card
            </MenuItem>
            {!readOnly && (
              <MenuItem icon={<ArrowRightLeft size={16} />} onSelect={() => setMoving(true)}>
                Mover para…
              </MenuItem>
            )}
            {!boardArchived &&
              (archived ? (
                <MenuItem
                  icon={<RotateCcw size={16} />}
                  onSelect={() => archiving.restore(restoreTarget)}
                >
                  Restaurar
                </MenuItem>
              ) : (
                <MenuItem
                  icon={<Archive size={16} />}
                  onSelect={() => archiving.archive(restoreTarget)}
                >
                  Arquivar
                </MenuItem>
              ))}
            {isAdmin && !boardArchived && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 size={16} />}
                  tone="danger"
                  onSelect={() => setConfirmDelete(true)}
                >
                  Excluir definitivamente
                </MenuItem>
              </>
            )}
          </Menu>
          <div className="max-sm:order-first">
            <CloseButton onClose={requestClose} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2 px-4 pt-4 sm:px-5">
            <CardTitle
              id={titleId}
              title={card.title}
              readOnly={readOnly}
              headingRef={headingRef}
              onSave={saveTitle}
              onEmpty={() => toast.error(CARD_MESSAGES.emptyTitle)}
            />
            {(card.priority !== null || card.dueAt !== null || card.status === 'completed') && (
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={card.priority} />
                <DuePill card={card} timeZone={timeZone} now={now} />
              </div>
            )}
          </div>

          {(archived || boardArchived) && (
            <div
              role="status"
              className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-l-4 border-border border-l-(--status-archived-bg) bg-surface p-3 sm:mx-5 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Pill status="archived" icon={<Archive size={12} />}>
                    Arquivado
                  </Pill>
                  {archived
                    ? 'Este card está arquivado.'
                    : 'O quadro deste card está arquivado (somente leitura).'}
                </span>
                {archived && card.list.archived && (
                  <span className="text-muted">
                    {CARD_MESSAGES.restoreListFirst(card.list.name)}
                  </span>
                )}
                {archived && card.list.isDoneList && card.status === 'open' && (
                  <span className="text-muted">
                    Ao restaurar, ele volta para {card.list.name} e é marcado como concluído.
                  </span>
                )}
              </div>
              {archived && !boardArchived && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RotateCcw size={14} />}
                    disabled={card.list.archived}
                    loading={archiving.restoringId === card.id}
                    loadingText="Restaurando…"
                    onClick={() => archiving.restore(restoreTarget)}
                  >
                    Restaurar
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Excluir definitivamente
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16.25rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <CardCompletion card={card} readOnly={readOnly} announce={announce} />
              <CardDescription
                card={card}
                readOnly={readOnly}
                onDirtyChange={setDescriptionDirty}
              />
              <section aria-labelledby={checklistsId} className="flex flex-col gap-3">
                <h3 id={checklistsId} className="text-md font-semibold">
                  Checklists
                </h3>
                <CardChecklists card={card} readOnly={readOnly} announce={announce} />
              </section>
              <section aria-label="Comentários e histórico" className="flex flex-col gap-3">
                <Tabs
                  label="Comentários e histórico"
                  idPrefix={tabsId}
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    {
                      id: 'comments',
                      label:
                        card.comments.length > 0
                          ? `Comentários (${card.comments.length})`
                          : 'Comentários',
                    },
                    { id: 'history', label: 'Histórico' },
                  ]}
                />
                <div {...tabPanelProps(tabsId, tab)} className="pt-1">
                  {tab === 'comments' ? (
                    <CardComments card={card} readOnly={readOnly} />
                  ) : (
                    <CardActivity cardId={card.id} boardId={boardId} />
                  )}
                </div>
              </section>
            </div>

            <aside
              aria-label="Detalhes e ações do card"
              className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-4 lg:self-start"
            >
              <CardPriorityField card={card} readOnly={readOnly} announce={announce} />
              <CardAssigneesField card={card} readOnly={readOnly} announce={announce} />
              <CardDueField card={card} readOnly={readOnly} announce={announce} />
              <CardLabelsField
                card={card}
                board={board.data}
                readOnly={readOnly}
                announce={announce}
              />
              {readOnly ? (
                <p className="border-t border-border pt-4 text-muted">
                  Nenhuma ação disponível enquanto estiver arquivado.
                </p>
              ) : (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    icon={<ArrowRightLeft size={16} />}
                    className="justify-start"
                    disabled={!board.data}
                    onClick={() => setMoving(true)}
                  >
                    Mover para…
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Archive size={16} />}
                    className="justify-start"
                    loading={archiving.archivePending}
                    loadingText="Arquivando…"
                    onClick={() => archiving.archive(restoreTarget)}
                  >
                    Arquivar
                  </Button>
                </div>
              )}
            </aside>
          </div>
        </div>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </Modal>

      <MoveCardDialog
        card={moving ? toCardSummary(card) : null}
        source={board.data}
        onMove={(variables) => {
          mover.move(variables);
          if (variables.toBoard.id !== boardId) onClose();
        }}
        onClose={() => setMoving(false)}
      />

      <DiscardDescriptionDialog
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={onClose}
      />

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title="Excluir o card definitivamente?"
        description={<p>Não dá para desfazer.</p>}
        confirmLabel="Excluir card"
        pending={deleteCard.isPending}
        pendingLabel="Excluindo…"
        onConfirm={removeCard}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

function DetailState({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  return (
    <Modal open onClose={onClose} labelledBy={titleId} className={PANEL_CLASS}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-5 sm:py-3">
        <h2 id={titleId} className="text-lg font-semibold">
          Card
        </h2>
        <CloseButton onClose={onClose} />
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </Modal>
  );
}

/**
 * `/b/:boardId/c/:cardId`: detalhe do card como diálogo sobre o quadro (tela cheia abaixo de
 * 640px). Fechar volta no histórico quando veio de dentro do app; em acesso direto, vai ao quadro.
 */
export function CardDetailRoute() {
  const { boardId = '', cardId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const card = useCard(cardId);
  const state: unknown = location.state;
  const fromApp = (state as Partial<CardLinkState> | null)?.fromApp === true;

  const close = useCallback(() => {
    if (fromApp) void navigate(-1);
    else void navigate({ pathname: `/b/${boardId}`, search: location.search });
  }, [boardId, fromApp, navigate, location.search]);

  const actualBoardId = card.data?.boardId;
  useEffect(() => {
    if (actualBoardId && actualBoardId !== boardId) {
      void navigate(cardPath(actualBoardId, cardId), { replace: true, state });
    }
  }, [actualBoardId, boardId, cardId, state, navigate]);

  if (card.isPending) {
    return (
      <DetailState onClose={close}>
        <p role="status" className="sr-only">
          Carregando card…
        </p>
        <div aria-hidden className="flex flex-col gap-3">
          <div className="h-8 w-3/4 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-24 animate-pulse rounded-lg bg-surface-sunken" />
        </div>
      </DetailState>
    );
  }

  if (card.isError) {
    const notFound =
      isApiError(card.error) && (card.error.status === 404 || card.error.status === 400);
    return (
      <DetailState onClose={close}>
        {notFound ? (
          <EmptyState
            icon={SearchX}
            title={CARD_MESSAGES.notFound}
            description={CARD_MESSAGES.notFoundDescription}
            action={<Button onClick={close}>Voltar para o quadro</Button>}
          />
        ) : (
          <LoadError onRetry={() => void card.refetch()} retrying={card.isFetching} />
        )}
      </DetailState>
    );
  }

  return <CardDetailView card={card.data} onClose={close} />;
}
