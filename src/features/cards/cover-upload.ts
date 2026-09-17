/**
 * Envio direto do navegador para o R2 com a URL assinada (ADR 0016, passo 2 de 3).
 * Fora do `api-client`: outra origem, sem cookie de sessão, sem header CSRF e com progresso.
 */

/** Falha do `PUT` no armazenamento (rede, CORS, assinatura vencida, 4xx/5xx do R2). */
export class CoverUploadError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('Não foi possível enviar a capa.');
    this.name = 'CoverUploadError';
    this.status = status;
  }
}

export interface PutCoverOptions {
  uploadUrl: string;
  blob: Blob;
  /** Headers assinados pela API (ao menos o `Content-Type`). */
  headers: Record<string, string>;
  /** Percentual inteiro, ou `null` quando o tamanho total não é conhecido. */
  onProgress?: (percent: number | null) => void;
  signal?: AbortSignal;
}

export async function putCoverToStorage({
  uploadUrl,
  blob,
  headers,
  onProgress,
  signal,
}: PutCoverOptions): Promise<void> {
  // Envia os bytes crus: o `Content-Type` já vem assinado pela API, e um `ArrayBuffer` funciona
  // em todo `XMLHttpRequest` (inclusive no jsdom dos testes, que não lê `Blob` de outra origem).
  const body = await blob.arrayBuffer();

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl, true);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);

    const abort = () => request.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const done = () => signal?.removeEventListener('abort', abort);

    request.upload.onprogress = (event) => {
      onProgress?.(event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : null);
    };
    request.onload = () => {
      done();
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new CoverUploadError(request.status));
    };
    request.onerror = () => {
      done();
      reject(new CoverUploadError(0));
    };
    request.onabort = () => {
      done();
      reject(new DOMException('Envio cancelado.', 'AbortError'));
    };

    request.send(body);
  });
}
