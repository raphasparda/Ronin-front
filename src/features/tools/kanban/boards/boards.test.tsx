import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { getToasts } from '../../../../components/ui/toast-store';
import { apiErrorResponse, authHandlers, sessionFixture } from '../../../../test/auth-handlers';
import {
  ARCHIVED_BOARD_ID,
  BOARD_ID,
  boardRequests,
  LIST_IDS,
} from '../../../../test/board-handlers';
import { renderApp } from '../../../../test/render';
import { server } from '../../../../test/server';

const toastMessages = () => getToasts().map((item) => item.message);

async function listNames(): Promise<string[]> {
  const lists = await screen.findByRole('list', { name: 'Listas do quadro' });
  return within(lists)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent ?? '');
}

function listHeader(name: string | RegExp): HTMLElement {
  const header = screen.getByRole('heading', { level: 2, name }).closest('header');
  if (!header) throw new Error('Cabeçalho da lista não encontrado.');
  return header;
}

async function openListMenu(user: ReturnType<typeof userEvent.setup>, listName: string) {
  await user.click(await screen.findByRole('button', { name: `Opções da lista ${listName}` }));
}

describe('Quadros (/)', () => {
  it('mostra os quadros ativos em ordem e o link para arquivados', async () => {
    renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Quadros ativos' });
    expect(within(grid).getByRole('link', { name: 'Marketing' })).toHaveAttribute(
      'href',
      `/b/${BOARD_ID}`,
    );
    expect(within(grid).queryByRole('link', { name: 'Antigo' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver quadros arquivados' })).toBeVisible();
  });

  it('estado vazio convida a criar o primeiro quadro', async () => {
    server.use(http.get('/api/boards', () => HttpResponse.json({ boards: [] })));
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Nenhum quadro ainda' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Criar quadro' })).toBeVisible();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    server.use(http.get('/api/boards', () => apiErrorResponse('INTERNAL_ERROR'), { once: true }));
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: 'Marketing' })).toBeVisible();
  });

  it('cria quadro e abre com as listas padrão coloridas', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Novo quadro' }));
    const dialog = screen.getByRole('dialog', { name: 'Novo quadro' });
    await user.click(within(dialog).getByRole('button', { name: 'Criar quadro' }));
    expect(within(dialog).getByLabelText('Nome do quadro')).toHaveAccessibleDescription(
      'Dê um nome ao quadro. Ele já vem com as listas A fazer, Fazendo e Concluído.',
    );

    await user.type(within(dialog).getByLabelText('Nome do quadro'), '  Site novo ');
    await user.click(within(dialog).getByRole('button', { name: 'Criar quadro' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Site novo' })).toBeVisible();
    expect(router.state.location.pathname).toMatch(/^\/b\/[0-9a-f-]{36}$/);
    expect(boardRequests('boards')[0]?.body).toEqual({ name: 'Site novo' });
    expect(await listNames()).toEqual(['A fazer', 'Fazendo', 'Concluído (lista de conclusão)']);
    expect(listHeader('A fazer')).toHaveAttribute('data-color', 'blue');
    expect(listHeader('Fazendo')).toHaveAttribute('data-color', 'orange');
    expect(listHeader(/Concluído/)).toHaveAttribute('data-color', 'green');
  });
});

describe('Quadro (/b/:boardId)', () => {
  it('renomeia o quadro inline com Enter', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Renomear quadro' }));
    const input = screen.getByRole('textbox', { name: 'Nome do quadro' });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, 'Marketing 2027{Enter}');

    expect(await screen.findByRole('heading', { level: 1, name: 'Marketing 2027' })).toBeVisible();
    expect(boardRequests('board/rename')[0]?.body).toEqual({ name: 'Marketing 2027' });
  });

  it('Esc cancela a renomeação e nome vazio não é enviado', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Renomear quadro' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome do quadro' }), 'xyz{Escape}');
    expect(screen.getByRole('heading', { level: 1, name: 'Marketing' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Renomear quadro' }));
    await user.clear(screen.getByRole('textbox', { name: 'Nome do quadro' }));
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 1, name: 'Marketing' })).toBeVisible();
    expect(toastMessages()).toContain('O nome não pode ficar vazio.');
    expect(boardRequests('board/rename')).toEqual([]);
  });

  it('arquiva o quadro com confirmação e volta para Quadros', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Opções do quadro' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar quadro' }));
    const dialog = screen.getByRole('dialog', { name: 'Arquivar "Marketing"?' });
    await user.click(within(dialog).getByRole('button', { name: 'Arquivar quadro' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(toastMessages()).toContain('Quadro arquivado.');
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Marketing' })).not.toBeInTheDocument(),
    );
  });

  it('quadro arquivado é somente leitura e pode ser restaurado', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${ARCHIVED_BOARD_ID}`);

    expect(await screen.findByText(/Este quadro está arquivado/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Adicionar lista' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Opções da lista Backlog' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Arrastar lista Backlog' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renomear quadro' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restaurar quadro' }));

    expect(await screen.findByRole('button', { name: 'Adicionar lista' })).toBeVisible();
    expect(screen.queryByText(/Este quadro está arquivado/)).not.toBeInTheDocument();
  });

  it('quadro inexistente mostra "não encontrado"', async () => {
    renderApp('/b/00000000-0000-4000-8000-000000000000');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quadro não encontrado' }),
    ).toBeVisible();
  });
});

describe('Listas', () => {
  it('lista nova recebe a próxima cor do ciclo (pré-selecionada) e o campo continua aberto', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Adicionar lista' }));
    const picker = screen.getByRole('radiogroup', { name: 'Cor da nova lista' });
    expect(within(picker).getByRole('radio', { name: 'Ciano' })).toBeChecked();

    const name = screen.getByLabelText('Nome da lista');
    await user.type(name, 'Revisão{Enter}');

    await waitFor(async () => expect(await listNames()).toContain('Revisão'));
    expect(listHeader('Revisão')).toHaveAttribute('data-color', 'cyan');
    expect(boardRequests('lists/create')[0]?.body).toEqual({ name: 'Revisão', color: 'cyan' });
    expect(name).toHaveValue('');
    expect(name).toHaveFocus();
    await waitFor(() => expect(within(picker).getByRole('radio', { name: 'Azul' })).toBeChecked());
  });

  it('nome vazio não cria lista', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Adicionar lista' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByLabelText('Nome da lista')).toHaveAccessibleDescription(
      'Dê um nome à lista.',
    );
    expect(boardRequests('lists/create')).toEqual([]);
  });

  it('troca a cor pelo teclado no seletor com nomes acessíveis', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'A fazer');
    await user.click(screen.getByRole('menuitem', { name: 'Cor da lista…' }));

    const dialog = screen.getByRole('dialog', { name: 'Cor da lista A fazer' });
    const group = within(dialog).getByRole('radiogroup', { name: 'Cor da lista' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'Cinza',
      'Vermelho',
      'Laranja',
      'Amarelo',
      'Verde',
      'Ciano',
      'Azul',
      'Roxo',
      'Magenta',
    ]);
    const blue = within(group).getByRole('radio', { name: 'Azul' });
    expect(blue).toBeChecked();
    expect(blue).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    const purple = within(group).getByRole('radio', { name: 'Roxo' });
    expect(purple).toBeChecked();
    expect(purple).toHaveFocus();
    expect(listHeader('A fazer')).toHaveAttribute('data-color', 'purple');
    await waitFor(() =>
      expect(boardRequests('lists/update').map((item) => item.body)).toEqual([{ color: 'purple' }]),
    );
    expect(screen.getByText('Cor da lista A fazer alterada para Roxo.')).toBeInTheDocument();
  });

  it('renomeia lista pelo menu', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'Fazendo');
    await user.click(screen.getByRole('menuitem', { name: 'Renomear' }));
    const input = screen.getByRole('textbox', { name: 'Nome da lista' });
    await user.clear(input);
    await user.type(input, 'Em andamento{Enter}');

    await waitFor(async () => expect(await listNames()).toContain('Em andamento'));
    expect(boardRequests('lists/update')[0]?.body).toEqual({ name: 'Em andamento' });
  });

  it('marcar lista com cards abertos pede confirmação com a contagem', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'Fazendo');
    await user.click(screen.getByRole('menuitem', { name: 'Marcar como lista de conclusão' }));

    const dialog = screen.getByRole('dialog', {
      name: 'Marcar "Fazendo" como lista de conclusão?',
    });
    expect(dialog).toHaveTextContent(
      'Os 2 cards abertos desta lista serão marcados como concluídos, com a conclusão registrada em seu nome.',
    );
    expect(dialog).toHaveTextContent('A lista Concluído deixa de ser a lista de conclusão.');
    expect(boardRequests('lists/update')).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Marcar e concluir 2 cards' }));

    await waitFor(() =>
      expect(toastMessages()).toContain(
        'Fazendo agora é a lista de conclusão. Concluído deixou de ser. 2 cards foram concluídos.',
      ),
    );
    expect(boardRequests('lists/update')[0]?.body).toEqual({ isDoneList: true });
    await waitFor(async () =>
      expect(await listNames()).toEqual(['A fazer', 'Fazendo (lista de conclusão)', 'Concluído']),
    );
  });

  it('cancelar a confirmação não altera nada', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'Fazendo');
    await user.click(screen.getByRole('menuitem', { name: 'Marcar como lista de conclusão' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boardRequests('lists/update')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Opções da lista Fazendo' })).toHaveFocus();
  });

  it('lista sem cards abertos é marcada direto, com texto indicando a conclusão', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'A fazer');
    await user.click(screen.getByRole('menuitem', { name: 'Marcar como lista de conclusão' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(toastMessages()).toContain(
        'A fazer agora é a lista de conclusão. Concluído deixou de ser.',
      ),
    );
    await waitFor(async () => expect((await listNames())[0]).toBe('A fazer (lista de conclusão)'));
    expect(screen.getAllByText('Lista de conclusão.')).toHaveLength(1);
  });

  it('reordena pelo menu "Mover lista" (teclado) com atualização otimista', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const trigger = await screen.findByRole('button', { name: 'Opções da lista A fazer' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Mover lista para a esquerda' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const right = screen.getByRole('menuitem', { name: 'Mover lista para a direita' });
    right.focus();
    await user.keyboard('{Enter}');

    expect(await listNames()).toEqual(['Fazendo', 'A fazer', 'Concluído (lista de conclusão)']);
    expect(screen.getByText('Lista A fazer movida para a posição 2 de 3.')).toBeInTheDocument();
    await waitFor(() =>
      expect(boardRequests('lists/move')[0]?.body).toEqual({
        placement: { type: 'after', id: LIST_IDS.doing },
      }),
    );
  });

  it('desfaz a reordenação e avisa quando a API falha', async () => {
    server.use(http.post('/api/lists/:listId/move', () => apiErrorResponse('INTERNAL_ERROR')));
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'Concluído');
    await user.click(screen.getByRole('menuitem', { name: 'Mover lista para a esquerda' }));

    await waitFor(() =>
      expect(toastMessages()).toContain(
        'Não foi possível mover a lista. Ela voltou para onde estava.',
      ),
    );
    expect(await listNames()).toEqual(['A fazer', 'Fazendo', 'Concluído (lista de conclusão)']);
    expect(toastMessages()).toHaveLength(1);
  });

  it('arquivar lista com cards pede confirmação; a lista pode ser restaurada', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'Fazendo');
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar lista' }));
    const dialog = screen.getByRole('dialog', { name: 'Arquivar a lista "Fazendo"?' });
    expect(dialog).toHaveTextContent('Os 3 cards dela também saem do quadro.');
    await user.click(within(dialog).getByRole('button', { name: 'Arquivar lista' }));

    await waitFor(async () =>
      expect(await listNames()).toEqual(['A fazer', 'Concluído (lista de conclusão)']),
    );

    await user.click(screen.getByRole('button', { name: 'Opções do quadro' }));
    await user.click(screen.getByRole('menuitem', { name: 'Itens arquivados…' }));
    const archived = screen.getByRole('dialog', { name: 'Itens arquivados' });
    await user.click(within(archived).getByRole('tab', { name: 'Listas' }));
    await user.click(
      await within(archived).findByRole('button', { name: 'Restaurar lista Fazendo' }),
    );

    await waitFor(() => expect(toastMessages()).toContain('Lista restaurada no fim do quadro.'));
    await waitFor(async () =>
      expect(await listNames()).toEqual(['A fazer', 'Concluído (lista de conclusão)', 'Fazendo']),
    );
  });

  it('409 BOARD_ARCHIVED avisa e recarrega o quadro', async () => {
    server.use(http.patch('/api/lists/:listId', () => apiErrorResponse('BOARD_ARCHIVED')));
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await openListMenu(user, 'A fazer');
    await user.click(screen.getByRole('menuitem', { name: 'Renomear' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome da lista' }), ' 2{Enter}');

    await waitFor(() =>
      expect(toastMessages()).toEqual([
        'Este quadro foi arquivado. Restaure o quadro para editar.',
      ]),
    );
    await waitFor(async () => expect((await listNames())[0]).toBe('A fazer'));
  });
});

describe('Quadros arquivados', () => {
  it('restaura quadro arquivado', async () => {
    const user = userEvent.setup();
    renderApp('/quadros/arquivados');

    await user.click(await screen.findByRole('button', { name: 'Restaurar Antigo' }));

    expect(await screen.findByText('Nenhum quadro arquivado.')).toBeVisible();
    expect(toastMessages()).toContain('Quadro "Antigo" restaurado.');
  });

  it('Admin exclui digitando o nome exato', async () => {
    const user = userEvent.setup();
    renderApp('/quadros/arquivados');

    await user.click(await screen.findByRole('button', { name: 'Excluir Antigo' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir quadro definitivamente' });
    const confirm = within(dialog).getByRole('button', { name: 'Excluir quadro' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Nome do quadro'), 'antigo');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Nome do quadro'));
    await user.type(within(dialog).getByLabelText('Nome do quadro'), ' Antigo ');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByText('Nenhum quadro arquivado.')).toBeVisible();
    expect(boardRequests('board/delete')[0]?.body).toEqual({ confirmName: 'Antigo' });
  });

  it('Member não vê "Excluir"', async () => {
    server.use(
      authHandlers.me({ ...sessionFixture, user: { ...sessionFixture.user, role: 'member' } }),
    );
    renderApp('/quadros/arquivados');

    expect(await screen.findByRole('button', { name: 'Restaurar Antigo' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Excluir Antigo' })).not.toBeInTheDocument();
  });
});
