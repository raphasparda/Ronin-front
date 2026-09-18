import { AVATAR_MAX_BYTES, AVATAR_SIZE_PX } from '@raphasparda/ronin-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AvatarFileError,
  AVATAR_NOT_AN_IMAGE_MESSAGE,
  AVATAR_TOO_HEAVY_MESSAGE,
  AVATAR_UNREADABLE_MESSAGE,
  prepareAvatar,
} from './avatar-file';

type DrawArgs = unknown[];

/** `createImageBitmap` + `canvas.getContext/toBlob`, que o jsdom não tem. */
function stubCanvas(options: {
  bitmap?: { width: number; height: number };
  /** Tamanho em bytes por tentativa, na ordem em que `prepareAvatar` tenta. */
  sizes?: number[];
  /** Tipo devolvido pelo navegador (simula quem não codifica WebP). */
  typeOf?: (requested: string) => string;
}): { draws: DrawArgs[] } {
  const {
    bitmap = { width: 800, height: 400 },
    sizes = [1_000],
    typeOf = (type) => type,
  } = options;
  const draws: DrawArgs[] = [];
  let attempt = 0;

  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ ...bitmap, close: () => undefined } as unknown as ImageBitmap),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: (...args: DrawArgs) => draws.push(args),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    const size = sizes[Math.min(attempt, sizes.length - 1)] ?? 1_000;
    attempt += 1;
    callback(new Blob([new Uint8Array(size)], { type: typeOf(type ?? '') }));
  });

  return { draws };
}

const imageFile = () => new File([new Uint8Array(10)], 'foto.png', { type: 'image/png' });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('prepareAvatar', () => {
  it('recorta o quadrado central, redimensiona e manda WebP em base64', async () => {
    const { draws } = stubCanvas({ bitmap: { width: 800, height: 400 } });

    const body = await prepareAvatar(imageFile());

    expect(body.contentType).toBe('image/webp');
    expect(Buffer.from(body.data, 'base64').length).toBe(1_000);
    // Origem em x = (800 − 400) / 2, lado 400, destino AVATAR_SIZE_PX.
    expect(draws[0]?.slice(1)).toEqual([200, 0, 400, 400, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX]);
  });

  it('comprime de novo enquanto passar do limite', async () => {
    stubCanvas({ sizes: [AVATAR_MAX_BYTES + 1, 5_000] });

    const body = await prepareAvatar(imageFile());

    expect(body.contentType).toBe('image/webp');
    expect(Buffer.from(body.data, 'base64').length).toBe(5_000);
  });

  it('usa JPEG quando o navegador não codifica WebP', async () => {
    stubCanvas({ typeOf: (type) => (type === 'image/webp' ? 'image/png' : type) });

    expect((await prepareAvatar(imageFile())).contentType).toBe('image/jpeg');
  });

  it('erro amigável: arquivo que não é imagem, imagem ilegível e imagem que não comprime', async () => {
    await expect(prepareAvatar(new File([''], 'a.txt', { type: 'text/plain' }))).rejects.toThrow(
      new AvatarFileError(AVATAR_NOT_AN_IMAGE_MESSAGE),
    );

    stubCanvas({ sizes: [AVATAR_MAX_BYTES + 1] });
    await expect(prepareAvatar(imageFile())).rejects.toThrow(
      new AvatarFileError(AVATAR_TOO_HEAVY_MESSAGE),
    );

    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('formato desconhecido')));
    await expect(prepareAvatar(imageFile())).rejects.toThrow(
      new AvatarFileError(AVATAR_UNREADABLE_MESSAGE),
    );
  });
});
