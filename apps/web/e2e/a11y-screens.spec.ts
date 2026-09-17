// Axe (WCAG 2.x A/AA) nas telas principais com dados reais, nos dois temas: zero violações
// sérias/críticas. Cada tela é conferida com `expect.soft` para o relatório listar todas.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { presetTheme, type Theme, waitForFiniteAnimations } from './support/a11y';
import { listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, seedTeam } from './support/seed';
import { cardDialog, DAY_MS, HOUR_MS, localDue } from './support/ui';

async function seriousViolations(page: Page) {
  await waitForFiniteAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, summary: n.failureSummary })),
    }));
}

for (const theme of ['light', 'dark'] as const satisfies Theme[]) {
  test(`axe: quadros, quadro, detalhe do card, Meus cards e administração (tema ${theme})`, async ({
    page,
    apiAs,
  }) => {
    const team = await seedTeam({ ana: ANA, bruno: BRUNO });
    const api = await apiAs(team.ana);
    const { board, lists } = await api.createBoard('Acessibilidade');
    await api.createBoard('Outro quadro');
    const todo = listByName(lists, 'A fazer');
    const bug = await api.createLabel(board.id, 'Bug', 'red');
    const ux = await api.createLabel(board.id, 'UX', 'yellow');

    const rich = await api.createCard(todo.id, 'Card completo');
    await api.updateCard(rich.id, {
      description: '**Contexto** com [link](https://exemplo.com) e `código`.',
      due: localDue(-DAY_MS, false),
      priority: 'urgent',
    });
    await api.applyLabel(rich.id, bug.id);
    await api.applyLabel(rich.id, ux.id);
    await api.assign(rich.id, team.ana.id);
    await api.assign(rich.id, team.bruno.id);
    const checklist = await api.post<{ checklist: { id: string } }>(
      `/api/cards/${rich.id}/checklists`,
      { title: 'Passos' },
      201,
    );
    await api.post(`/api/checklists/${checklist.checklist.id}/items`, { text: 'Primeiro' }, 201);
    await api.comment(rich.id, 'Comentário com **negrito**.');

    const soon = await api.createCard(listByName(lists, 'Fazendo').id, 'Vencendo em breve');
    await api.updateCard(soon.id, { due: localDue(3 * HOUR_MS, true), priority: 'medium' });
    await api.assign(soon.id, team.ana.id);
    const later = await api.createCard(todo.id, 'Com prazo longe');
    await api.updateCard(later.id, { due: localDue(10 * DAY_MS, false), priority: 'low' });
    await api.assign(later.id, team.ana.id);
    const done = await api.createCard(todo.id, 'Já entregue');
    await api.updateCard(done.id, { priority: 'high' });
    await api.complete(done.id);
    await api.post('/api/admin/invites', { email: 'convidado@exemplo.com', role: 'member' }, 201);

    await presetTheme(page, theme);
    await signIn(page.context(), team.ana);

    const screens: Array<{ name: string; open: () => Promise<void> }> = [
      {
        name: 'Quadros (/)',
        open: async () => {
          await page.goto('/');
          await expect(page.getByRole('list', { name: 'Quadros ativos' })).toContainText(
            'Acessibilidade',
          );
        },
      },
      {
        name: 'Quadro (/b/:id) com etiquetas, prioridades e prazos',
        open: async () => {
          await page.goto(`/b/${board.id}`);
          await expect(page.getByRole('link', { name: /^Card completo\./ })).toBeVisible();
        },
      },
      {
        name: 'Quadro com filtros abertos',
        open: async () => {
          await page.getByRole('button', { name: 'Filtros', exact: true }).click();
          await expect(page.getByRole('search', { name: 'Filtros do quadro' })).toBeVisible();
        },
      },
      {
        name: 'Detalhe do card',
        open: async () => {
          await page.goto(`/b/${board.id}/c/${rich.id}`);
          await expect(cardDialog(page, 'Card completo').getByText('Comentário com')).toBeVisible();
        },
      },
      {
        name: 'Detalhe do card: aba Histórico',
        open: async () => {
          const dialog = cardDialog(page, 'Card completo');
          await dialog.getByRole('tab', { name: 'Histórico' }).click();
          await expect(dialog.getByRole('list', { name: 'Histórico do card' })).toBeVisible();
        },
      },
      {
        name: 'Meus cards',
        open: async () => {
          await page.goto('/meus-cards');
          await expect(page.getByRole('list', { name: 'Atrasados' })).toBeVisible();
        },
      },
      {
        name: 'Notificações (painel aberto)',
        open: async () => {
          await page
            .getByRole('banner')
            .getByRole('button', { name: /^Notificações/ })
            .click();
          await expect(page.getByRole('dialog', { name: 'Notificações' })).toBeVisible();
        },
      },
      {
        name: 'Administração: membros',
        open: async () => {
          await page.goto('/admin/membros');
          await expect(page.getByRole('list', { name: 'Membros da equipe' })).toContainText(
            'Bruno Membro',
          );
        },
      },
      {
        name: 'Administração: convites',
        open: async () => {
          await page.goto('/admin/convites');
          await expect(page.getByRole('list', { name: 'Convites pendentes' })).toBeVisible();
        },
      },
      {
        name: 'Quadros arquivados',
        open: async () => {
          await page.goto('/quadros/arquivados');
          await expect(
            page.getByRole('heading', { level: 1, name: 'Quadros arquivados' }),
          ).toBeVisible();
        },
      },
    ];

    for (const screen of screens) {
      await test.step(screen.name, async () => {
        await screen.open();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect
          .soft(await seriousViolations(page), `axe em "${screen.name}" (tema ${theme})`)
          .toEqual([]);
      });
    }
  });
}
