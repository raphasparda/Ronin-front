import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { requestsTo, TOKEN } from '../../test/admin-handlers';
import { authHandlers, sessionFixture } from '../../test/auth-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

const userMenuName = `Menu da conta de ${sessionFixture.user.name}`;
const toastMessages = () => getToasts().map((item) => item.message);

function memberRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  if (!row) throw new Error(`Linha de ${name} não encontrada.`);
  return row;
}

describe('acesso à administração', () => {
  it('Member não vê o menu de administração e recebe aviso na rota', async () => {
    server.use(
      authHandlers.me({ ...sessionFixture, user: { ...sessionFixture.user, role: 'member' } }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: userMenuName }));
    expect(screen.getByRole('menuitem', { name: 'Meu perfil' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Membros' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Convites' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Equipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administração' })).not.toBeInTheDocument();

    await router.navigate('/admin/membros');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Área de administração' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Você não tem permissão para isso/)).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Membros da equipe' })).not.toBeInTheDocument();
  });

  it('Admin vê Membros, Convites e Equipe no menu e o link no cabeçalho', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');

    expect(await screen.findByRole('link', { name: 'Administração' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: userMenuName }));
    await user.click(screen.getByRole('menuitem', { name: 'Convites' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Convites' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/convites');
    expect(screen.getByRole('link', { name: 'Convites' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('/admin/membros', () => {
  it('lista membros; a própria linha não tem papel editável nem ações', async () => {
    renderApp('/admin/membros');

    const list = await screen.findByRole('list', { name: 'Membros da equipe' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);

    const self = memberRow(sessionFixture.user.name);
    expect(within(self).getByText('(você)')).toBeInTheDocument();
    expect(within(self).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(self).queryByRole('button', { name: /Ações para/ })).not.toBeInTheDocument();

    expect(within(memberRow('Carla Dias')).getByText('Desativado')).toBeVisible();
    expect(within(memberRow('Usuário removido')).getByText('Anonimizado')).toBeVisible();
  });

  it('desativar pede confirmação e atualiza o status', async () => {
    const user = userEvent.setup();
    renderApp('/admin/membros');

    await user.click(await screen.findByRole('button', { name: 'Ações para Bruno Lima' }));
    await user.click(screen.getByRole('menuitem', { name: 'Desativar' }));

    const dialog = screen.getByRole('dialog', { name: 'Desativar Bruno Lima?' });
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() =>
      expect(within(memberRow('Bruno Lima')).getByText('Desativado')).toBeVisible(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toastMessages()).toContain('A conta de Bruno Lima foi desativada.');
  });

  it('rebaixar para Membro pede confirmação', async () => {
    const user = userEvent.setup();
    renderApp('/admin/membros');

    await screen.findByRole('list', { name: 'Membros da equipe' });
    const select = within(memberRow('Bruno Lima')).getByRole('combobox', {
      name: 'Papel de Bruno Lima',
    });
    await user.selectOptions(select, 'admin');
    await waitFor(() => expect(select).toHaveValue('admin'));

    await user.selectOptions(select, 'member');
    const dialog = screen.getByRole('dialog', { name: 'Tornar Bruno Lima Membro?' });
    expect(select).toHaveValue('admin');
    await user.click(within(dialog).getByRole('button', { name: 'Tornar Membro' }));

    await waitFor(() => expect(select).toHaveValue('member'));
    expect(requestsTo('role').map((item) => item.body)).toEqual([
      { role: 'admin' },
      { role: 'member' },
    ]);
  });

  it('link de redefinição aparece uma vez, com aviso, e copiar anuncia sucesso', async () => {
    const user = userEvent.setup();
    renderApp('/admin/membros');

    await user.click(await screen.findByRole('button', { name: 'Ações para Bruno Lima' }));
    await user.click(screen.getByRole('menuitem', { name: 'Gerar link de redefinição de senha' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Link de redefinição para Bruno Lima',
    });
    expect(within(dialog).getByText(/canal privado/)).toBeVisible();
    expect(
      within(dialog).getByText('Este link não aparece de novo. Gerar outro cancela este.'),
    ).toBeVisible();
    const link = within(dialog).getByLabelText('Link de redefinição');
    expect(link).toHaveValue(`http://localhost:5310/redefinir-senha#token=${TOKEN}`);
    expect(link).toHaveAttribute('readonly');

    await user.click(within(dialog).getByRole('button', { name: 'Copiar link' }));

    expect(await within(dialog).findByRole('button', { name: 'Copiado' })).toBeVisible();
    const live = within(dialog).getByText('Link copiado.');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(await navigator.clipboard.readText()).toBe(
      `http://localhost:5310/redefinir-senha#token=${TOKEN}`,
    );
  });

  it('falha ao copiar anuncia a instrução de copiar manualmente', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    renderApp('/admin/membros');

    await user.click(await screen.findByRole('button', { name: 'Ações para Bruno Lima' }));
    await user.click(screen.getByRole('menuitem', { name: 'Gerar link de redefinição de senha' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Copiar link' }));

    const message = await within(dialog).findByText(
      'Não foi possível copiar. Selecione o link e copie manualmente.',
    );
    expect(message).toHaveAttribute('aria-live', 'polite');
  });

  it('usuário desativado não pode receber link de redefinição', async () => {
    const user = userEvent.setup();
    renderApp('/admin/membros');

    await user.click(await screen.findByRole('button', { name: 'Ações para Carla Dias' }));
    const item = screen.getByRole('menuitem', { name: /Gerar link de redefinição de senha/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('Reative a conta antes de gerar o link.');
    expect(screen.getByRole('menuitem', { name: 'Reativar' })).toBeInTheDocument();
  });
});

describe('/admin/convites', () => {
  it('cria convite sem e-mail (envia null), mostra o link uma vez e copia', async () => {
    const user = userEvent.setup();
    renderApp('/admin/convites');

    await user.click(await screen.findByRole('button', { name: 'Novo convite' }));
    const form = screen.getByRole('dialog', { name: 'Novo convite' });
    expect(within(form).getByRole('radio', { name: 'Membro' })).toBeChecked();
    await user.click(within(form).getByRole('button', { name: 'Criar convite' }));

    const created = await screen.findByRole('dialog', { name: 'Convite criado' });
    expect(requestsTo('invites')[0]?.body).toEqual({ email: null, role: 'member' });
    expect(within(created).getByLabelText('Link do convite')).toHaveValue(
      `http://localhost:5310/convite#token=${TOKEN}`,
    );
    expect(within(created).getByText('Este link não aparece de novo.')).toBeVisible();

    await user.click(within(created).getByRole('button', { name: 'Copiar link' }));
    expect(await within(created).findByText('Link copiado.')).toHaveAttribute(
      'aria-live',
      'polite',
    );

    await user.click(within(created).getByRole('button', { name: 'Concluir' }));
    const pending = await screen.findByRole('list', { name: 'Convites pendentes' });
    await waitFor(() => expect(within(pending).getAllByRole('listitem')).toHaveLength(2));
  });

  it('valida o e-mail e mostra EMAIL_TAKEN no campo', async () => {
    const user = userEvent.setup();
    renderApp('/admin/convites');

    await user.click(await screen.findByRole('button', { name: 'Novo convite' }));
    const dialog = screen.getByRole('dialog', { name: 'Novo convite' });
    const email = within(dialog).getByLabelText('E-mail (opcional)');

    await user.type(email, 'bruno@');
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }));
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        'Digite um e-mail válido, como nome@empresa.com. Se preencher, só este e-mail poderá usar o convite.',
      ),
    );
    expect(requestsTo('invites')).toEqual([]);

    await user.type(email, 'empresa.com');
    await user.click(within(dialog).getByRole('radio', { name: 'Admin' }));
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }));

    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        'Já existe uma conta com este e-mail. Se preencher, só este e-mail poderá usar o convite.',
      ),
    );
    expect(requestsTo('invites')[0]?.body).toEqual({ email: 'bruno@empresa.com', role: 'admin' });
  });

  it('revoga convite pendente com confirmação inline e mostra o histórico', async () => {
    const user = userEvent.setup();
    renderApp('/admin/convites');

    const history = await screen.findByRole('list', { name: 'Histórico de convites' });
    expect(within(history).getByText('Usado')).toBeVisible();
    expect(within(history).getByText('por Bruno Lima')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Revogar convite Sem e-mail' }));
    expect(screen.getByText('Revogar este convite? O link deixa de funcionar.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Revogar' }));

    expect(await screen.findByText('Nenhum convite pendente.')).toBeVisible();
    expect(toastMessages()).toContain('Convite revogado.');
    expect(
      within(screen.getByRole('list', { name: 'Histórico de convites' })).getByText('Revogado'),
    ).toBeVisible();
  });
});

describe('/admin/workspace', () => {
  it('salva só o que mudou e atualiza a sessão', async () => {
    const user = userEvent.setup();
    renderApp('/admin/workspace');

    const save = await screen.findByRole('button', { name: 'Salvar' });
    expect(save).toBeDisabled();

    const name = screen.getByLabelText('Nome da equipe');
    await user.clear(name);
    await user.type(name, 'Equipe Nova');
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(toastMessages()).toContain('Dados da equipe atualizados.'));
    expect(requestsTo('workspace')[0]?.body).toEqual({ name: 'Equipe Nova' });
    await waitFor(() => expect(save).toBeDisabled());
  });

  it('nome vazio é validado no cliente', async () => {
    const user = userEvent.setup();
    renderApp('/admin/workspace');

    const name = await screen.findByLabelText('Nome da equipe');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(name).toHaveAccessibleDescription('Informe o nome da equipe.'));
    expect(requestsTo('workspace')).toEqual([]);
  });
});
