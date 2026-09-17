/**
 * Crédito de desenvolvimento no rodapé das telas. Não recebe cliques: o rodapé fica no fim do
 * fluxo e, no celular, chegava a cobrir menus abertos perto da borda inferior.
 */
export function Credit({ className = '' }: { className?: string }) {
  return (
    <footer className={`pointer-events-none text-center text-xs text-muted ${className}`}>
      Desenvolvido por <span className="font-semibold text-text">SPARDA.dev</span>
    </footer>
  );
}
