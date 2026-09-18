import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { ColorSwatch } from './ColorSwatch';
import { Input } from './Input';
import { PriorityBadge } from './PriorityBadge';
import { Toaster } from './Toast';
import { MAX_TOASTS, TOAST_DURATION_MS, toast } from './toast-store';

describe('PriorityBadge', () => {
  it('mostra ícone e texto, com nome completo para leitor de tela', () => {
    render(<PriorityBadge priority="urgent" />);

    const badge = screen.getByText('Urgente').closest('[data-priority]');
    expect(badge).toHaveAttribute('data-priority', 'urgent');
    expect(badge).toHaveTextContent('Prioridade Urgente');
    expect(badge?.querySelector('svg')).not.toBeNull();
  });

  it('não renderiza nada sem prioridade', () => {
    const { container } = render(<PriorityBadge priority={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('Avatar', () => {
  const ID = '0f5b8f5e-6d0c-4f8e-9a51-6a7f2a6f1c11';

  it('sem foto: iniciais e cor estável pelo id', () => {
    const { container } = render(<Avatar id={ID} name="Ana Souza" />);

    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(container.querySelector('[data-color]')).toHaveAttribute('data-color');
  });

  it('com foto: imagem versionada que volta às iniciais se não carregar', () => {
    const { container } = render(
      <Avatar id={ID} name="Ana Souza" avatarUpdatedAt="2026-09-17T10:00:00.000Z" />,
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', `/api/users/${ID}/avatar?v=2026-09-17T10%3A00%3A00.000Z`);

    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AS')).toBeInTheDocument();
  });
});

describe('ColorSwatch', () => {
  it('tem nome acessível da cor e indica seleção', () => {
    render(
      <>
        <ColorSwatch color="blue" />
        <ColorSwatch color="magenta" selected />
      </>,
    );

    expect(screen.getByRole('img', { name: 'Azul' })).toHaveAttribute('data-color', 'blue');
    expect(screen.getByRole('img', { name: 'Magenta, selecionada' })).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('liga rótulo, dica e erro ao campo', () => {
    render(
      <Input label="E-mail" hint="Use o e-mail da empresa." error="Digite um e-mail válido." />,
    );

    const field = screen.getByLabelText('E-mail');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Digite um e-mail válido. Use o e-mail da empresa.');
  });
});

describe('Button', () => {
  it('no carregamento fica ocupado, desabilitado e mostra o gerúndio', () => {
    render(
      <Button loading loadingText="Salvando…">
        Salvar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Salvando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Toaster', () => {
  it('some sozinho depois de 5s, mas erro fica até fechar', async () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.success('Card concluído.');
      toast.error('Algo deu errado. Tente de novo.');
    });

    expect(screen.getByRole('status')).toHaveTextContent('Card concluído.');
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado.');

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    vi.useRealTimers();

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it(`mostra no máximo ${MAX_TOASTS} avisos`, () => {
    render(<Toaster />);

    act(() => {
      ['Um', 'Dois', 'Três', 'Quatro'].forEach((message) => toast.info(message));
    });

    expect(screen.getAllByRole('status').map((item) => item.textContent)).toEqual([
      'Dois',
      'Três',
      'Quatro',
    ]);
  });
});
