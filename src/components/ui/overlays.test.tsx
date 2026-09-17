import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Dialog';
import { Menu, MenuItem } from './Menu';
import { Popover } from './Popover';
import { computeAnchoredPosition } from './use-anchored-position';

const VIEWPORT = { width: 412, height: 800 };

function rect(top: number, height = 40, left = 20, width = 100): DOMRect {
  return DOMRect.fromRect({ x: left, y: top, width, height });
}

describe('computeAnchoredPosition', () => {
  const options = { width: 288, align: 'left' as const };

  it('abre abaixo do botão quando cabe', () => {
    expect(computeAnchoredPosition(rect(100), 300, options, VIEWPORT)).toEqual({
      top: 148,
      left: 20,
      maxHeight: 636,
    });
  });

  it('abre acima quando não cabe abaixo e há mais espaço em cima', () => {
    const style = computeAnchoredPosition(rect(700), 300, options, VIEWPORT);
    expect(style).toEqual({ bottom: 108, left: 20, maxHeight: 676 });
  });

  it('limita a altura ao espaço disponível (rola por dentro) e nunca sai da tela', () => {
    const style = computeAnchoredPosition(rect(420), 2000, options, VIEWPORT);
    expect(style).toEqual({ bottom: 388, left: 20, maxHeight: 396 });
  });

  it('com o botão fora da tela, o painel fica preso à borda visível', () => {
    const style = computeAnchoredPosition(rect(1200), 200, options, VIEWPORT);
    expect(style.bottom).toBe(16);
  });

  it('mantém o lado atual enquanto couber nele', () => {
    const style = computeAnchoredPosition(rect(500), 100, options, VIEWPORT, 'above');
    expect(style.bottom).toBeDefined();
  });

  it('alinha à direita sem passar da margem da tela', () => {
    const style = computeAnchoredPosition(
      rect(100, 40, 300, 100),
      100,
      {
        width: 288,
        align: 'right',
      },
      VIEWPORT,
    );
    expect(style.left).toBe(108);
  });
});

describe('Popover', () => {
  it('não fecha ao rolar a página e avisa cada abertura', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <Popover trigger="Abrir" panelLabel="Painel" onOpen={onOpen}>
        <input aria-label="Busca" />
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('group', { name: 'Painel' })).toBeVisible();
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.scroll(window);
    fireEvent.scroll(document.body);
    expect(screen.getByRole('group', { name: 'Painel' })).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Painel' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('fecha ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover trigger="Abrir" panelLabel="Painel">
          <input aria-label="Busca" />
        </Popover>
        <p>Fora</p>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByText('Fora'));
    expect(screen.queryByRole('group', { name: 'Painel' })).toBeNull();
  });
});

describe('Menu', () => {
  it('o primeiro item recebe o foco já com o painel posicionado (sem rolar o contêiner)', async () => {
    const user = userEvent.setup();
    render(
      <Menu label="Opções" trigger="⋯">
        <MenuItem onSelect={() => {}}>Renomear</MenuItem>
      </Menu>,
    );
    const button = screen.getByRole('button', { name: 'Opções' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(100, 40, 200, 40));
    let styleAtFocus = '';
    const onFocus = (event: FocusEvent) => {
      const panel = (event.target as HTMLElement).closest('[role="menu"]')?.parentElement
        ?.parentElement;
      styleAtFocus = panel?.getAttribute('style') ?? '';
    };
    document.addEventListener('focusin', onFocus);

    await user.click(button);

    document.removeEventListener('focusin', onFocus);
    expect(screen.getByRole('menuitem', { name: 'Renomear' })).toHaveFocus();
    expect(styleAtFocus).toContain('top: 148px');
    expect(styleAtFocus).toContain('left: 16px');
  });
});

describe('Menu ao rolar', () => {
  function renderMenu() {
    render(
      <Menu label="Opções" trigger="⋯">
        <MenuItem onSelect={() => {}}>Renomear</MenuItem>
      </Menu>,
    );
    return screen.getByRole('button', { name: 'Opções' });
  }

  it('continua aberto quando a rolagem mantém o botão na tela (só reposiciona)', async () => {
    const user = userEvent.setup();
    const button = renderMenu();
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(100, 40, 200, 40));
    await user.click(button);

    fireEvent.scroll(document.body);
    expect(screen.getByRole('menu', { name: 'Opções' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Renomear' })).toHaveFocus();
  });

  it('fecha quando a rolagem tira o botão da tela', async () => {
    const user = userEvent.setup();
    const button = renderMenu();
    const box = vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(100, 40, 200, 40));
    await user.click(button);

    box.mockReturnValue(rect(-200, 40, 200, 40));
    fireEvent.scroll(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

function Editor({ onClose }: { onClose: () => void }) {
  const [editing, setEditing] = useState(true);
  return (
    <Modal open onClose={onClose} labelledBy="titulo" className="">
      <h2 id="titulo" tabIndex={-1}>
        Detalhe
      </h2>
      {editing ? (
        <button type="button" onClick={() => setEditing(false)}>
          Salvar
        </button>
      ) : (
        <p>Salvo</p>
      )}
      <button type="button">Outro</button>
    </Modal>
  );
}

describe('Modal', () => {
  it('quando o elemento focado some, o foco volta ao diálogo e Esc fecha', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Editor onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Salvo')).toBeInTheDocument();
    await act(() => Promise.resolve());
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('com o foco no <body>, Esc fecha e Tab volta para dentro do diálogo', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Editor onClose={onClose} />);

    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus();

    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
