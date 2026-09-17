import { LayoutGrid } from 'lucide-react';
import { Link } from 'react-router';

import { HealthStatus } from '../health/HealthStatus';

export function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <title>Quadros · Ronin</title>
      <h1 className="text-xl">Quadros</h1>

      <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-4 py-10 text-center shadow-sm">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-sunken text-muted">
          <LayoutGrid aria-hidden size={32} />
        </span>
        <h2 className="text-md font-semibold">Seus quadros vão aparecer aqui</h2>
        <p className="max-w-md text-muted">
          O Ronin ainda está em construção. Por enquanto, esta página só mostra se a API está no ar.
        </p>
      </section>

      <HealthStatus />

      {import.meta.env.DEV && (
        <p className="text-muted">
          Desenvolvimento: <Link to="/dev/paleta">ver a paleta de cores e prioridades</Link>.
        </p>
      )}
    </div>
  );
}
