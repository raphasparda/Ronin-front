import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MEMBER_ID } from '../../../../test/admin-handlers';
import { sessionFixture } from '../../../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  CARD_IDS,
  LABEL_ID,
  type CardRecord,
} from '../../../../test/board-handlers';
import { renderApp } from '../../../../test/render';

type User = ReturnType<typeof userEvent.setup>;

const HOUR = 60 * 60 * 1000;

beforeAll(async () => {
  await Promise.all([import('./BoardPage'), import('../cards/CardDetailRoute')]);
});

function patchSeed(cardId: string, changes: Partial<CardRecord>) {
  boardDb.cards = boardDb.cards.map((card) =>
    card.id === cardId ? { ...card, ...changes } : card,
  );
}

/**
 * Orçamento: Alta, Financeiro, eu, atrasado. Campanha: sem prioridade, Bruno, vence em 3h.
 * Relatório: Urgente, concluído, sem prazo.
 */
beforeEach(() => {
  const now = Date.now();
  patchSeed(CARD_IDS.budget, {
    priority: 'high',
    assigneeIds: [sessionFixture.user.id],
    dueAt: new Date(now - 24 * HOUR).toISOString(),
  });
  patchSeed(CARD_IDS.campaign, {
    assigneeIds: [MEMBER_ID],
    dueAt: new Date(now + 3 * HOUR).toISOString(),
    dueHasTime: true,
  });
  patchSeed(CARD_IDS.report, { priority: 'urgent' });
});

async function visibleTitles(listName = 'Fazendo'): Promise<string[]> {
  const column = await screen.findByRole('region', { name: listName });
  const list = within(column).queryByRole('list', { name: `Cards de ${listName}` });
  if (!list) return [];
  return within(list)
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.split('. ')[0] ?? '');
}

async function toggleOption(user: User, menu: string, option: string) {
  const trigger = screen.getByRole('button', { name: new RegExp(`^${menu}`) });
  if (trigger.getAttribute('aria-expanded') !== 'true') await user.click(trigger);
  const panel = screen.getByRole('group', { name: `Filtrar por ${menu.toLowerCase()}` });
  await user.click(within(panel).getByRole('checkbox', { name: option }));
}

describe('Filtro do quadro (C11)', () => {
  it('combina critérios (OU dentro, E entre) e mostra o indicador anunciado', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}`);

    await screen.findByRole('list', { name: 'Cards de Fazendo' });
    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('search', { name: 'Filtros do quadro' })).toBeVisible();

    await toggleOption(user, 'Prioridade', 'Alta');
    await toggleOption(user, 'Prioridade', 'Sem prioridade');
    await waitFor(async () =>
      expect(await visibleTitles()).toEqual(['Revisar orçamento', 'Publicar campanha']),
    );
    expect(router.state.location.search).toBe('?prioridade=high%2Cnone');
    expect(screen.getByText(/Filtro ativo/).closest('[role="status"]')).toHaveTextContent(
      'Filtro ativo · 2 de 3 cards',
    );
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Fazendo' })).getByText('2 de 3'),
    ).toBeVisible();

    await user.keyboard('{Escape}');
    await toggleOption(user, 'Prazo', 'Vencendo (24h)');
    await waitFor(async () => expect(await visibleTitles()).toEqual(['Publicar campanha']));
    expect(screen.getByText(/Filtro ativo/).closest('[role="status"]')).toHaveTextContent(
      'Filtro ativo · 1 de 3 cards',
    );
    expect(screen.getByRole('list', { name: 'Filtros aplicados' })).toHaveTextContent(
      'Prioridade: Alta, Sem prioridadePrazo: Vencendo (24h)',
    );
    expect(
      within(screen.getByRole('region', { name: 'A fazer' })).getByText(
        'Nenhum card com estes filtros',
      ),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Remover filtro Prioridade: Alta, Sem prioridade' }),
    );
    await waitFor(() => expect(router.state.location.search).toBe('?prazo=due_soon'));
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await visibleTitles()).toEqual([
      'Revisar orçamento',
      'Publicar campanha',
      'Fechar relatório',
    ]);
    expect(screen.queryByText(/Filtro ativo/)).not.toBeInTheDocument();
  });

  it('a URL reproduz o filtro (responsável "Eu", etiqueta e busca sem acento)', async () => {
    renderApp(`/b/${BOARD_ID}?responsavel=${sessionFixture.user.id}&etiqueta=${LABEL_ID}&q=orcam`);

    await waitFor(async () => expect(await visibleTitles()).toEqual(['Revisar orçamento']));
    expect(screen.getByRole('button', { name: 'Filtros (3)' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('searchbox', { name: 'Buscar por título' })).toHaveValue('orcam');
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Filtros aplicados' })).toHaveTextContent(
        'Responsável: EuEtiqueta: FinanceiroBusca: "orcam"',
      ),
    );
  });

  it('busca por título com espera curta; nada encontrado oferece limpar', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}`);

    await screen.findByRole('list', { name: 'Cards de Fazendo' });
    await user.keyboard('/');
    const search = screen.getByRole('searchbox', { name: 'Buscar por título' });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, 'RELATÓRIO');

    await waitFor(async () => expect(await visibleTitles()).toEqual(['Fechar relatório']));
    expect(router.state.location.search).toBe('?q=RELAT%C3%93RIO');

    await user.clear(search);
    await user.type(search, 'inexistente');
    expect(await screen.findByRole('heading', { name: 'Nenhum card encontrado' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(search).toHaveValue(''));
    expect(await visibleTitles()).toHaveLength(3);
  });

  it('"Limpar" mantém a barra aberta quando o filtro veio só da URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}?prioridade=urgent`);

    await screen.findByText(/Filtro ativo/);
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('search', { name: 'Filtros do quadro' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('o filtro continua ao abrir e fechar um card', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}?prioridade=urgent`);

    await waitFor(async () => expect(await visibleTitles()).toEqual(['Fechar relatório']));
    await user.click(screen.getByRole('link', { name: /^Fechar relatório\./ }));
    const dialog = await screen.findByRole('dialog', { name: 'Fechar relatório' });
    expect(router.state.location.search).toBe('?prioridade=urgent');

    await user.click(within(dialog).getByRole('button', { name: /Fechar/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}`));
    expect(router.state.location.search).toBe('?prioridade=urgent');
  });
});
