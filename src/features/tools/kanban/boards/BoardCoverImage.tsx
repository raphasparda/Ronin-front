import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../../../components/ui/Button';
import { COVER_MESSAGES } from './board-messages';

export interface BoardCoverImageProps {
  /** URL assinada de curta duração (nunca é gravada nem copiável pela UI). */
  url: string;
  width: number | null;
  height: number | null;
}

interface LoadState {
  /** URL em que o estado se aplica: URL nova recomeça do zero. */
  url: string;
  failed: boolean;
  attempt: number;
}

/** Estado de carregamento por URL: trocar a capa (ou renovar a assinatura) tenta de novo. */
function useLoadState(url: string) {
  const [state, setState] = useState<LoadState>({ url, failed: false, attempt: 0 });
  const current = state.url === url ? state : { url, failed: false, attempt: 0 };
  if (state.url !== url) setState(current);
  return {
    ...current,
    fail: () => setState({ url, failed: true, attempt: current.attempt }),
    retry: () => setState({ url, failed: false, attempt: current.attempt + 1 }),
  };
}

/**
 * Capa no tile da lista de quadros: decorativa (`alt=""`, o nome já identifica o quadro),
 * recorte pelo centro e altura reservada para a grade não pular. Falhou, o espaço some.
 */
export function BoardCoverThumb({ url, width, height }: BoardCoverImageProps) {
  const { failed, fail } = useLoadState(url);

  if (failed) return null;

  return (
    <span className="block aspect-[16/6] overflow-hidden rounded-t-xl bg-surface-sunken">
      <img
        src={url}
        alt=""
        width={width ?? undefined}
        height={height ?? undefined}
        loading="lazy"
        decoding="async"
        onError={fail}
        className="size-full object-cover"
      />
    </span>
  );
}

/**
 * Faixa de capa no topo do quadro: discreta (altura baixa e fixa) para não empurrar as listas.
 * Se a imagem falhar, aparece o aviso com a opção de recarregar, sem derrubar o resto da tela.
 */
export function BoardCoverBanner({ url, width, height }: BoardCoverImageProps) {
  const { failed, attempt, fail, retry } = useLoadState(url);

  if (failed) {
    return (
      <div
        role="status"
        className="flex h-20 flex-wrap items-center justify-center gap-2 rounded-lg bg-surface-sunken px-4 text-muted sm:h-24"
      >
        <ImageOff aria-hidden size={18} />
        <p>{COVER_MESSAGES.loadFailed}</p>
        <Button variant="secondary" size="sm" onClick={retry}>
          {COVER_MESSAGES.reload}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-20 overflow-hidden rounded-lg bg-surface-sunken sm:h-24">
      <img
        key={attempt}
        src={url}
        alt={COVER_MESSAGES.alt}
        width={width ?? undefined}
        height={height ?? undefined}
        decoding="async"
        onError={fail}
        className="size-full object-cover"
      />
    </div>
  );
}
