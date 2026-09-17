import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';

const VIEWPORT_MARGIN = 16;
const GAP = 8;
const MIN_HEIGHT = 120;

export interface AnchoredPositionOptions {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  /** Largura máxima do painel em px (encolhe para caber na tela). */
  width: number;
  align: 'left' | 'right';
}

/**
 * Posição `fixed` de um painel preso a um botão: abre abaixo e, se não couber, acima (o lado com
 * mais espaço), sempre dentro da tela e com altura máxima para rolar por dentro. `side` mantém o
 * lado atual enquanto o painel couber nele (não pula de lado ao filtrar uma busca, por exemplo).
 */
export function computeAnchoredPosition(
  anchor: DOMRect,
  panelHeight: number,
  { width, align }: Pick<AnchoredPositionOptions, 'width' | 'align'>,
  viewport: { width: number; height: number },
  side?: 'below' | 'above',
): CSSProperties {
  const panelWidth = Math.min(width, viewport.width - 2 * VIEWPORT_MARGIN);
  const preferredLeft = align === 'right' ? anchor.right - panelWidth : anchor.left;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(preferredLeft, viewport.width - panelWidth - VIEWPORT_MARGIN),
  );

  const spaceBelow = viewport.height - anchor.bottom - GAP - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - GAP - VIEWPORT_MARGIN;
  const maxAvailable = viewport.height - 2 * VIEWPORT_MARGIN;
  const below =
    side === 'above' && panelHeight <= spaceAbove
      ? false
      : panelHeight <= spaceBelow || spaceBelow >= spaceAbove;

  const maxHeight = Math.min(maxAvailable, Math.max(below ? spaceBelow : spaceAbove, MIN_HEIGHT));
  const limit = viewport.height - VIEWPORT_MARGIN - Math.min(panelHeight, maxHeight);
  if (below) {
    return {
      top: Math.max(VIEWPORT_MARGIN, Math.min(anchor.bottom + GAP, limit)),
      left,
      maxHeight,
    };
  }
  return {
    bottom: Math.max(VIEWPORT_MARGIN, Math.min(viewport.height - anchor.top + GAP, limit)),
    left,
    maxHeight,
  };
}

function sameStyle(a: CSSProperties | null, b: CSSProperties): boolean {
  return (
    a !== null &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.maxHeight === b.maxHeight
  );
}

/**
 * Mantém o painel preso ao botão enquanto estiver aberto: recalcula ao rolar (na hora) e a cada
 * quadro, para acompanhar mudanças de layout (conteúdo que cresce acima do botão, teclado virtual).
 * Só gera novo render quando a posição muda.
 */
export function useAnchoredPosition({
  open,
  anchorRef,
  panelRef,
  width,
  align,
}: AnchoredPositionOptions): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const sideRef = useRef<'below' | 'above' | undefined>(undefined);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const borders = panel.offsetHeight - panel.clientHeight;
    const next = computeAnchoredPosition(
      anchor.getBoundingClientRect(),
      panel.scrollHeight + borders,
      { width, align },
      { width: window.innerWidth, height: window.innerHeight },
      sideRef.current,
    );
    sideRef.current = next.bottom === undefined ? 'below' : 'above';
    setStyle((current) => (sameStyle(current, next) ? current : next));
  }, [anchorRef, panelRef, width, align]);

  useLayoutEffect(() => {
    if (!open) return;
    sideRef.current = undefined;
    update();

    let frame = 0;
    const loop = () => {
      update();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  return style;
}
