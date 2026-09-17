import { BOARD_COVER_MAX_BYTES } from '@raphasparda/ronin-shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { authHandlers, sessionWithoutCovers } from '../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  coverStorage,
  R2_ORIGIN,
  seedBoardCover,
} from '../../test/board-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

/** As rotas são lazy: carregar o módulo antes evita estourar o tempo do primeiro `findBy`. */
beforeAll(async () => {
  await import('./BoardPage');
});

interface FakeImage {
  type?: string;
  size?: number;
  name?: string;
}

/** Arquivo de imagem com o tamanho que o teste precisa (sem gerar bytes de verdade). */
function imageFile({ type = 'image/png', size = 1024, name = 'capa.png' }: FakeImage = {}): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

async function openCoverDialog(user: User) {
  await screen.findByRole('heading', { level: 1, name: 'Marketing' });
  await user.click(screen.getByRole('button', { name: 'Opções do quadro' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Capa do quadro…' }));
  return screen.findByRole('dialog', { name: 'Capa do quadro' });
}

const chooseFile = (
  user: User,
  dialog: HTMLElement,
  file: File,
  label: 'Adicionar capa' | 'Trocar capa' = 'Adicionar capa',
) => user.upload(within(dialog).getByLabelText(label), file);

const boardCover = () => boardDb.boards.find((item) => item.id === BOARD_ID)?.cover;

describe('Capa do quadro', () => {
  it('sem features.boardCovers, o ⋯ do quadro não oferece a capa', async () => {
    coverStorage.enabled = false;
    server.use(authHandlers.me(sessionWithoutCovers));
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await screen.findByRole('heading', { level: 1, name: 'Marketing' });
    await user.click(screen.getByRole('button', { name: 'Opções do quadro' }));

    expect(screen.queryByRole('menuitem', { name: 'Capa do quadro…' })).not.toBeInTheDocument();
    // O resto do menu continua igual.
    expect(await screen.findByRole('menuitem', { name: 'Etiquetas…' })).toBeVisible();
  });

  it('envia o arquivo, confirma na API e mostra a capa no topo do quadro', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await chooseFile(user, dialog, imageFile());

    await waitFor(() => expect(toastMessages()).toContain('Capa adicionada.'));

    const upload = boardRequests('r2/upload').at(-1)?.body as { objectKey: string };
    expect(upload.objectKey.startsWith(`covers/${BOARD_ID}/`)).toBe(true);
    expect(boardRequests('boards/cover').at(-1)?.body).toMatchObject({
      objectKey: upload.objectKey,
    });

    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    const cover = await screen.findByRole('img', { name: 'Capa do quadro' });
    expect(cover).toHaveAttribute('src', expect.stringContaining(R2_ORIGIN));
  });

  it('troca a capa: a imagem nova substitui a anterior', async () => {
    const previous = seedBoardCover(BOARD_ID);
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await chooseFile(user, dialog, imageFile({ name: 'outra.png' }), 'Trocar capa');

    await waitFor(() => expect(toastMessages()).toContain('Capa trocada.'));
    expect(boardCover()?.url).not.toContain(previous);
  });

  it('remove a capa depois de confirmar', async () => {
    seedBoardCover(BOARD_ID);
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Remover capa' }));

    const confirm = await screen.findByRole('dialog', { name: 'Remover a capa deste quadro?' });
    await user.click(within(confirm).getByRole('button', { name: 'Remover capa' }));

    await waitFor(() => expect(toastMessages()).toContain('Capa removida.'));
    expect(boardCover()).toBeNull();
    expect(boardRequests('boards/cover/delete')).toHaveLength(1);
  });

  it('cancelar a confirmação não remove nada', async () => {
    seedBoardCover(BOARD_ID);
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Remover capa' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remover a capa deste quadro?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    expect(boardCover()).not.toBeNull();
    expect(boardRequests('boards/cover/delete')).toHaveLength(0);
  });

  it('formato não aceito nem chega a pedir a URL de envio', async () => {
    // `applyAccept: false` simula o arquivo renomeado que passa pelo seletor do sistema.
    const user = userEvent.setup({ applyAccept: false });
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await chooseFile(user, dialog, imageFile({ type: 'image/gif', name: 'animada.gif' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Formato não aceito. Use JPEG, PNG ou WebP.',
    );
    expect(boardRequests('boards/cover/upload-url')).toHaveLength(0);
    expect(boardCover()).toBeNull();
  });

  it('arquivo acima de 5 MB é recusado com o tamanho na mensagem', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await chooseFile(user, dialog, imageFile({ size: BOARD_COVER_MAX_BYTES + 1024 * 1024 }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('O limite é 5 MB.');
    expect(boardRequests('boards/cover/upload-url')).toHaveLength(0);
  });

  it('R2 fora do ar: a capa continua como estava e a mensagem explica', async () => {
    coverStorage.enabled = false;
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);
    await chooseFile(user, dialog, imageFile());

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'As capas de quadro não estão disponíveis agora.',
    );
    expect(boardCover()).toBeNull();
  });

  it('quadro arquivado mostra a capa mas não deixa trocar', async () => {
    seedBoardCover(BOARD_ID);
    boardDb.boards = boardDb.boards.map((board) =>
      board.id === BOARD_ID ? { ...board, archivedAt: '2026-01-01T00:00:00.000Z' } : board,
    );
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCoverDialog(user);

    expect(within(dialog).getByRole('img', { name: 'Capa do quadro' })).toBeVisible();
    expect(within(dialog).queryByLabelText('Trocar capa')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Restaure o quadro para mudar a capa/)).toBeVisible();
  });
});
