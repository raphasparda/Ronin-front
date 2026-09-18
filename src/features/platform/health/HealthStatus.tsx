import {
  CircleAlert,
  CircleCheck,
  CloudOff,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../../components/ui/Button';
import { Pill, type PillStatus } from '../../../components/ui/Pill';
import { isApiError } from '../../../lib/api-client';
import { useHealth } from './health-api';

type HealthView = {
  status?: PillStatus;
  icon: ReactNode;
  label: string;
  description: string;
};

function describe(state: ReturnType<typeof useHealth>): HealthView {
  if (state.isPending) {
    return {
      icon: <LoaderCircle size={12} className="animate-spin" />,
      label: 'Verificando…',
      description: 'Consultando a API.',
    };
  }
  if (state.isSuccess) {
    return {
      status: 'done',
      icon: <CircleCheck size={12} />,
      label: 'API online',
      description: 'A API e o banco de dados estão respondendo.',
    };
  }
  const error = state.error;
  if (isApiError(error) && error.fromServer && error.code === 'SERVICE_UNAVAILABLE') {
    return {
      status: 'due-soon',
      icon: <TriangleAlert size={12} />,
      label: 'Banco indisponível',
      description: 'A API respondeu, mas não conseguiu falar com o banco de dados.',
    };
  }
  if (isApiError(error) && error.fromServer) {
    return {
      status: 'overdue',
      icon: <CircleAlert size={12} />,
      label: 'API com erro',
      description: error.message,
    };
  }
  return {
    status: 'overdue',
    icon: <CloudOff size={12} />,
    label: 'API offline',
    description: 'Não foi possível falar com a API. Confira se ela está rodando na porta 3000.',
  };
}

export function HealthStatus() {
  const health = useHealth();
  const view = describe(health);

  return (
    <section
      aria-labelledby="status-da-api"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="status-da-api" className="text-md font-semibold">
            Status da API
          </h2>
          <span role="status" aria-busy={health.isPending}>
            <Pill status={view.status} icon={view.icon}>
              {view.label}
            </Pill>
          </span>
        </div>
        <p className="text-muted">{view.description}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<RotateCw size={14} />}
        loading={health.isFetching}
        loadingText="Verificando…"
        onClick={() => void health.refetch()}
        className="self-start sm:self-center"
      >
        Verificar de novo
      </Button>
    </section>
  );
}
