import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import themeInitScript from '../../../public/theme-init.js?raw';
import { THEME_STORAGE_KEY } from '../../lib/theme';
import { ThemeSwitch } from './ThemeSwitch';

const html = document.documentElement;

describe('ThemeSwitch', () => {
  it('começa no tema claro, desligado', () => {
    render(<ThemeSwitch />);

    const toggle = screen.getByRole('switch', { name: 'Tema escuro' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('liga o tema escuro, aplica no <html> e persiste', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);
    const toggle = screen.getByRole('switch', { name: 'Tema escuro' });

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(html).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(html).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('alterna pelo teclado (Espaço e Enter)', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);
    const toggle = screen.getByRole('switch', { name: 'Tema escuro' });

    await user.tab();
    expect(toggle).toHaveFocus();

    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('reflete o tema já aplicado pelo theme-init.js', () => {
    html.setAttribute('data-theme', 'dark');
    render(<ThemeSwitch />);

    expect(screen.getByRole('switch', { name: 'Tema escuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('public/theme-init.js', () => {
  const runScript = () => {
    // jsdom não executa <script>; o eval global roda o arquivo como o navegador faria.
    window.eval(themeInitScript);
  };

  it('aplica o tema salvo antes do React montar', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    html.removeAttribute('data-theme');

    runScript();

    expect(html).toHaveAttribute('data-theme', 'dark');
  });

  it('usa o tema claro sem preferência salva ou com valor inválido', () => {
    html.removeAttribute('data-theme');
    runScript();
    expect(html).toHaveAttribute('data-theme', 'light');

    window.localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    runScript();
    expect(html).toHaveAttribute('data-theme', 'light');
  });
});
