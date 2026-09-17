import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../test/server';
import { renderWithProviders } from '../../test/render';
import { HealthStatus } from './HealthStatus';

describe('HealthStatus', () => {
  it('mostra API online quando o health responde 200', async () => {
    renderWithProviders(<HealthStatus />);

    expect(screen.getByText('Verificando…', { selector: 'span' })).toBeInTheDocument();
    expect(await screen.findByText('API online')).toBeInTheDocument();
  });

  it('mostra banco indisponível no 503 da API', async () => {
    server.use(
      http.get('/api/health', () =>
        HttpResponse.json(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco indisponível.' } },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<HealthStatus />);

    expect(await screen.findByText('Banco indisponível')).toBeInTheDocument();
  });

  it('mostra API offline sem quebrar a página e permite verificar de novo', async () => {
    server.use(http.get('/api/health', () => HttpResponse.error()));
    const user = userEvent.setup();

    renderWithProviders(<HealthStatus />);

    expect(await screen.findByText('API offline')).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Verificar de novo' }));

    expect(await screen.findByText('API online')).toBeInTheDocument();
  });
});
