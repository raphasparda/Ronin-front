import { matchesBoardFilter, type Board, type BoardPayload } from '@kanban/shared';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  FolderArchive,
  ListFilter,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  SearchX,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { InlineEdit } from '../../components/ui/InlineEdit';
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import { Pill } from '../../components/ui/Pill';
import { LoadError } from '../../components/ui/QueryState';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { useSessionUser } from '../auth/auth-api';
import { CardFaceDataProvider, useCardFaceData } from '../cards/card-face-data';
import { ArchivedItemsDialog } from './ArchivedItemsDialog';
import { useBoardErrorHandler } from './board-errors';
import { BoardLists, LIST_MESSAGES } from './BoardLists';
import { useArchiveBoard, useBoard, useRenameBoard, useRestoreBoard } from './boards-api';
import { BoardFilterBar, FilterStatus, useFilterOptions } from './BoardFilterBar';
import { DeleteBoardDialog } from './DeleteBoardDialog';
import { LabelsDialog } from './LabelsDialog';
import { countActiveCriteria, useBoardFilter } from './use-board-filter';

/** Espaço invisível: faz o leitor de tela repetir um anúncio igual ao anterior. */
const REPEAT_MARK = '\u00a0';

export const BOARD_MESSAGES = {
  notFound: 'Quadro não encontrado',
  notFoundDescription: 'Ele pode ter sido excluído.',
  archivedBanner: 'Este quadro está arquivado.',
  archived: 'Quadro arquivado.',
  restored: 'Quadro restaurado.',
  renameFailed: 'Não foi possível renomear o quadro. Tente de novo.',
  archiveFailed: 'Não foi possível arquivar o quadro. Tente de novo.',
  restoreFailed: 'Não foi possível restaurar o quadro. Tente de novo.',
} as const;

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        Carregando quadro…
      </p>
      <div aria-hidden className="h-8 w-64 max-w-full animate-pulse rounded-md bg-surface-sunken" />
      <div aria-hidden className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-48 w-72 shrink-0 animate-pulse rounded-lg bg-surface-sunken"
          />
        ))}
      </div>
    </div>
  );
}

interface BoardHeaderProps {
  board: Board;
  readOnly: boolean;
  filterToggle: ReactNode;
  onOpenLabels: () => void;
  onOpenArchived: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

function BoardHeader({
  board,
  readOnly,
  filterToggle,
  onOpenLabels,
  onOpenArchived,
  onArchive,
  onRestore,
  onDelete,
}: BoardHeaderProps) {
  const isAdmin = useSessionUser()?.role === 'admin';
  const rename = useRenameBoard(board.id);
  const handleError = useBoardErrorHandler(board.id);
  const [renaming, setRenaming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {renaming ? (
        <>
          <h1 className="sr-only">{board.name}</h1>
          <InlineEdit
            value={board.name}
            label="Nome do quadro"
            maxLength={100}
            className="w-full max-w-md text-lg font-bold"
            onCancel={() => setRenaming(false)}
            onEmpty={() => toast.error(LIST_MESSAGES.emptyName)}
            onSave={(name) => {
              setRenaming(false);
              rename.mutate(name, {
                onError: (error) => handleError(error, BOARD_MESSAGES.renameFailed),
              });
            }}
          />
        </>
      ) : (
        <h1 className="min-w-0 text-xl break-words">{board.name}</h1>
      )}
      {!readOnly && !renaming && (
        <button
          type="button"
          aria-label="Renomear quadro"
          title="Renomear quadro"
          onClick={() => setRenaming(true)}
          className="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8"
        >
          <Pencil aria-hidden size={16} />
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        {filterToggle}
        <Menu
          label="Opções do quadro"
          trigger={<MoreHorizontal aria-hidden size={20} />}
          triggerClassName="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-9"
        >
          <MenuItem icon={<Tag size={16} />} onSelect={onOpenLabels}>
            Etiquetas…
          </MenuItem>
          <MenuItem icon={<FolderArchive size={16} />} onSelect={onOpenArchived}>
            Itens arquivados…
          </MenuItem>
          <MenuSeparator />
          {readOnly ? (
            <MenuItem icon={<ArchiveRestore size={16} />} onSelect={onRestore}>
              Restaurar quadro
            </MenuItem>
          ) : (
            <MenuItem icon={<Archive size={16} />} onSelect={onArchive}>
              Arquivar quadro
            </MenuItem>
          )}
          {isAdmin && (
            <MenuItem icon={<Trash2 size={16} />} tone="danger" onSelect={onDelete}>
              Excluir quadro…
            </MenuItem>
          )}
        </Menu>
      </div>
    </div>
  );
}

interface FilterToggleProps {
  count: number;
  expanded: boolean;
  controls: string;
  onClick: () => void;
}

function FilterToggle({ count, expanded, controls, onClick }: FilterToggleProps) {
  return (
    <Button
      variant={count > 0 ? 'primary' : 'secondary'}
      icon={<ListFilter size={16} />}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-keyshortcuts="/"
      onClick={onClick}
    >
      {count > 0 ? `Filtros (${count})` : 'Filtros'}
    </Button>
  );
}

interface BoardFiltersProps {
  payload: BoardPayload;
  visible: boolean;
  barId: string;
  searchRef: RefObject<HTMLInputElement | null>;
  filter: ReturnType<typeof useBoardFilter>;
}

/** Barra de filtros, indicador "Filtro ativo" e o vazio do quadro todo (screens §7.6). */
function BoardFilters({ payload, visible, barId, searchRef, filter }: BoardFiltersProps) {
  const options = useFilterOptions(payload);
  const { now } = useCardFaceData();
  if (!visible) return null;

  const total = payload.cards.length;
  const matching = filter.active
    ? payload.cards.filter((card) => matchesBoardFilter(card, filter.filter, now)).length
    : total;

  return (
    <div className="flex flex-col gap-3">
      <BoardFilterBar
        id={barId}
        filter={filter.filter}
        options={options}
        searchRef={searchRef}
        onChange={filter.setFilter}
      />
      {filter.active && (
        <FilterStatus
          filter={filter.filter}
          options={options}
          visible={matching}
          total={total}
          onChange={filter.setFilter}
          onClear={filter.clear}
        />
      )}
      {filter.active && matching === 0 && total > 0 && (
        <EmptyState
          icon={SearchX}
          title="Nenhum card encontrado"
          description="Nenhum card deste quadro atende aos filtros escolhidos."
          action={
            <Button variant="secondary" onClick={filter.clear}>
              Limpar filtros
            </Button>
          }
          className="py-6"
        />
      )}
    </div>
  );
}

function BoardView() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const board = useBoard(boardId, { paused: dragging });
  const archiveBoard = useArchiveBoard();
  const restoreBoard = useRestoreBoard();
  const handleError = useBoardErrorHandler(boardId);

  const [announcement, setAnnouncement] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const location = useLocation();
  const boardFilter = useBoardFilter();
  const [filterOpen, setFilterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterBarId = useId();
  const filterVisible = filterOpen || boardFilter.active;

  const announce = useCallback((message: string) => {
    setAnnouncement((current) => (current === message ? `${message}${REPEAT_MARK}` : message));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const editing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (editing || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setFilterOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (board.isPending) return <BoardSkeleton />;

  if (board.isError) {
    if (isApiError(board.error) && (board.error.status === 404 || board.error.status === 400)) {
      return (
        <div className="mx-auto w-full max-w-2xl">
          <title>Quadro não encontrado · Ronin</title>
          <EmptyState
            icon={SearchX}
            headingLevel="h1"
            title={BOARD_MESSAGES.notFound}
            description={BOARD_MESSAGES.notFoundDescription}
            action={<Link to="/">Voltar para Quadros</Link>}
          />
        </div>
      );
    }
    return <LoadError onRetry={() => void board.refetch()} retrying={board.isFetching} />;
  }

  const payload = board.data;
  const readOnly = payload.board.archivedAt !== null;

  const restore = () =>
    restoreBoard.mutate(payload.board.id, {
      onSuccess: () => toast.success(BOARD_MESSAGES.restored),
      onError: (error) => handleError(error, BOARD_MESSAGES.restoreFailed),
    });

  const archive = () =>
    archiveBoard.mutate(payload.board.id, {
      onSuccess: () => {
        setConfirmArchive(false);
        toast.success(BOARD_MESSAGES.archived, {
          label: 'Desfazer',
          onClick: () => restoreBoard.mutate(payload.board.id),
        });
        void navigate('/');
      },
      onError: (error) => {
        setConfirmArchive(false);
        handleError(error, BOARD_MESSAGES.archiveFailed);
      },
    });

  return (
    <CardFaceDataProvider labels={payload.labels} search={location.search}>
      <div className="flex flex-col gap-4">
        <title>{`${payload.board.name} · Ronin`}</title>
        <Link to="/" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold">
          <ArrowLeft aria-hidden size={16} />
          Quadros
        </Link>

        <BoardHeader
          board={payload.board}
          readOnly={readOnly}
          filterToggle={
            <FilterToggle
              count={countActiveCriteria(boardFilter.filter)}
              expanded={filterVisible}
              controls={filterBarId}
              onClick={() => {
                if (boardFilter.active) searchRef.current?.focus();
                else setFilterOpen((open) => !open);
              }}
            />
          }
          onOpenLabels={() => setLabelsOpen(true)}
          onOpenArchived={() => setArchivedOpen(true)}
          onArchive={() => setConfirmArchive(true)}
          onRestore={restore}
          onDelete={() => setDeleting(payload.board)}
        />

        {readOnly && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-lg border border-l-4 border-border border-l-(--status-archived-bg) bg-surface p-3 sm:flex-row sm:items-center"
          >
            <span className="flex flex-1 flex-wrap items-center gap-2">
              <Pill status="archived" icon={<Archive size={12} />}>
                Arquivado
              </Pill>
              <span>{BOARD_MESSAGES.archivedBanner} Somente leitura: restaure para editar.</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              loading={restoreBoard.isPending}
              loadingText="Restaurando…"
              onClick={restore}
            >
              Restaurar quadro
            </Button>
          </div>
        )}

        <BoardFilters
          payload={payload}
          visible={filterVisible}
          barId={filterBarId}
          searchRef={searchRef}
          filter={boardFilter}
        />

        <BoardLists
          payload={payload}
          filter={boardFilter.active ? boardFilter.filter : null}
          readOnly={readOnly}
          onDraggingChange={setDragging}
          announce={announce}
        />

        {payload.lists.length === 0 && readOnly && (
          <p className="text-muted">Este quadro não tem listas.</p>
        )}

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <ConfirmDialog
          open={confirmArchive}
          title={`Arquivar "${payload.board.name}"?`}
          description={<p>Ele sai da lista de quadros de todos. Você pode restaurar depois.</p>}
          confirmLabel="Arquivar quadro"
          pending={archiveBoard.isPending}
          pendingLabel="Arquivando…"
          onConfirm={archive}
          onClose={() => setConfirmArchive(false)}
        />

        <DeleteBoardDialog
          board={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => void navigate('/', { replace: true })}
        />

        <LabelsDialog
          open={labelsOpen}
          payload={payload}
          readOnly={readOnly}
          onClose={() => setLabelsOpen(false)}
        />

        <ArchivedItemsDialog
          payload={payload}
          open={archivedOpen}
          readOnly={readOnly}
          onClose={() => setArchivedOpen(false)}
        />
      </div>
    </CardFaceDataProvider>
  );
}

/** O detalhe do card (rota filha) fica fora dos ramos de carregamento para não remontar. */
export function BoardPage() {
  return (
    <>
      <BoardView />
      <Outlet />
    </>
  );
}
