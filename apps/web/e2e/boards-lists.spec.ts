// Fatia 3 (tarefa 3.7): B1–B4 e a marcação de lista de conclusão (C9/RN12), docs/product/scope.md.
import type { Page } from '@playwright/test';

import { listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, seedTeam } from './support/seed';
import { cardFace, listColumn, openMenu, toast } from './support/ui';

async function columnOrder(page: Page): Promise<string[]> {
  return page
    .getByRole('list', { name: 'Listas do quadro' })
    .getByRole('heading', { level: 2 })
    .allTextContents();
}

function header(page: Page, name: string) {
  return listColumn(page, name).locator('header');
}

test('quadro: criar com listas coloridas → nova lista com a próxima cor → trocar cor pelo teclado → reordenar → lista de conclusão com confirmação → arquivar/restaurar lista e quadro → Admin exclui', async ({
  page,
  openAs,
  apiAs,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO });
  const api = await apiAs(team.ana);
  await signIn(page.context(), team.ana);
  let boardId = '';

  await test.step('B1: criar quadro abre o quadro com "A fazer" (azul), "Fazendo" (laranja) e "Concluído" (verde, conclusão)', async () => {
    await page.goto('/');
    await expect(page.getByText('Nenhum quadro ainda')).toBeVisible();
    await page.getByRole('button', { name: 'Novo quadro' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo quadro' });
    await dialog.getByRole('button', { name: 'Criar quadro' }).click();
    await expect(dialog.getByText('Dê um nome ao quadro.')).toBeVisible();
    await dialog.getByLabel('Nome do quadro').fill('Produto 🚀');
    await dialog.getByRole('button', { name: 'Criar quadro' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Produto 🚀' })).toBeVisible();
    boardId = new URL(page.url()).pathname.split('/')[2] ?? '';
    expect(boardId).toMatch(/^[0-9a-f-]{36}$/);

    expect(await columnOrder(page)).toEqual([
      'A fazer',
      'Fazendo',
      'Concluído (lista de conclusão)',
    ]);
    await expect(header(page, 'A fazer')).toHaveAttribute('data-color', 'blue');
    await expect(header(page, 'Fazendo')).toHaveAttribute('data-color', 'orange');
    await expect(header(page, 'Concluído')).toHaveAttribute('data-color', 'green');
  });

  await test.step('B3: nova lista vem com a próxima cor da paleta (depois de verde: ciano)', async () => {
    await page.getByRole('button', { name: 'Adicionar lista' }).click();
    const form = page.getByRole('form', { name: 'Adicionar lista' });
    await expect(
      form
        .getByRole('radiogroup', { name: 'Cor da nova lista' })
        .getByRole('radio', { name: 'Ciano' }),
    ).toHaveAttribute('aria-checked', 'true');
    await form.getByLabel('Nome da lista').fill('Revisão');
    await form.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(listColumn(page, 'Revisão')).toBeVisible();
    await expect(form.getByLabel('Nome da lista')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(header(page, 'Revisão')).toHaveAttribute('data-color', 'cyan');
  });

  await test.step('B3: trocar a cor pelo teclado (menu da lista → "Cor da lista…" → setas)', async () => {
    const menuButton = page.getByRole('button', { name: 'Opções da lista Revisão' });
    // No celular o foco rola o carrossel de listas logo depois de abrir o menu; a rolagem só o
    // reposiciona (fecharia apenas se o botão saísse da tela). O `toPass` fica como rede.
    await expect(async () => {
      await menuButton.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeFocused({
        timeout: 1_000,
      });
    }).toPass({ timeout: 10_000 });
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Cor da lista…' })).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Cor da lista Revisão' });
    const group = dialog.getByRole('radiogroup', { name: 'Cor da lista' });
    await expect(group.getByRole('radio', { name: 'Ciano' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Roxo' })).toBeFocused();
    await expect(group.getByRole('radio', { name: 'Roxo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(header(page, 'Revisão')).toHaveAttribute('data-color', 'purple');
    await expect
      .poll(async () => listByName((await api.board(boardId)).lists, 'Revisão').color)
      .toBe('purple');
  });

  await test.step('B3: reordenar pelo menu ("Mover lista para a esquerda")', async () => {
    await openMenu(page, 'Opções da lista Revisão');
    await page.getByRole('menuitem', { name: 'Mover lista para a esquerda' }).click();
    await expect
      .poll(() => columnOrder(page))
      .toEqual(['A fazer', 'Fazendo', 'Revisão', 'Concluído (lista de conclusão)']);
    await openMenu(page, 'Opções da lista A fazer');
    await expect(
      page.getByRole('menuitem', { name: 'Mover lista para a esquerda' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
  });

  await test.step('B3: outro membro vê a nova cor e a nova ordem', async () => {
    const bruno = await openAs(team.bruno);
    await bruno.goto(`/b/${boardId}`);
    await expect(bruno.getByRole('heading', { level: 1, name: 'Produto 🚀' })).toBeVisible();
    expect(await columnOrder(bruno)).toEqual([
      'A fazer',
      'Fazendo',
      'Revisão',
      'Concluído (lista de conclusão)',
    ]);
    await expect(header(bruno, 'Revisão')).toHaveAttribute('data-color', 'purple');
  });

  await test.step('B3/RN12: marcar outra lista de conclusão pede confirmação e conclui os cards abertos dela', async () => {
    const revisao = listColumn(page, 'Revisão');
    await revisao.getByRole('button', { name: 'Adicionar card' }).click();
    await revisao.getByRole('textbox', { name: 'Título do card' }).fill('Card em revisão');
    await revisao.getByRole('textbox', { name: 'Título do card' }).press('Enter');
    await expect(cardFace(page, 'Card em revisão')).toBeVisible();
    await page.keyboard.press('Escape');

    await openMenu(page, 'Opções da lista Revisão');
    await page.getByRole('menuitem', { name: 'Marcar como lista de conclusão' }).click();
    const confirm = page.getByRole('dialog', { name: 'Marcar "Revisão" como lista de conclusão?' });
    await expect(
      confirm.getByText('O card aberto desta lista será marcado como concluído', { exact: false }),
    ).toBeVisible();
    await expect(
      confirm.getByText('A lista Concluído deixa de ser a lista de conclusão.', { exact: false }),
    ).toBeVisible();
    await confirm.getByRole('button', { name: 'Marcar e concluir 1 card' }).click();
    await expect(
      toast(
        page,
        'Revisão agora é a lista de conclusão. Concluído deixou de ser. 1 card foi concluído.',
      ),
    ).toBeVisible();
    expect(await columnOrder(page)).toEqual([
      'A fazer',
      'Fazendo',
      'Revisão (lista de conclusão)',
      'Concluído',
    ]);
    await expect(cardFace(page, 'Card em revisão')).toHaveAccessibleName(/Concluído/);
    await expect(
      listColumn(page, 'Revisão').getByRole('button', { name: 'Adicionar card' }),
    ).toHaveCount(0);

    const payload = await api.board(boardId);
    expect(payload.lists.filter((list) => list.isDoneList).map((list) => list.name)).toEqual([
      'Revisão',
    ]);
    expect(payload.cards[0]?.status).toBe('completed');
  });

  await test.step('B3: arquivar lista vazia com "Desfazer"; arquivar lista com card pede confirmação e restaura pelos arquivados', async () => {
    await openMenu(page, 'Opções da lista Fazendo');
    await page.getByRole('menuitem', { name: 'Arquivar lista' }).click();
    await expect(toast(page, 'Lista Fazendo arquivada.')).toBeVisible();
    await expect(listColumn(page, 'Fazendo')).toHaveCount(0);
    await page
      .getByRole('region', { name: 'Avisos' })
      .getByRole('button', { name: 'Desfazer' })
      .click();
    await expect(toast(page, 'Lista restaurada no fim do quadro.')).toBeVisible();
    await expect
      .poll(() => columnOrder(page))
      .toEqual(['A fazer', 'Revisão (lista de conclusão)', 'Concluído', 'Fazendo']);

    await openMenu(page, 'Opções da lista Revisão');
    await page.getByRole('menuitem', { name: 'Arquivar lista' }).click();
    const confirm = page.getByRole('dialog', { name: 'Arquivar a lista "Revisão"?' });
    await expect(confirm.getByText('Ela deixa de ser a lista de conclusão.')).toBeVisible();
    await confirm.getByRole('button', { name: 'Arquivar lista' }).click();
    await expect(
      toast(page, 'Lista Revisão arquivada. Ela deixou de ser a lista de conclusão.'),
    ).toBeVisible();
    await expect(cardFace(page, 'Card em revisão')).toHaveCount(0);

    await openMenu(page, 'Opções do quadro');
    await page.getByRole('menuitem', { name: 'Itens arquivados…' }).click();
    const archived = page.getByRole('dialog', { name: 'Itens arquivados' });
    await archived.getByRole('tab', { name: 'Listas' }).click();
    await archived.getByRole('button', { name: 'Restaurar lista Revisão' }).click();
    await expect(toast(page, 'Lista restaurada no fim do quadro.')).toBeVisible();
    await archived.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    await expect(cardFace(page, 'Card em revisão')).toBeVisible();
  });

  await test.step('B4: renomear e arquivar o quadro; Admin exclui digitando o nome', async () => {
    await page.getByRole('button', { name: 'Renomear quadro' }).click();
    const name = page.getByRole('textbox', { name: 'Nome do quadro' });
    await name.fill('Produto 2027');
    await name.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Produto 2027' })).toBeVisible();

    await openMenu(page, 'Opções do quadro');
    await page.getByRole('menuitem', { name: 'Arquivar quadro' }).click();
    await page
      .getByRole('dialog', { name: 'Arquivar "Produto 2027"?' })
      .getByRole('button', { name: 'Arquivar quadro' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();
    await expect(toast(page, 'Quadro arquivado.')).toBeVisible();

    await page.getByRole('link', { name: 'Ver quadros arquivados' }).click();
    await expect(page.getByRole('list', { name: 'Quadros arquivados' })).toContainText(
      'Produto 2027',
    );
    // Quadro arquivado é somente leitura para todos.
    const bruno = await openAs(team.bruno);
    await bruno.goto(`/b/${boardId}`);
    await expect(bruno.getByText('Este quadro está arquivado.', { exact: false })).toBeVisible();
    await expect(bruno.getByRole('button', { name: 'Adicionar card' })).toHaveCount(0);
    await bruno.goto('/quadros/arquivados');
    await expect(bruno.getByRole('button', { name: 'Excluir Produto 2027' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Excluir Produto 2027' }).click();
    const confirm = page.getByRole('dialog', { name: 'Excluir quadro definitivamente' });
    const submit = confirm.getByRole('button', { name: 'Excluir quadro' });
    await expect(submit).toBeDisabled();
    await confirm.getByLabel('Nome do quadro').fill('Produto');
    await expect(submit).toBeDisabled();
    await confirm.getByLabel('Nome do quadro').fill('Produto 2027');
    await submit.click();
    await expect(toast(page, 'Quadro "Produto 2027" excluído.')).toBeVisible();
    await expect(page.getByText('Nenhum quadro arquivado.')).toBeVisible();
    expect((await api.http.get(`/api/boards/${boardId}`)).status()).toBe(404);
  });
});
