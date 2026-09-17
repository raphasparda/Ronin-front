import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { MEMBER_ID } from '../../test/admin-handlers';
import { authHandlers, sessionFixture } from '../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  CARD_IDS,
  memberSession,
  seedRestrictedCard,
  signInAsMember,
} from '../../test/board-handlers';
import {
  makeNotification,
  seedNotifications,
  notificationDb,
} from '../../test/notification-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { cardPath } from './cards-api';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

/** As rotas são lazy: carregar os módulos antes evita estourar o tempo do primeiro `findBy`. */
beforeAll(async () => {
  await Promise.all([
    import('../boards/BoardPage'),
    import('./CardDetailRoute'),
    import('../my-cards/MyCardsPage'),
  ]);
});

/** Entra como Bruno Lima (Member) e restringe "Revisar orçamento" só para a Ana. */
function lockBudgetForMember(): void {
  server.use(authHandlers.me(memberSession));
  signInAsMember();
  seedRestrictedCard(CARD_IDS.budget, [sessionFixture.user.id]);
}

const lockedFace = () =>
  screen.findByRole('button', {
    name: 'Card restrito: Revisar orçamento. Você não tem acesso.',
  });

describe('Card bloqueado no quadro', () => {
  it('mostra título e cadeado, sem link, sem menu e sem nada do conteúdo', async () => {
    lockBudgetForMember();
    renderApp(`/b/${BOARD_ID}`);

    const face = await lockedFace();
    expect(within(face).getByText('Revisar orçamento')).toBeInTheDocument();
    expect(within(face).getByText('Card restrito')).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Cards de Fazendo' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')?.split('. ')[0]),
    ).toEqual(['Publicar campanha', 'Fechar relatório']);
    expect(
      screen.queryByRole('button', { name: 'Ações do card Revisar orçamento' }),
    ).not.toBeInTheDocument();
    // Nada do conteúdo do card bloqueado: a etiqueta aplicada nele não aparece na face.
    expect(within(face).queryByText('Financeiro')).not.toBeInTheDocument();
  });

  it('clicar explica que o card não abre, e o detalhe continua fechado', async () => {
    const user = userEvent.setup();
    lockBudgetForMember();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(await lockedFace());

    expect(toastMessages()).toContain(
      'Card restrito. Só quem está na lista de acesso pode abrir. Fale com quem participa do card ou com um administrador.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('conta no total da lista, mesmo bloqueado', async () => {
    lockBudgetForMember();
    renderApp(`/b/${BOARD_ID}`);

    const column = await screen.findByRole('region', { name: 'Fazendo' });
    expect(within(column).getByText('3')).toBeInTheDocument();
    expect(await lockedFace()).toBeInTheDocument();
  });

  it('casa com a busca por texto do título e continua no total', async () => {
    lockBudgetForMember();
    renderApp(`/b/${BOARD_ID}?q=or%C3%A7amento`);

    const column = await screen.findByRole('region', { name: 'Fazendo' });
    expect(await lockedFace()).toBeInTheDocument();
    expect(within(column).getByText('1 de 3')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Cards restritos aos quais você não tem acesso não entram nos filtros de responsável, etiqueta, prioridade e prazo.',
      ),
    ).toBeInTheDocument();
  });

  it('some com qualquer outro filtro ativo, sem sair da contagem', async () => {
    lockBudgetForMember();
    renderApp(`/b/${BOARD_ID}?prioridade=none`);

    const column = await screen.findByRole('region', { name: 'Fazendo' });
    expect(await screen.findByRole('link', { name: /^Publicar campanha/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Card restrito: Revisar orçamento. Você não tem acesso.',
      }),
    ).not.toBeInTheDocument();
    expect(within(column).getByText('2 de 3')).toBeInTheDocument();
  });

  it('abrir o card pela URL mostra "Você não tem acesso a este card"', async () => {
    const user = userEvent.setup();
    lockBudgetForMember();
    renderApp(cardPath(BOARD_ID, CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('heading', { name: 'Você não tem acesso a este card' }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Voltar para o quadro' }));

    expect(await lockedFace()).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('em itens arquivados vem com cadeado, sem a lista de origem e sem ações', async () => {
    const user = userEvent.setup();
    lockBudgetForMember();
    boardDb.cards = boardDb.cards.map((card) =>
      card.id === CARD_IDS.budget ? { ...card, archivedAt: new Date().toISOString() } : card,
    );
    renderApp(`/b/${BOARD_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Opções do quadro' }));
    await user.click(screen.getByRole('menuitem', { name: 'Itens arquivados…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Itens arquivados' });
    const cards = await within(dialog).findByRole('list', { name: 'Cards arquivados' });
    expect(within(cards).getByText('Revisar orçamento')).toBeInTheDocument();
    expect(within(cards).getByText('Card restrito')).toBeInTheDocument();
    expect(within(cards).getByText('Você não tem acesso a este card.')).toBeInTheDocument();
    expect(
      within(cards).getByRole('button', { name: 'Restaurar card Revisar orçamento' }),
    ).toBeDisabled();
    // Sem a lista de origem: o card bloqueado não traz nenhum outro campo.
    expect(within(cards).queryByText('Fazendo')).not.toBeInTheDocument();
  });

  it('não aparece em Meus cards nem nas notificações', async () => {
    lockBudgetForMember();
    boardDb.cards = boardDb.cards.map((card) =>
      card.id === CARD_IDS.budget ? { ...card, assigneeIds: [MEMBER_ID] } : card,
    );
    seedNotifications([makeNotification()]);
    renderApp('/meus-cards');

    expect(await screen.findByText('Nada com você agora')).toBeInTheDocument();
    expect(screen.queryByText('Revisar orçamento')).not.toBeInTheDocument();
    // A notificação continua no "banco" (RN40 filtra na leitura), mas some do contador.
    expect(notificationDb.notifications).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeInTheDocument();
  });
});

describe('Quem pode ver este card', () => {
  const openCard = async (user: User, title: string) => {
    await user.click(await screen.findByRole('link', { name: new RegExp(`^${title}`) }));
    return screen.findByRole('dialog', { name: title });
  };

  it('restringir inclui responsáveis na lista e avisa quantas pessoas veem', async () => {
    const user = userEvent.setup();
    boardDb.cards = boardDb.cards.map((card) =>
      card.id === CARD_IDS.campaign ? { ...card, assigneeIds: [MEMBER_ID] } : card,
    );
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCard(user, 'Publicar campanha');
    await user.click(within(dialog).getByRole('radio', { name: /Restrito a pessoas específicas/ }));

    const people = await within(dialog).findByRole('list', { name: 'Quem pode ver este card' });
    await waitFor(() =>
      expect(
        within(people)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([expect.stringContaining('Ana Souza'), expect.stringContaining('Bruno Lima')]),
    );
    expect(toastMessages()).toContain('Card restrito. 2 pessoas têm acesso.');
    expect(boardRequests('cards/visibility').map((item) => item.body)).toEqual([
      { visibility: 'restricted' },
    ]);
    expect(
      within(dialog).getByText(
        'O card continua aparecendo no quadro para todo mundo, com o título e um cadeado. Evite informação sensível no título.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Administradores sempre têm acesso.')).toBeInTheDocument();

    // Responsável não pode perder o acesso antes de deixar de ser responsável (RN32).
    expect(
      within(people).getByRole('button', { name: 'Remover acesso de Bruno Lima' }),
    ).toBeDisabled();
  });

  it('adiciona e remove pessoas da lista de acesso', async () => {
    const user = userEvent.setup();
    seedRestrictedCard(CARD_IDS.campaign, [sessionFixture.user.id]);
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCard(user, 'Publicar campanha');
    await user.click(await within(dialog).findByRole('button', { name: 'Adicionar pessoa' }));
    await user.click(await screen.findByRole('button', { name: /Bruno Lima/ }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Bruno Lima agora tem acesso a este card.'),
    );
    const people = within(dialog).getByRole('list', { name: 'Quem pode ver este card' });
    expect(within(people).getAllByRole('listitem')).toHaveLength(2);

    await user.click(within(people).getByRole('button', { name: 'Remover acesso de Bruno Lima' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Bruno Lima não tem mais acesso a este card.'),
    );
    expect(boardRequests('cards/viewers/remove')).toHaveLength(1);
  });

  it('sair do card pede confirmação e fecha o detalhe', async () => {
    const user = userEvent.setup();
    server.use(authHandlers.me(memberSession));
    signInAsMember();
    seedRestrictedCard(CARD_IDS.campaign, [MEMBER_ID, sessionFixture.user.id]);
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCard(user, 'Publicar campanha');
    await user.click(
      await within(dialog).findByRole('button', { name: 'Remover acesso de Bruno Lima' }),
    );

    const confirm = await screen.findByRole('dialog', { name: 'Tirar o seu acesso a este card?' });
    await user.click(within(confirm).getByRole('button', { name: 'Sair do card' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Bruno Lima não tem mais acesso a este card.'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Publicar campanha' })).not.toBeInTheDocument(),
    );
  });

  it('a última pessoa da lista não pode ser removida', async () => {
    const user = userEvent.setup();
    seedRestrictedCard(CARD_IDS.campaign, [sessionFixture.user.id]);
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCard(user, 'Publicar campanha');
    const remove = await within(dialog).findByRole('button', {
      name: 'Remover acesso de Ana Souza',
    });

    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute(
      'title',
      'A lista precisa ter pelo menos uma pessoa. Adicione alguém ou torne o card visível para a equipe.',
    );
  });

  it('voltar para a equipe esvazia a lista de acesso', async () => {
    const user = userEvent.setup();
    seedRestrictedCard(CARD_IDS.campaign, [sessionFixture.user.id, MEMBER_ID]);
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCard(user, 'Publicar campanha');
    await user.click(await within(dialog).findByRole('radio', { name: /Visível para a equipe/ }));

    await waitFor(() => expect(toastMessages()).toContain('Card visível para a equipe.'));
    expect(
      within(dialog).queryByRole('list', { name: 'Quem pode ver este card' }),
    ).not.toBeInTheDocument();
  });

  it('atribuir alguém a um card restrito dá acesso na mesma ação', async () => {
    const user = userEvent.setup();
    seedRestrictedCard(CARD_IDS.campaign, [sessionFixture.user.id]);
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openCard(user, 'Publicar campanha');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
    await user.click(await screen.findByRole('checkbox', { name: /Bruno Lima/ }));

    await waitFor(() =>
      expect(toastMessages()).toContain(
        'Bruno Lima foi adicionada aos responsáveis e ganhou acesso a este card.',
      ),
    );
    await waitFor(() => {
      const people = within(dialog).getByRole('list', { name: 'Quem pode ver este card' });
      expect(within(people).getAllByRole('listitem')).toHaveLength(2);
    });
  });
});
