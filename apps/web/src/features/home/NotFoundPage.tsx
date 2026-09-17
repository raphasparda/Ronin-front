import { SearchX } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
      <title>Página não encontrada · Ronin</title>
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-sunken text-muted">
        <SearchX aria-hidden size={32} />
      </span>
      <h1 className="text-xl">Página não encontrada</h1>
      <p className="text-muted">O endereço pode estar errado ou a página ainda não existe.</p>
      <Link to="/" className="font-semibold">
        Voltar para Quadros
      </Link>
    </div>
  );
}
