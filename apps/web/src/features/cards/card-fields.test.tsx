import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { DEACTIVATED_ID, MEMBER_ID } from '../../test/admin-handlers';
import { apiErrorResponse, sessionFixture } from '../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  CARD_IDS,
  LABEL_ID,
  type CardRecord,
} from '../../test/board-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

type User = ReturnType<typeof userEvent.setup>;

const HOUR = 60 * 60 * 1000;
const ME = sessionFixture.user.id;
const toastMessages = () => getToasts().map((item) => item.message);
const detailPath = (cardId: string) => `/b/${BOARD_ID}/c/${cardId}`;

beforeAll(async () => {
  await Promise.all([import('../boards/BoardPage'), import('./CardDetailRoute')]);
});

function patchSeed(cardId: string, changes: Partial<CardRecord>) {
  boardDb.cards = boardDb.cards.map((card) =>
    card.id === cardId ? { ...card, ...changes } : card,
  );
}

function faceLink(title: string): HTMLElement {
  const link = screen.getAllByRole('link').find((item) => {
    const label = item.getAttribute('aria-label') ?? '';
    return label === title || label.startsWith(`${title}.`);
  });
  if (!link) throw new Error(`Face do card ${title} não encontrada.`);
  return link;
}

async function openDialog(cardId: string, title: string) {
  renderApp(detailPath(cardId));
  return screen.findByRole('dialog', { name: title });
}

async function openCardLabels(user: User, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole('button', { name: /etiqueta/i }));
  return screen.findByRole('dialog', { name: 'Etiquetas do card' });
}

describe('Face do card: etiquetas, prioridade, prazo e responsáveis', () => {
  it('mostra estados de prazo e prioridade em texto, e nomes no rótulo', async () => {
    const now = Date.now();
    patchSeed(CARD_IDS.budget, {
      priority: 'urgent',
      dueAt: new Date(now - 48 * HOUR).toISOString(),
      assigneeIds: [ME, MEMBER_ID],
    });
    patchSeed(CARD_IDS.campaign, {
      priority: 'low',
      dueAt: new Date(now + 3 * HOUR).toISOString(),
      dueHasTime: true,
    });
    boardDb.checklists.push({
      id: '44444444-4444-4444-8444-444444444444',
      cardId: CARD_IDS.campaign,
      title: 'QA',
      createdAt: new Date(now).toISOString(),
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          checklistId: '44444444-4444-4444-8444-444444444444',
          text: 'Testar',
          position: 'a0',
          isChecked: true,
          checkedBy: ME,
          checkedAt: new Date(now).toISOString(),
        },
      ],
    });
    renderApp(`/b/${BOARD_ID}`);

    await screen.findByRole('list', { name: 'Cards de Fazendo' });
    await waitFor(() =>
      expect(faceLink('Revisar orçamento')).toHaveAccessibleName(
        /^Revisar orçamento\. Etiquetas: Financeiro\. Prioridade urgente\. Atrasado, .+\. Responsáveis: Ana Souza, Bruno Lima$/,
      ),
    );
    const budget = faceLink('Revisar orçamento');
    expect(within(budget).getByText('Urgente').closest('[data-priority]')).toHaveAttribute(
      'data-priority',
      'urgent',
    );
    expect(budget.querySelector('[data-status="overdue"]')).toHaveTextContent(/Atrasado/);
    expect(budget.querySelector('[data-color="green"]')).toHaveTextContent('Financeiro');

    const campaign = faceLink('Publicar campanha');
    expect(campaign).toHaveAccessibleName(/Prioridade baixa\. Vencendo, (hoje|amanhã)/);
    expect(campaign).toHaveAccessibleName(/Checklist 1 de 1/);
    expect(campaign.querySelector('[data-status="due-soon"]')).toHaveTextContent(/Vencendo/);
    expect(within(campaign).getByText('1/1')).toHaveClass('text-success');
  });

  it('muda a prioridade pelo menu da face sem reordenar os cards', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await user.click(
      await screen.findByRole('button', { name: 'Ações do card Publicar campanha' }),
    );
    const option = screen.getByRole('menuitemradio', { name: 'Alta' });
    expect(screen.getByRole('menuitemradio', { name: 'Sem prioridade' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(option);

    await waitFor(() =>
      expect(boardRequests('cards/update').at(-1)?.body).toEqual({ priority: 'high' }),
    );
    expect(faceLink('Publicar campanha')).toHaveAccessibleName(/Prioridade alta/);
    const list = screen.getByRole('list', { name: 'Cards de Fazendo' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')?.split('. ')[0]),
    ).toEqual(['Revisar orçamento', 'Publicar campanha', 'Fechar relatório']);
  });
});

describe('Detalhe: prioridade', () => {
  it('é selecionável só pelo teclado e atualiza o topo do diálogo', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(CARD_IDS.budget, 'Revisar orçamento');

    const select = within(dialog).getByRole('button', { name: 'Prioridade Sem prioridade' });
    select.focus();
    await user.keyboard('{ArrowDown}');
    const listbox = within(dialog).getByRole('listbox', { name: 'Prioridade' });
    expect(listbox).toHaveFocus();
    await user.keyboard('{Home}{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(boardRequests('cards/update').at(-1)?.body).toEqual({ priority: 'high' }),
    );
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Prioridade Alta' })).toHaveFocus();
    expect(dialog.querySelector('[data-priority="high"]')).toHaveTextContent('Prioridade Alta');

    await user.keyboard('{ArrowUp}{End}{Enter}');
    await waitFor(() =>
      expect(boardRequests('cards/update').at(-1)?.body).toEqual({ priority: null }),
    );
    expect(within(dialog).getByText('Prioridade removida.')).toBeInTheDocument();
  });

  it('erro no servidor volta a prioridade anterior e avisa', async () => {
    server.use(http.patch('/api/cards/:cardId', () => apiErrorResponse('INTERNAL_ERROR')));
    const user = userEvent.setup();
    const dialog = await openDialog(CARD_IDS.budget, 'Revisar orçamento');

    within(dialog).getByRole('button', { name: 'Prioridade Sem prioridade' }).focus();
    await user.keyboard('{ArrowDown}{Home}{Enter}');

    await waitFor(() =>
      expect(toastMessages()).toContain('Não foi possível alterar a prioridade. Tente de novo.'),
    );
    expect(within(dialog).getByRole('button', { name: 'Prioridade Sem prioridade' })).toBeVisible();
  });
});

describe('Detalhe: responsáveis', () => {
  it('atribui a mim, adiciona pela busca e remove, só com pessoas ativas', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(CARD_IDS.campaign, 'Publicar campanha');

    expect(within(dialog).getByText('Ninguém ainda')).toBeVisible();
    await user.click(await within(dialog).findByRole('button', { name: 'Atribuir a mim' }));
    await waitFor(() => expect(boardRequests('cards/assignees/add')).toHaveLength(1));
    const assigned = within(dialog).getByRole('list', { name: 'Responsáveis' });
    expect(assigned).toHaveTextContent('Ana Souza');

    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
    const panel = within(dialog).getByRole('group', { name: 'Adicionar responsável' });
    const people = within(panel).getByRole('list', { name: 'Pessoas ativas' });
    expect(
      within(people)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['ASAna Souza (eu)', 'BLBruno Lima']);
    await user.type(within(panel).getByRole('searchbox', { name: 'Buscar pessoa' }), 'zzz');
    expect(within(panel).getByText('Ninguém encontrado com esse nome.')).toBeVisible();
    await user.clear(within(panel).getByRole('searchbox', { name: 'Buscar pessoa' }));
    await user.type(within(panel).getByRole('searchbox', { name: 'Buscar pessoa' }), 'bru');
    await user.click(within(panel).getByRole('checkbox', { name: 'Bruno Lima' }));

    await waitFor(() => expect(assigned).toHaveTextContent('Bruno Lima'));
    expect(boardRequests('cards/assignees/add').at(-1)?.method).toBe('PUT');

    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
    expect(
      within(within(dialog).getByRole('group', { name: 'Adicionar responsável' })).getByRole(
        'searchbox',
        { name: 'Buscar pessoa' },
      ),
    ).toHaveValue('');
    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Remover Ana Souza' }));
    await waitFor(() => expect(assigned).not.toHaveTextContent('Ana Souza'));
    expect(boardDb.cards.find((card) => card.id === CARD_IDS.campaign)?.assigneeIds).toEqual([
      MEMBER_ID,
    ]);
    expect(boardDb.activities.map((item) => item.type)).toEqual([
      'card_assignee_added',
      'card_assignee_added',
      'card_assignee_removed',
    ]);
  });

  it('pessoa desativada no servidor: mensagem própria e rollback', async () => {
    server.use(
      http.put('/api/cards/:cardId/assignees/:userId', () => apiErrorResponse('USER_NOT_ACTIVE')),
    );
    const user = userEvent.setup();
    const dialog = await openDialog(CARD_IDS.campaign, 'Publicar campanha');

    await user.click(await within(dialog).findByRole('button', { name: 'Atribuir a mim' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Essa pessoa foi desativada e não pode ser atribuída.'),
    );
    expect(within(dialog).getByText('Ninguém ainda')).toBeVisible();
  });

  it('responsável com conta desativada aparece marcado e pode ser removido', async () => {
    patchSeed(CARD_IDS.campaign, { assigneeIds: [DEACTIVATED_ID] });
    const dialog = await openDialog(CARD_IDS.campaign, 'Publicar campanha');

    await waitFor(() =>
      expect(within(dialog).getByRole('list', { name: 'Responsáveis' })).toHaveTextContent(
        'Carla Dias (conta desativada)',
      ),
    );
    expect(within(dialog).getByRole('button', { name: 'Remover Carla Dias' })).toBeVisible();
  });
});

describe('Detalhe: prazo', () => {
  it('define data e hora no fuso do workspace e remove', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(CARD_IDS.budget, 'Revisar orçamento');

    await user.click(within(dialog).getByRole('button', { name: 'Definir prazo' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar prazo' }));
    expect(within(dialog).getByText('Informe a data do prazo.')).toBeVisible();
    expect(within(dialog).getByLabelText('Data')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: '2030-01-15' } });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Incluir horário' }));
    fireEvent.change(within(dialog).getByLabelText('Horário'), { target: { value: '14:30' } });
    expect(within(dialog).getAllByText(/Brasília/).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar prazo' }));

    await waitFor(() =>
      expect(boardRequests('cards/update').at(-1)?.body).toEqual({
        due: { date: '2030-01-15', time: '14:30' },
      }),
    );
    const due = within(dialog).getAllByText('15 jan 2030, 14:30');
    expect(due.length).toBeGreaterThan(0);
    expect(boardDb.cards.find((card) => card.id === CARD_IDS.budget)?.dueAt).toBe(
      '2030-01-15T17:30:00.000Z',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Remover prazo' }));
    await waitFor(() => expect(boardRequests('cards/update').at(-1)?.body).toEqual({ due: null }));
    expect(within(dialog).getByRole('button', { name: 'Definir prazo' })).toBeVisible();
  });
});

describe('Etiquetas', () => {
  it('cria no card (aplica na hora), impede nome repetido e alterna', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(CARD_IDS.budget, 'Revisar orçamento');

    const labels = await openCardLabels(user, dialog);
    expect(within(labels).getByRole('checkbox', { name: 'Financeiro' })).toBeChecked();

    await user.click(within(labels).getByRole('button', { name: 'Criar etiqueta' }));
    await user.type(within(labels).getByLabelText('Nome da etiqueta'), ' financeiro ');
    await user.click(within(labels).getByRole('button', { name: 'Criar etiqueta' }));
    expect(
      within(labels).getByText('Já existe uma etiqueta com este nome neste quadro.'),
    ).toBeVisible();

    await user.clear(within(labels).getByLabelText('Nome da etiqueta'));
    await user.type(within(labels).getByLabelText('Nome da etiqueta'), 'Bug');
    await user.click(within(labels).getByRole('radio', { name: 'Vermelho' }));
    await user.click(within(labels).getByRole('button', { name: 'Criar etiqueta' }));

    await waitFor(() =>
      expect(within(labels).getByRole('checkbox', { name: 'Bug' })).toBeChecked(),
    );
    expect(boardRequests('labels/create')[0]?.body).toEqual({ name: 'Bug', color: 'red' });
    expect(boardRequests('cards/labels/add')).toHaveLength(1);

    await user.click(within(labels).getByRole('checkbox', { name: 'Financeiro' }));
    await waitFor(() => expect(boardRequests('cards/labels/remove')).toHaveLength(1));
    await user.click(within(labels).getByRole('button', { name: 'Concluir' }));

    const applied = within(dialog).getByRole('list', { name: 'Etiquetas' });
    expect(applied).toHaveTextContent('Bug');
    expect(applied).not.toHaveTextContent('Financeiro');
    expect(within(applied).getByText('Bug').closest('[data-color]')).toHaveAttribute(
      'data-color',
      'red',
    );
  });

  it('renomeia e exclui pelo menu do quadro; a excluída some das faces', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await screen.findByRole('list', { name: 'Cards de Fazendo' });
    await waitFor(() => expect(faceLink('Revisar orçamento')).toHaveAccessibleName(/Financeiro/));
    await user.click(screen.getByRole('button', { name: 'Opções do quadro' }));
    await user.click(screen.getByRole('menuitem', { name: 'Etiquetas…' }));
    const labels = screen.getByRole('dialog', { name: 'Etiquetas do quadro' });
    expect(within(labels).getByRole('list', { name: 'Etiquetas' })).toHaveTextContent(
      'Financeiro1 card',
    );

    await user.click(within(labels).getByRole('button', { name: 'Editar etiqueta Financeiro' }));
    const name = within(labels).getByLabelText('Nome da etiqueta');
    await user.clear(name);
    await user.type(name, 'Finanças');
    await user.click(within(labels).getByRole('radio', { name: 'Roxo' }));
    await user.click(within(labels).getByRole('button', { name: 'Salvar etiqueta' }));

    await waitFor(() => expect(faceLink('Revisar orçamento')).toHaveAccessibleName(/Finanças/));
    expect(boardRequests('labels/update')[0]?.body).toEqual({ name: 'Finanças', color: 'purple' });

    await user.click(within(labels).getByRole('button', { name: 'Excluir etiqueta Finanças' }));
    const confirm = screen.getByRole('dialog', { name: 'Excluir a etiqueta "Finanças"?' });
    expect(confirm).toHaveTextContent('Ela será removida de 1 card deste quadro.');
    await user.click(within(confirm).getByRole('button', { name: 'Excluir etiqueta' }));

    await waitFor(() =>
      expect(faceLink('Revisar orçamento')).not.toHaveAccessibleName(/Etiquetas/),
    );
    expect(within(labels).getByText('Este quadro ainda não tem etiquetas.')).toBeVisible();
    expect(boardDb.labels).toEqual([]);
    expect(boardDb.cards.find((card) => card.id === CARD_IDS.budget)?.labelIds).not.toContain(
      LABEL_ID,
    );
  });
});
