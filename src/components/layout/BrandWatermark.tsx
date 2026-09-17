/**
 * Marca d'água das katanas no rodapé, centralizada e atrás do conteúdo.
 * Decorativa: fica fora da árvore de acessibilidade e não recebe cliques.
 * Não aparece na tela de login, que já tem o wallpaper próprio.
 */
export function BrandWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 flex justify-center overflow-hidden select-none"
    >
      <img
        src="/brand/katanas.png"
        alt=""
        width={900}
        height={450}
        loading="lazy"
        decoding="async"
        className="brand-watermark w-[min(34rem,80vw)] translate-y-[18%]"
      />
    </div>
  );
}
