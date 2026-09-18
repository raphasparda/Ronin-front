import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../../../components/ui/toast-store';
import { apiErrorResponse, authHandlers, sessionFixture } from '../../../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  CARD_IDS,
  LIST_IDS,
  OTHER_LIST_IDS,
  seedActivities,
} from '../../../../test/board-handlers';
import { renderApp } from '../../../../test/render';
import { server } from '../../../../test/server';
import { cardQueryKey } from './cards-api';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

/** As rotas são lazy: carregar os módulos antes evita estourar o tempo do primeiro `findBy`. */
beforeAll(async () => {
  await Promise.all([import('../boards/BoardPage'), import('./CardDetailRoute')]);
});

async function cardTitles(listName: string): Promise<string[]> {
  const list = await screen.findByRole('list', { name: `Cards de ${listName}` });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.split('. ')[0] ?? '');
}

function queryCardTitles(listName: string): string[] {
  const list = screen.queryByRole('list', { name: `Cards de ${listName}` });
  if (!list) return [];
  return within(list)
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.split('. ')[0] ?? '');
}

async function openHistory(user: User, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole('tab', { name: 'Histórico' }));
  return within(dialog).findByRole('list', { name: 'Histórico do card' });
}

async function openMoveDialog(user: User, title: string) {
  await user.click(await screen.findByRole('button', { name: `Ações do card ${title}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Mover para…' }));
  return screen.getByRole('dialog', { name: 'Mover card' });
}

describe('Criação rápida de card', () => {
  it('Enter cria no fim, limpa e mantém o foco no campo', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(
      within(await screen.findByRole('region', { name: 'A fazer' })).getByRole('button', {
        name: 'Adicionar card',
      }),
    );
    const field = screen.getByRole('textbox', { name: 'Título do card' });
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription('Enter adiciona · Esc fecha');

    await user.type(field, 'Primeiro card{Enter}');
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    await user.type(field, 'Segundo card{Enter}');

    await waitFor(async () =>
      expect(await cardTitles('A fazer')).toEqual(['Primeiro card', 'Segundo card']),
    );
    expect(boardRequests('cards/create').map((request) => request.body)).toEqual([
      { title: 'Primeiro card' },
      { title: 'Segundo card' },
    ]);
    expect(screen.getByText('Card criado em A fazer.')).toBeInTheDocument();
    expect(field).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Título do card' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'A fazer' })).getByRole('button', {
          name: 'Adicionar card',
        }),
      ).toHaveFocus(),
    );
  });

  it('se a criação falha, o card some e o texto volta ao campo', async () => {
    server.use(http.post('/api/lists/:listId/cards', () => apiErrorResponse('INTERNAL_ERROR')));
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const column = await screen.findByRole('region', { name: 'A fazer' });
    await user.click(within(column).getByRole('button', { name: 'Adicionar card' }));
    await user.type(screen.getByRole('textbox', { name: 'Título do card' }), 'Vai falhar{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título do card' })).toHaveValue('Vai falhar'),
    );
    expect(toastMessages()).toContain(
      'Não foi possível criar o card. O texto continua no campo para você tentar de novo.',
    );
    expect(queryCardTitles('A fazer')).toEqual([]);
  });

  it('lista de conclusão não tem "Adicionar card"; quadro arquivado não cria nem move', async () => {
    renderApp(`/b/${BOARD_ID}`);

    const done = await screen.findByRole('region', { name: /Concluído/ });
    expect(within(done).queryByRole('button', { name: 'Adicionar card' })).not.toBeInTheDocument();
    expect(done).toHaveTextContent('Cards chegam aqui ao serem concluídos.');
  });
});

describe('Face do card', () => {
  it('mostra título, conclusão e descrição em texto, e abre o detalhe', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}`);

    expect(await cardTitles('Fazendo')).toEqual([
      'Revisar orçamento',
      'Publicar campanha',
      'Fechar relatório',
    ]);
    expect(screen.getByRole('link', { name: 'Fechar relatório. Concluído' })).toBeVisible();
    const campaign = screen.getByRole('link', { name: 'Publicar campanha. Tem descrição' });
    expect(campaign).toHaveStyle({ borderLeftColor: 'var(--palette-orange-bg)' });

    await user.click(campaign);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}/c/${CARD_IDS.campaign}`),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Publicar campanha' }),
    ).toHaveFocus();
  });

  /**
   * A Fatia 11 passou visibilidade e capa para o quadro: no card não sobra cadeado, campo de
   * capa nem painel de acesso, e toda face volta a ser link arrastável com menu de ações.
   */
  it('não tem cadeado, capa nem painel de acesso: todo card abre normalmente', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const list = await screen.findByRole('list', { name: 'Cards de Fazendo' });
    // Toda face é link (nenhuma é o botão de card bloqueado) e nenhuma anuncia restrição.
    const faces = within(list).getAllByRole('link');
    expect(faces).toHaveLength(3);
    for (const face of faces) {
      expect(face.getAttribute('aria-label')).not.toContain('restrito');
    }
    expect(within(list).queryByText('Card restrito')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ações do card Publicar campanha' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Publicar campanha. Tem descrição' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });

    expect(within(dialog).queryByRole('heading', { name: 'Capa' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Adicionar capa')).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('heading', { name: 'Quem pode ver este card' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('img', { name: 'Capa do card' })).not.toBeInTheDocument();
  });
});

describe('Mover para…', () => {
  it('gera placement para a primeira, o meio e a última posição', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    let dialog = await openMoveDialog(user, 'Fechar relatório');
    expect(within(dialog).getByLabelText('Quadro')).toHaveValue(BOARD_ID);
    expect(within(dialog).getByLabelText('Lista')).toHaveValue(LIST_IDS.doing);
    expect(within(dialog).getByLabelText('Posição')).toHaveValue('3');
    expect(within(dialog).getByRole('button', { name: 'Mover' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Posição'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));

    await waitFor(() =>
      expect(boardRequests('cards/move').at(-1)?.body).toEqual({
        toListId: LIST_IDS.doing,
        placement: { type: 'start' },
      }),
    );
    await waitFor(() => expect(toastMessages()).toContain('Card movido para Fazendo, posição 1.'));
    expect(await cardTitles('Fazendo')).toEqual([
      'Fechar relatório',
      'Revisar orçamento',
      'Publicar campanha',
    ]);

    dialog = await openMoveDialog(user, 'Fechar relatório');
    await user.selectOptions(within(dialog).getByLabelText('Posição'), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));
    await waitFor(() =>
      expect(boardRequests('cards/move').at(-1)?.body).toEqual({
        toListId: LIST_IDS.doing,
        placement: { type: 'after', id: CARD_IDS.budget },
      }),
    );

    dialog = await openMoveDialog(user, 'Revisar orçamento');
    await user.selectOptions(within(dialog).getByLabelText('Posição'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));
    await waitFor(() =>
      expect(boardRequests('cards/move').at(-1)?.body).toEqual({
        toListId: LIST_IDS.doing,
        placement: { type: 'end' },
      }),
    );
    await waitFor(async () =>
      expect(await cardTitles('Fazendo')).toEqual([
        'Fechar relatório',
        'Publicar campanha',
        'Revisar orçamento',
      ]),
    );
  });

  it('abre pela tecla M com o card focado e avisa que a lista de conclusão conclui', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    (await screen.findByRole('link', { name: 'Publicar campanha. Tem descrição' })).focus();
    await user.keyboard('m');
    const dialog = screen.getByRole('dialog', { name: 'Mover card' });

    await user.selectOptions(within(dialog).getByLabelText('Lista'), LIST_IDS.done);
    expect(within(dialog).getByLabelText('Posição')).toHaveValue('1');
    expect(dialog).toHaveTextContent('Mover para Concluído conclui o card.');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Card movido para Concluído, posição 1. Card concluído.'),
    );
    expect(
      await within(await screen.findByRole('list', { name: 'Cards de Concluído' })).findByRole(
        'link',
        { name: 'Publicar campanha. Concluído. Tem descrição' },
      ),
    ).toBeVisible();
  });

  it('entre quadros avisa sobre etiquetas e o card sai do quadro', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openMoveDialog(user, 'Revisar orçamento');
    await user.selectOptions(within(dialog).getByLabelText('Quadro'), 'Vendas');
    expect(await within(dialog).findByLabelText('Lista')).toHaveValue(OTHER_LIST_IDS.backlog);
    expect(dialog).toHaveTextContent(
      'A etiqueta Financeiro não existe em Vendas e será removida do card.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Card movido para Vendas. 1 etiqueta foi removida.'),
    );
    expect(boardRequests('cards/move')[0]?.body).toEqual({
      toListId: OTHER_LIST_IDS.backlog,
      placement: { type: 'start' },
    });
    await waitFor(() => expect(queryCardTitles('Fazendo')).not.toContain('Revisar orçamento'));
  });

  it('falha no servidor devolve o card e avisa (rollback)', async () => {
    server.use(http.post('/api/cards/:cardId/move', () => apiErrorResponse('INTERNAL_ERROR')));
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openMoveDialog(user, 'Revisar orçamento');
    await user.selectOptions(within(dialog).getByLabelText('Lista'), LIST_IDS.todo);
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));

    await waitFor(() =>
      expect(toastMessages()).toContain(
        'Não foi possível mover o card. Ele voltou para onde estava.',
      ),
    );
    expect(await cardTitles('Fazendo')).toEqual([
      'Revisar orçamento',
      'Publicar campanha',
      'Fechar relatório',
    ]);
    expect(queryCardTitles('A fazer')).toEqual([]);
  });

  it('lista de destino arquivada: mensagem própria', async () => {
    server.use(http.post('/api/cards/:cardId/move', () => apiErrorResponse('LIST_ARCHIVED')));
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openMoveDialog(user, 'Revisar orçamento');
    await user.selectOptions(within(dialog).getByLabelText('Lista'), LIST_IDS.todo);
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));

    await waitFor(() =>
      expect(toastMessages()).toEqual(['A lista de destino foi arquivada. Escolha outra lista.']),
    );
  });
});

describe('Arquivar e restaurar card', () => {
  it('arquiva pela face, desfaz pelo toast e restaura em Itens arquivados', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(
      await screen.findByRole('button', { name: 'Ações do card Revisar orçamento' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(() => expect(queryCardTitles('Fazendo')).not.toContain('Revisar orçamento'));
    await waitFor(() => expect(toastMessages()).toContain('Card arquivado.'));

    await user.click(screen.getByRole('button', { name: 'Opções do quadro' }));
    await user.click(screen.getByRole('menuitem', { name: 'Itens arquivados…' }));
    const archived = screen.getByRole('dialog', { name: 'Itens arquivados' });
    expect(within(archived).getByRole('tab', { name: 'Cards' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(
      await within(archived).findByRole('button', { name: 'Restaurar card Revisar orçamento' }),
    );

    await waitFor(() => expect(toastMessages()).toContain('Card restaurado no fim de Fazendo.'));
    expect(await within(archived).findByText('Nenhum card arquivado.')).toBeVisible();
    await waitFor(async () =>
      expect(await cardTitles('Fazendo')).toEqual([
        'Publicar campanha',
        'Fechar relatório',
        'Revisar orçamento',
      ]),
    );
  });
});

describe('Detalhe do card (/b/:boardId/c/:cardId)', () => {
  const detailPath = (cardId: string) => `/b/${BOARD_ID}/c/${cardId}`;

  it('mostra a lista com cor e nome, e Esc fecha voltando ao quadro', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    const location = within(dialog).getByRole('navigation', { name: 'Local do card' });
    expect(location).toHaveTextContent('Marketing');
    expect(within(location).getByText('Fazendo').closest('[data-color]')).toHaveAttribute(
      'data-color',
      'orange',
    );

    await user.keyboard('{Escape}');

    await waitFor(() => expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}`));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prende o foco dentro do diálogo', async () => {
    const user = userEvent.setup();
    renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    const first = within(dialog).getByRole('button', { name: 'Opções do card' });
    first.focus();
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(first);

    await user.tab();
    expect(first).toHaveFocus();
  });

  it('edita o título (Enter salva) e o histórico registra a mudança', async () => {
    const user = userEvent.setup();
    renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Editar título' }));
    const field = within(dialog).getByRole('textbox', { name: 'Título do card' });
    await user.clear(field);
    await user.type(field, 'Revisar orçamento 2027{Enter}');

    expect(
      await within(dialog).findByRole('heading', { level: 2, name: 'Revisar orçamento 2027' }),
    ).toBeVisible();
    expect(boardRequests('cards/update')[0]?.body).toEqual({ title: 'Revisar orçamento 2027' });
    const history = await openHistory(user, dialog);
    expect(history).toHaveTextContent(
      'Ana Souza mudou o título de "Revisar orçamento" para "Revisar orçamento 2027"',
    );
  });

  it('Esc no título cancela sem fechar; título vazio não é salvo', async () => {
    const user = userEvent.setup();
    renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Editar título' }));
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Título do card' }),
      ' xyz{Escape}',
    );
    expect(screen.getByRole('dialog', { name: 'Revisar orçamento' })).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Editar título' }));
    await user.clear(within(dialog).getByRole('textbox', { name: 'Título do card' }));
    await user.keyboard('{Enter}');

    expect(toastMessages()).toContain('O título não pode ficar vazio.');
    expect(boardRequests('cards/update')).toEqual([]);
  });

  it('campo em edição mantém o texto quando o polling traz dados novos', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp(detailPath(CARD_IDS.campaign));

    const dialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    await user.click(within(dialog).getByRole('button', { name: 'Editar título' }));
    const title = within(dialog).getByRole('textbox', { name: 'Título do card' });
    await user.clear(title);
    await user.type(title, 'Meu rascunho');

    boardDb.cards = boardDb.cards.map((card) =>
      card.id === CARD_IDS.campaign
        ? { ...card, title: 'Mudado por outra pessoa', description: 'Texto novo' }
        : card,
    );
    await queryClient.refetchQueries({ queryKey: cardQueryKey(CARD_IDS.campaign) });

    await waitFor(() => expect(within(dialog).getByText('Texto novo')).toBeVisible());
    expect(title).toHaveValue('Meu rascunho');
  });

  it('descrição: Escrever/Visualizar e salvar; o rascunho sobrevive ao refetch', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar descrição…' }));
    const field = within(dialog).getByRole('textbox', { name: 'Descrição' });
    await user.type(field, 'Ver **custos**');

    await queryClient.refetchQueries({ queryKey: cardQueryKey(CARD_IDS.budget) });
    expect(field).toHaveValue('Ver **custos**');

    await user.click(within(dialog).getByRole('tab', { name: 'Visualizar' }));
    expect(within(dialog).getByText('custos').tagName).toBe('STRONG');
    await user.click(within(dialog).getByRole('tab', { name: 'Escrever' }));
    await user.click(within(dialog).getByRole('textbox', { name: 'Descrição' }));
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() =>
      expect(within(dialog).queryByRole('textbox', { name: 'Descrição' })).not.toBeInTheDocument(),
    );
    expect(boardRequests('cards/update')[0]?.body).toEqual({ description: 'Ver **custos**' });
    expect(within(dialog).getByText('custos').tagName).toBe('STRONG');
  });

  it('fechar com descrição não salva pede confirmação', async () => {
    const user = userEvent.setup();
    renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar descrição…' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Descrição' }), 'Rascunho');
    await user.click(within(dialog).getByRole('button', { name: /Fechar/ }));

    const confirm = screen.getByRole('dialog', { name: 'Descartar as alterações na descrição?' });
    await user.click(within(confirm).getByRole('button', { name: 'Continuar editando' }));
    expect(within(dialog).getByRole('textbox', { name: 'Descrição' })).toHaveValue('Rascunho');
  });

  it('descrição com HTML e javascript: não vira HTML', async () => {
    boardDb.cards = boardDb.cards.map((card) =>
      card.id === CARD_IDS.budget
        ? {
            ...card,
            description:
              '<script>window.__xss=1</script>\n\n<img src=x onerror="window.__xss=2">\n\n[link](javascript:window.__xss=3)',
          }
        : card,
    );
    renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    expect(await within(dialog).findByText(/<script>/)).toBeVisible();
    expect(dialog.querySelector('script, img, [onerror], a[href^="javascript"]')).toBeNull();
  });

  it('arquiva e restaura pelo detalhe, com histórico', async () => {
    const user = userEvent.setup();
    renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Arquivar' }));

    expect(await within(dialog).findByText('Este card está arquivado.')).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: 'Editar título' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar' }));

    await waitFor(() => expect(toastMessages()).toContain('Card restaurado no fim de Fazendo.'));
    await waitFor(() =>
      expect(within(dialog).queryByText('Este card está arquivado.')).not.toBeInTheDocument(),
    );
    const history = await openHistory(user, dialog);
    await waitFor(() => expect(history).toHaveTextContent('Ana Souza restaurou o card'));
    expect(history).toHaveTextContent('Ana Souza arquivou o card');
  });

  it('Admin exclui definitivamente; Member não vê a opção', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderApp(detailPath(CARD_IDS.budget));

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Opções do card' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir definitivamente' }));
    const confirm = screen.getByRole('dialog', { name: 'Excluir o card definitivamente?' });
    await user.click(within(confirm).getByRole('button', { name: 'Excluir card' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}`));
    expect(toastMessages()).toContain('Card excluído.');
    unmount();

    server.use(
      authHandlers.me({ ...sessionFixture, user: { ...sessionFixture.user, role: 'member' } }),
    );
    renderApp(detailPath(CARD_IDS.campaign));
    const memberDialog = await screen.findByRole('dialog', { name: 'Publicar campanha' });
    await user.click(within(memberDialog).getByRole('button', { name: 'Opções do card' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Excluir definitivamente' }),
    ).not.toBeInTheDocument();
  });

  it('histórico usa o nome atual de quem fez a ação', async () => {
    seedActivities(CARD_IDS.report, [
      { type: 'card_created', data: { listId: LIST_IDS.doing, listName: 'Fazendo' } },
    ]);
    const user = userEvent.setup();
    renderApp(detailPath(CARD_IDS.report));

    const dialog = await screen.findByRole('dialog', { name: 'Fechar relatório' });
    const history = await openHistory(user, dialog);
    expect(history).toHaveTextContent('Ana Souza criou o card em Fazendo');
    expect(dialog.querySelector('[data-status="done"]')).toHaveTextContent('Concluído');
  });

  it('card inexistente mostra "não encontrado"', async () => {
    renderApp(detailPath('00000000-0000-4000-8000-000000000000'));

    expect(await screen.findByRole('heading', { name: 'Card não encontrado' })).toBeVisible();
  });
});
