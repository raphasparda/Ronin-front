import { CARD_COVER_MAX_BYTES } from '@raphasparda/ronin-shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { authHandlers, sessionFixture, sessionWithoutCovers } from '../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  CARD_IDS,
  coverStorage,
  memberSession,
  R2_ORIGIN,
  seedCover,
  seedRestrictedCard,
  signInAsMember,
} from '../../test/board-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { cardPath } from './cards-api';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

/** As rotas são lazy: carregar os módulos antes evita estourar o tempo do primeiro `findBy`. */
beforeAll(async () => {
  await Promise.all([import('../boards/BoardPage'), import('./CardDetailRoute')]);
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

const openCampaign = async (user: User) => {
  await user.click(await screen.findByRole('link', { name: /^Publicar campanha/ }));
  return screen.findByRole('dialog', { name: 'Publicar campanha' });
};

const chooseFile = async (
  user: User,
  dialog: HTMLElement,
  file: File,
  label: 'Adicionar capa' | 'Trocar capa' = 'Adicionar capa',
) => {
  await user.upload(within(dialog).getByLabelText(label), file);
};

describe('Capa do card', () => {
  it('sem features.cardCovers, o botão "Adicionar capa" não existe', async () => {
    const user = userEvent.setup();
    coverStorage.enabled = false;
    server.use(authHandlers.me(sessionWithoutCovers));
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCampaign(user);

    expect(within(dialog).queryByText('Adicionar capa')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Capa' })).not.toBeInTheDocument();
  });

  it('envia o arquivo, confirma na API e mostra a capa no detalhe e na face', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCampaign(user);
    await chooseFile(user, dialog, imageFile());

    await waitFor(() => expect(toastMessages()).toContain('Capa adicionada.'));
    const cover = await within(dialog).findByRole('img', { name: 'Capa do card' });
    expect(cover).toHaveAttribute('src', expect.stringContaining(R2_ORIGIN));

    const upload = boardRequests('r2/upload').at(-1)?.body as { objectKey: string };
    expect(upload.objectKey.startsWith(`covers/${CARD_IDS.campaign}/`)).toBe(true);
    expect(boardRequests('cards/cover').at(-1)?.body).toMatchObject({
      objectKey: upload.objectKey,
    });

    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    const face = await screen.findByRole('link', { name: /^Publicar campanha/ });
    // A face usa a versão decorativa (alt vazio) e reserva o espaço antes de carregar.
    const thumb = face.querySelector('img');
    expect(thumb).toHaveAttribute('alt', '');
    expect(thumb).toHaveAttribute('loading', 'lazy');
    expect(thumb?.parentElement?.className).toContain('aspect-[16/9]');
  });

  it('arquivo grande demais é barrado antes de qualquer envio', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCampaign(user);
    await chooseFile(user, dialog, imageFile({ size: CARD_COVER_MAX_BYTES + 1 }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A imagem tem 5,0 MB. O limite é 5 MB.',
    );
    expect(boardRequests('cards/cover/upload-url')).toHaveLength(0);
    expect(boardRequests('r2/upload')).toHaveLength(0);
  });

  it('formato não aceito é barrado antes de qualquer envio', async () => {
    // `applyAccept: false` simula o arquivo renomeado que passa pelo seletor do sistema.
    const user = userEvent.setup({ applyAccept: false });
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCampaign(user);
    await chooseFile(user, dialog, imageFile({ type: 'image/gif', name: 'capa.gif' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Formato não aceito. Use JPEG, PNG ou WebP.',
    );
    expect(boardRequests('cards/cover/upload-url')).toHaveLength(0);
  });

  it('falha no PUT do R2 mostra erro e não cria capa', async () => {
    const user = userEvent.setup();
    server.use(http.put(`${R2_ORIGIN}/*`, () => new HttpResponse(null, { status: 403 })));
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCampaign(user);
    await chooseFile(user, dialog, imageFile());

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível enviar a capa. Tente de novo.',
    );
    expect(boardRequests('cards/cover')).toHaveLength(0);
    expect(within(dialog).queryByRole('img', { name: 'Capa do card' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Adicionar capa')).toBeInTheDocument();
  });

  it('R2 fora do ar responde 503 e a mensagem é específica', async () => {
    const user = userEvent.setup();
    coverStorage.enabled = false;
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCampaign(user);
    await chooseFile(user, dialog, imageFile());

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'As capas de card não estão disponíveis agora.',
    );
  });

  it('remover pede confirmação e devolve o card ao estado sem capa', async () => {
    const user = userEvent.setup();
    seedCover(CARD_IDS.campaign);
    renderApp(cardPath(BOARD_ID, CARD_IDS.campaign));

    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    expect(await within(dialog).findByRole('img', { name: 'Capa do card' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remover capa' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remover a capa deste card?' });
    expect(
      within(confirm).getByText('A imagem é apagada e não dá para desfazer.'),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Remover capa' }));

    await waitFor(() => expect(toastMessages()).toContain('Capa removida.'));
    await waitFor(() =>
      expect(within(dialog).queryByRole('img', { name: 'Capa do card' })).not.toBeInTheDocument(),
    );
    expect(boardDb.cards.find((card) => card.id === CARD_IDS.campaign)?.cover).toBeNull();
  });

  it('cancelar a confirmação não remove nada', async () => {
    const user = userEvent.setup();
    seedCover(CARD_IDS.campaign);
    renderApp(cardPath(BOARD_ID, CARD_IDS.campaign));

    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    await user.click(await within(dialog).findByRole('button', { name: 'Remover capa' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remover a capa deste card?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    expect(boardRequests('cards/cover/delete')).toHaveLength(0);
    expect(within(dialog).getByRole('img', { name: 'Capa do card' })).toBeInTheDocument();
  });

  it('trocar a capa substitui a imagem anterior', async () => {
    const user = userEvent.setup();
    const previous = seedCover(CARD_IDS.campaign);
    renderApp(cardPath(BOARD_ID, CARD_IDS.campaign));

    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    await chooseFile(
      user,
      dialog,
      imageFile({ type: 'image/webp', name: 'nova.webp' }),
      'Trocar capa',
    );

    await waitFor(() => expect(toastMessages()).toContain('Capa trocada.'));
    expect(boardDb.storage.has(previous)).toBe(false);
    expect(boardDb.cards.find((card) => card.id === CARD_IDS.campaign)?.cover?.url).not.toContain(
      previous,
    );
  });

  it('card bloqueado nunca mostra capa nem sinal de que ela existe', async () => {
    seedCover(CARD_IDS.budget);
    server.use(authHandlers.me(memberSession));
    signInAsMember();
    seedRestrictedCard(CARD_IDS.budget, [sessionFixture.user.id]);
    renderApp(`/b/${BOARD_ID}`);

    const face = await screen.findByRole('button', {
      name: 'Card restrito: Revisar orçamento. Você não tem acesso.',
    });
    expect(face.querySelector('img')).toBeNull();
    expect(document.querySelectorAll(`img[src*="${R2_ORIGIN}"]`)).toHaveLength(0);
  });

  it('quadro arquivado mostra a capa, mas não deixa trocar', async () => {
    seedCover(CARD_IDS.campaign);
    boardDb.boards = boardDb.boards.map((board) =>
      board.id === BOARD_ID ? { ...board, archivedAt: new Date().toISOString() } : board,
    );
    renderApp(cardPath(BOARD_ID, CARD_IDS.campaign));

    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    expect(await within(dialog).findByRole('img', { name: 'Capa do card' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Trocar capa')).not.toBeInTheDocument();
    expect(
      within(dialog).getByText('Este quadro está arquivado. Restaure o quadro para mudar a capa.'),
    ).toBeInTheDocument();
  });
});
