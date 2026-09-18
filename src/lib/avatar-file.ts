import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE_PX,
  type AvatarContentType,
  type UpdateAvatarRequest,
} from '@raphasparda/ronin-shared';

export const AVATAR_NOT_AN_IMAGE_MESSAGE = 'Escolha um arquivo de imagem (PNG, JPEG ou WebP).';
export const AVATAR_UNREADABLE_MESSAGE = 'Não foi possível ler a imagem. Tente outro arquivo.';
export const AVATAR_TOO_HEAVY_MESSAGE =
  'Não foi possível comprimir essa imagem o bastante. Tente uma menor.';

/** Erro esperado ao preparar a foto: a mensagem já é para o usuário. */
export class AvatarFileError extends Error {}

/** Tentativas de compressão, da melhor para a mais leve. WebP primeiro; JPEG cobre navegador sem WebP. */
const ATTEMPTS: ReadonlyArray<{ type: AvatarContentType; quality: number }> = [
  { type: 'image/webp', quality: 0.85 },
  { type: 'image/webp', quality: 0.7 },
  { type: 'image/jpeg', quality: 0.8 },
  { type: 'image/jpeg', quality: 0.6 },
];

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Blob → base64 sem o prefixo `data:`. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AvatarFileError(AVATAR_UNREADABLE_MESSAGE));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const data = result.slice(result.indexOf(',') + 1);
      if (data === '') reject(new AvatarFileError(AVATAR_UNREADABLE_MESSAGE));
      else resolve(data);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Arquivo escolhido → corpo de `PUT /api/me/avatar`: recorte central quadrado, `AVATAR_SIZE_PX` de
 * lado, comprimido até caber em `AVATAR_MAX_BYTES`. O recorte e a compressão acontecem aqui porque
 * a API só aceita JSON e um corpo pequeno (overview.md §6.3).
 */
export async function prepareAvatar(file: File): Promise<UpdateAvatarRequest> {
  if (!file.type.startsWith('image/')) throw new AvatarFileError(AVATAR_NOT_AN_IMAGE_MESSAGE);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarFileError(AVATAR_UNREADABLE_MESSAGE);
  }

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const context = canvas.getContext('2d');
  if (!context) throw new AvatarFileError(AVATAR_UNREADABLE_MESSAGE);

  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE_PX,
    AVATAR_SIZE_PX,
  );
  bitmap.close();

  for (const { type, quality } of ATTEMPTS) {
    const blob = await toBlob(canvas, type, quality);
    // Navegador sem suporte ao formato devolve outro (PNG): o `contentType` tem que ser o real.
    if (!blob || blob.type !== type || blob.size > AVATAR_MAX_BYTES) continue;
    return { contentType: type, data: await toBase64(blob) };
  }
  throw new AvatarFileError(AVATAR_TOO_HEAVY_MESSAGE);
}
