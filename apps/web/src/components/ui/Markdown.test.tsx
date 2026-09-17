import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Markdown } from './Markdown';

describe('Markdown sem HTML (ADR 0007)', () => {
  it('<script>, <img onerror> e javascript: não viram HTML nem executam', () => {
    const { container } = render(
      <Markdown>
        {[
          '<script>window.__xss = 1</script>',
          '',
          '<img src="x" onerror="window.__xss = 2">',
          '',
          '[clique](javascript:window.__xss=3)',
        ].join('\n')}
      </Markdown>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container).toHaveTextContent('<script>window.__xss = 1</script>');
    expect(container).toHaveTextContent('<img src="x" onerror="window.__xss = 2">');
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect((window as { __xss?: number }).__xss).toBeUndefined();
  });

  it('links abrem em nova aba sem opener e avisam o leitor de tela', () => {
    render(<Markdown>{'Veja [a doc](https://exemplo.com/doc).'}</Markdown>);

    const link = screen.getByRole('link', { name: 'a doc (abre em nova aba)' });
    expect(link).toHaveAttribute('href', 'https://exemplo.com/doc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('imagem vira link e títulos não entram na hierarquia da página', () => {
    const { container } = render(
      <Markdown>{'# Título\n\n![logo](https://exemplo.com/l.png)'}</Markdown>,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'logo (abre em nova aba)' })).toBeVisible();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Título')).toBeVisible();
  });

  it('formatação básica com GFM', () => {
    render(<Markdown>{'**negrito**\n\n- um\n- dois\n\n`código`'}</Markdown>);

    expect(screen.getByText('negrito').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('código').tagName).toBe('CODE');
  });
});
