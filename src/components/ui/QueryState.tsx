import { CloudOff, RotateCw } from 'lucide-react';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

export function LoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <EmptyState
      icon={CloudOff}
      title="Não foi possível carregar"
      description="Algo deu errado. Tente de novo."
      action={
        <Button
          variant="secondary"
          icon={<RotateCw size={16} />}
          loading={retrying}
          loadingText="Tentando…"
          onClick={onRetry}
        >
          Tentar de novo
        </Button>
      }
    />
  );
}

export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden className="h-14 animate-pulse rounded-lg bg-surface-sunken" />
      ))}
    </div>
  );
}
