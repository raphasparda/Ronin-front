import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fieldFromPath, fixFieldsMessage, schemaResolver, splitErrorDetails } from './form-errors';

describe('splitErrorDetails', () => {
  it('distribui details pelos campos na ordem do formulário e separa os desconhecidos', () => {
    const result = splitErrorDetails(
      [
        { path: 'password', message: 'Senha curta' },
        { path: 'body.email', message: 'E-mail inválido.' },
        { path: 'email', message: 'Segunda mensagem do mesmo campo' },
        { path: 'extra', message: 'Campo inesperado' },
      ],
      ['email', 'password'] as const,
    );

    expect(result.fieldErrors).toEqual([
      ['email', 'E-mail inválido.'],
      ['password', 'Senha curta.'],
    ]);
    expect(result.other).toEqual(['Campo inesperado.']);
  });

  it('extrai o campo do path', () => {
    expect(fieldFromPath('body.name')).toBe('name');
    expect(fieldFromPath('items.0.text')).toBe('items');
    expect(fieldFromPath('')).toBe('');
  });
});

describe('schemaResolver', () => {
  const schema = z.object({ name: z.string().trim().min(1, { error: 'Nome obrigatório' }) });
  const options = { fields: {}, shouldUseNativeValidation: false };

  it('usa a mensagem da tela por código e devolve os valores transformados', async () => {
    const resolver = schemaResolver(schema, { name: { too_small: 'Informe seu nome.' } });

    expect(await resolver({ name: '  ' }, undefined, options)).toEqual({
      values: {},
      errors: { name: { type: 'too_small', message: 'Informe seu nome.' } },
    });
    expect(await resolver({ name: ' Ana ' }, undefined, options)).toEqual({
      values: { name: 'Ana' },
      errors: {},
    });
  });

  it('sem mensagem da tela, usa a do schema como frase', async () => {
    const resolver = schemaResolver(schema);

    const result = await resolver({ name: '' }, undefined, options);

    expect(result.errors).toEqual({ name: { type: 'too_small', message: 'Nome obrigatório.' } });
  });
});

describe('fixFieldsMessage', () => {
  it('concorda em número', () => {
    expect(fixFieldsMessage(1)).toBe('Corrija 1 campo para continuar.');
    expect(fixFieldsMessage(2)).toBe('Corrija 2 campos para continuar.');
  });
});
