import { ArrowRight, LayoutGrid, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadError } from '../../components/ui/QueryState';
import { HealthStatus } from '../health/HealthStatus';
import { useBoards } from './boards-api';
import { CreateBoardDialog } from './CreateBoardDialog';

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
            <li key={board.id}>
              <Link
                to={`/b/${board.id}`}
                className="flex min-h-20 items-center rounded-xl border border-border bg-surface p-4 text-text no-underline shadow-sm transition-shadow duration-150 ease-standard hover:border-border-strong hover:shadow-md"
              >
                <span className="line-clamp-2 text-md font-semibold">{board.name}</span>
              </Link>
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
