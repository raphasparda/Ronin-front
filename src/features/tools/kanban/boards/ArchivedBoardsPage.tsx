import type { Board } from '@raphasparda/ronin-shared';
import { Archive, ArrowLeft, Lock, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Pill } from '../../../../components/ui/Pill';
import { ListSkeleton, LoadError } from '../../../../components/ui/QueryState';
import { toast } from '../../../../components/ui/toast-store';
import { isGloballyHandled, serverMessage } from '../../../../lib/api-errors';
import { useSessionUser } from '../../../platform/auth/auth-api';
import { RESTRICTION_MESSAGES } from './board-messages';
import { useBoards, useRestoreBoard } from './boards-api';
import { DeleteBoardDialog } from './DeleteBoardDialog';

export function ArchivedBoardsPage() {
  const boards = useBoards(true);
  const restore = useRestoreBoard();
  const isAdmin = useSessionUser()?.role === 'admin';
  const [deleting, setDeleting] = useState<Board | null>(null);
  const navigate = useNavigate();

  const restoreBoard = (board: Board) =>
    restore.mutate(board.id, {
      onSuccess: () =>
        toast.success(`Quadro "${board.name}" restaurado.`, {
          label: 'Abrir',
          onClick: () => void navigate(`/b/${board.id}`),
        }),
      onError: (error) => {
        if (!isGloballyHandled(error)) toast.error(serverMessage(error));
      },
    });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <title>Quadros arquivados · Ronin</title>
      <div className="flex flex-col gap-2">
        <Link to="/" className="inline-flex items-center gap-1.5 self-start font-semibold">
          <ArrowLeft aria-hidden size={16} />
          Quadros
        </Link>
        <h1 className="text-xl">Quadros arquivados</h1>
      </div>

      {boards.isPending ? (
        <ListSkeleton label="Carregando quadros arquivados…" rows={3} />
      ) : boards.isError ? (
        <LoadError onRetry={() => void boards.refetch()} retrying={boards.isFetching} />
      ) : boards.data.length === 0 ? (
        <EmptyState icon={Archive} title="Nenhum quadro arquivado." />
      ) : (
        <ul
          aria-label="Quadros arquivados"
          className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm"
        >
          {boards.data.map((board) =>
            board.locked ? (
              // Quadro restrito sem acesso: nome e cadeado, sem link e sem ações (ADR 0015).
              <li key={board.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                    <Lock aria-hidden size={14} className="shrink-0 text-muted" />
                    <span className="truncate">{board.name}</span>
                  </span>
                  <Pill status="archived" icon={<Archive size={12} />}>
                    Arquivado
                  </Pill>
                  <Pill>{RESTRICTION_MESSAGES.lockedBadge}</Pill>
                </span>
              </li>
            ) : (
              <li key={board.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <Link to={`/b/${board.id}`} className="truncate font-semibold">
                    {board.name}
                  </Link>
                  <Pill status="archived" icon={<Archive size={12} />}>
                    Arquivado
                  </Pill>
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw size={14} />}
                    aria-label={`Restaurar ${board.name}`}
                    loading={restore.isPending && restore.variables === board.id}
                    loadingText="Restaurando…"
                    onClick={() => restoreBoard(board)}
                  >
                    Restaurar
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      aria-label={`Excluir ${board.name}`}
                      onClick={() => setDeleting(board)}
                    >
                      Excluir
                    </Button>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <DeleteBoardDialog board={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
