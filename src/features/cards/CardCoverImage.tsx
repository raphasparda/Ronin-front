import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { COVER_MESSAGES } from './card-messages';

/** Proporção fixa da capa: o espaço é reservado antes de a imagem carregar (scope §11.8). */
const ASPECT = 'aspect-[16/9]';

export interface CardCoverImageProps {
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
 * Capa na face do card: decorativa (`alt=""`, o título já identifica o card), recorte pelo
 * centro, `loading="lazy"` e altura reservada para o quadro não pular. Se a imagem falhar, o
 * espaço some e o resto da face continua igual.
 */
export function CardCoverThumb({ url, width, height }: CardCoverImageProps) {
  const { failed, fail } = useLoadState(url);

  if (failed) return null;

  return (
    <span className={`-mx-1 -mt-1 block overflow-hidden rounded-md bg-surface-sunken ${ASPECT}`}>
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

/** Capa no topo do detalhe, com estado de falha e opção de recarregar (scope §11.11). */
export function CardCoverPreview({ url, width, height }: CardCoverImageProps) {
  const { failed, attempt, fail, retry } = useLoadState(url);

  if (failed) {
    return (
      <div
        role="status"
        className={`flex flex-col items-center justify-center gap-2 rounded-lg bg-surface-sunken p-4 text-muted ${ASPECT}`}
      >
        <ImageOff aria-hidden size={20} />
        <p>{COVER_MESSAGES.loadFailed}</p>
        <Button variant="secondary" size="sm" onClick={retry}>
          {COVER_MESSAGES.reload}
        </Button>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg bg-surface-sunken ${ASPECT}`}>
      <img
        key={attempt}
        src={url}
        alt={COVER_MESSAGES.detailAlt}
        width={width ?? undefined}
        height={height ?? undefined}
        decoding="async"
        onError={fail}
        className="size-full object-cover"
      />
    </div>
  );
}
