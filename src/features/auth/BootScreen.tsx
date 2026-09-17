import { CloudOff, LoaderCircle, RotateCw } from 'lucide-react';

import { Button } from '../../components/ui/Button';

export function BootLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
      <p role="status" className="flex items-center gap-2">
        <LoaderCircle aria-hidden size={16} className="animate-spin" />
        Carregando…
      </p>
    </div>
  );
}

export function BootError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 text-text">
      <title>Erro · Ronin</title>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-sunken text-muted">
          <CloudOff aria-hidden size={32} />
        </span>
        <h1 className="text-xl">Não foi possível abrir o Ronin</h1>
        <p className="text-muted">Algo deu errado ao falar com o servidor. Tente de novo.</p>
        <Button
          variant="secondary"
          icon={<RotateCw size={16} />}
          loading={retrying}
          loadingText="Tentando…"
          onClick={onRetry}
        >
          Tentar de novo
        </Button>
      </div>
    </main>
  );
}
