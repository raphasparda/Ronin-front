/**
 * Redimensionamento da capa no navegador antes do upload direto para o R2
 * (ADR 0016, api.md §18.7 item 58): o maior lado fica em no máximo 1600 px.
 * O limite de tamanho e a lista de tipos continuam valendo no servidor.
 */

export const COVER_MAX_EDGE = 1600;

/** Qualidade da recodificação com perdas (JPEG/WebP/AVIF). */
const QUALITY = 0.85;

export interface ImageSize {
  width: number;
  height: number;
}

/** Reduz proporcionalmente até o maior lado caber em `maxEdge`. Nunca amplia. */
export function scaleToFit(size: ImageSize, maxEdge = COVER_MAX_EDGE): ImageSize {
  const largest = Math.max(size.width, size.height);
  if (largest <= maxEdge || largest === 0) return { width: size.width, height: size.height };
  const ratio = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}

export interface PreparedImage {
  /** Bytes a enviar ao R2 (o arquivo original quando não houve redimensionamento). */
  blob: Blob;
  contentType: string;
  /** Dimensões do que vai ser enviado; `null` quando o navegador não consegue medir. */
  width: number | null;
  height: number | null;
  resized: boolean;
}

/** Imagem que o navegador não consegue decodificar (arquivo corrompido ou formato mentiroso). */
export class UnreadableImageError extends Error {
  constructor() {
    super('Não foi possível ler a imagem.');
    this.name = 'UnreadableImageError';
  }
}

function canResize(): boolean {
  return typeof createImageBitmap === 'function' && typeof HTMLCanvasElement !== 'undefined';
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, QUALITY);
  });
}

const original = (file: File, size: ImageSize | null): PreparedImage => ({
  blob: file,
  contentType: file.type,
  width: size?.width ?? null,
  height: size?.height ?? null,
  resized: false,
});

/**
 * Prepara a capa: decodifica, reduz para `maxEdge` e recodifica no mesmo formato.
 * Sem suporte a `createImageBitmap`/canvas (ou se a recodificação falhar), envia o arquivo
 * original — o servidor ainda recusa o que estiver fora da regra.
 */
export async function prepareCoverImage(
  file: File,
  maxEdge = COVER_MAX_EDGE,
): Promise<PreparedImage> {
  if (!canResize()) return original(file, null);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnreadableImageError();
  }

  try {
    const source: ImageSize = { width: bitmap.width, height: bitmap.height };
    const target = scaleToFit(source, maxEdge);
    if (target.width === source.width && target.height === source.height) {
      return original(file, source);
    }

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) return original(file, source);
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await toBlob(canvas, file.type);
    if (!blob || blob.size === 0) return original(file, source);
    return {
      blob,
      contentType: blob.type === '' ? file.type : blob.type,
      width: target.width,
      height: target.height,
      resized: true,
    };
  } finally {
    bitmap.close();
  }
}
