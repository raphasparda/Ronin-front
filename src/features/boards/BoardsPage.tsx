import type { BoardListItem } from '@raphasparda/ronin-shared';
import { ArrowRight, LayoutGrid, Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadError } from '../../components/ui/QueryState';
import { toast } from '../../components/ui/toast-store';
import { HealthStatus } from '../health/HealthStatus';
import { RESTRICTION_MESSAGES } from './board-messages';
import { BoardCoverThumb } from './BoardCoverImage';
import { useBoards } from './boards-api';
import { CreateBoardDialog } from './CreateBoardDialog';

const TILE_CLASS =
  'flex min-h-20 w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-text no-underline shadow-sm transition-shadow duration-150 ease-standard';

/**
 * Quadro restrito ao qual a pessoa não tem acesso (ADR 0015): nome e cadeado, e nada mais — sem
 * capa nem menu. Não é link; é focável e explica o motivo ao ser acionado.
 */
function LockedBoardTile({ board }: { board: Extract<BoardListItem, { locked: true }> }) {
  return (
    <button
      type="button"
      aria-label={RESTRICTION_MESSAGES.lockedTile(board.name)}
      onClick={() => toast.info(RESTRICTION_MESSAGES.lockedClick)}
      className={`focus-inset cursor-default text-left ${TILE_CLASS}`}
    >
      <span aria-hidden className="flex flex-1 items-start gap-2 p-4">
        <Lock size={16} className="mt-0.5 shrink-0 text-muted" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="line-clamp-2 text-md font-semibold">{board.name}</span>
          <span className="text-xs text-muted">{RESTRICTION_MESSAGES.lockedBadge}</span>
        </span>
      </span>
    </button>
  );
}

function BoardTile({ board }: { board: Extract<BoardListItem, { locked: false }> }) {
  return (
    <Link
      to={`/b/${board.id}`}
      className={`focus-inset hover:border-border-strong hover:shadow-md ${TILE_CLASS}`}
    >
      {board.cover && (
        <BoardCoverThumb
          url={board.cover.url}
          width={board.cover.width}
          height={board.cover.height}
        />
      )}
      <span className="flex flex-1 items-center p-4">
        <span className="line-clamp-2 text-md font-semibold">{board.name}</span>
      </span>
    </Link>
  );
}

function BoardTilesSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      <p role="status" className="sr-only">
        Carregando quadros…
      </p>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden className="h-24 animate-pulse rounded-xl bg-surface-sunken" />
      ))}
    </div>
  );
}

export function BoardsPage() {
  const boards = useBoards(false);
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <title>Quadros · Ronin</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">Quadros</h1>
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Novo quadro
        </Button>
      </div>

      {boards.isPending ? (
        <BoardTilesSkeleton />
      ) : boards.isError ? (
        <LoadError onRetry={() => void boards.refetch()} retrying={boards.isFetching} />
      ) : boards.data.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhum quadro ainda"
          description="Crie o primeiro quadro para organizar as tarefas da equipe."
          action={
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              Criar quadro
            </Button>
          }
        />
      ) : (
        <ul
          aria-label="Quadros ativos"
          className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
        >
          {boards.data.map((board) => (
            <li key={board.id} className="flex">
              {board.locked ? <LockedBoardTile board={board} /> : <BoardTile board={board} />}
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/quadros/arquivados"
        className="inline-flex items-center gap-1.5 self-start font-semibold"
      >
        Ver quadros arquivados
        <ArrowRight aria-hidden size={16} />
      </Link>

      <footer className="flex flex-col gap-3 border-t border-border pt-4">
        <HealthStatus />
        {import.meta.env.DEV && (
          <p className="text-muted">
            Desenvolvimento: <Link to="/dev/paleta">ver a paleta de cores e prioridades</Link>.
          </p>
        )}
      </footer>

      <CreateBoardDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
