import { describe, expect, it, vi } from 'vitest';

import {
  COVER_MAX_EDGE,
  prepareCoverImage,
  scaleToFit,
  UnreadableImageError,
} from './image-resize';

describe('scaleToFit', () => {
  it('não amplia imagem menor que o limite', () => {
    expect(scaleToFit({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });

  it('reduz pelo maior lado, mantendo a proporção', () => {
    expect(scaleToFit({ width: 3200, height: 1600 })).toEqual({
      width: COVER_MAX_EDGE,
      height: 800,
    });
    expect(scaleToFit({ width: 1000, height: 4000 })).toEqual({
      width: 400,
      height: COVER_MAX_EDGE,
    });
  });

  it('nunca devolve lado zero', () => {
    expect(scaleToFit({ width: 20_000, height: 1 })).toEqual({ width: COVER_MAX_EDGE, height: 1 });
  });
});

const file = (type = 'image/png') => new File(['bytes'], 'capa.png', { type });

describe('prepareCoverImage', () => {
  it('envia o arquivo original quando o navegador não sabe redimensionar', async () => {
    const source = file();
    const prepared = await prepareCoverImage(source);
    expect(prepared.blob).toBe(source);
    expect(prepared.resized).toBe(false);
    expect(prepared.width).toBeNull();
  });

  it('avisa quando a imagem não pode ser lida', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('inválida'))),
    );
    await expect(prepareCoverImage(file())).rejects.toBeInstanceOf(UnreadableImageError);
    vi.unstubAllGlobals();
  });

  it('redimensiona e recodifica quando o maior lado passa do limite', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 3200, height: 1600, close })),
    );
    const resized = new Blob(['menor'], { type: 'image/png' });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(resized);
    });

    const prepared = await prepareCoverImage(file());

    expect(prepared.resized).toBe(true);
    expect(prepared.blob).toBe(resized);
    expect(prepared.contentType).toBe('image/png');
    expect(prepared).toMatchObject({ width: COVER_MAX_EDGE, height: 800 });
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('mantém o arquivo original quando a imagem já cabe no limite', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 640, height: 480, close })),
    );
    const source = file();

    const prepared = await prepareCoverImage(source);

    expect(prepared.blob).toBe(source);
    expect(prepared).toMatchObject({ width: 640, height: 480, resized: false });
    vi.unstubAllGlobals();
  });
});
