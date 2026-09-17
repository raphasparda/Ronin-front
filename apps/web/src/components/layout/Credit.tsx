/** Crédito de desenvolvimento exibido no rodapé das telas. */
export function Credit({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-muted ${className}`}>
      Desenvolvido por <span className="font-semibold text-text">SPARDA.dev</span>
    </footer>
  );
}
