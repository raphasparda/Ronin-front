import { describe, expect, it } from 'vitest';

import { loginPath, safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('aceita caminhos internos com query e fragmento', () => {
    expect(safeNextPath('/b/123')).toBe('/b/123');
    expect(safeNextPath('/b/123/c/9?responsavel=me#topo')).toBe('/b/123/c/9?responsavel=me#topo');
  });

  it.each([
    null,
    undefined,
    '',
    'b/123',
    '//evil.com',
    '//evil.com/login',
    '/\\evil.com',
    '/a\\b',
    'https://evil.com',
    'javascript:alert(1)',
    '/\tevil',
  ])('recusa %s e usa /', (value) => {
    expect(safeNextPath(value)).toBe('/');
  });

  it('não volta para as telas de autenticação', () => {
    expect(safeNextPath('/login?next=/x')).toBe('/');
    expect(safeNextPath('/setup')).toBe('/');
  });
});

describe('loginPath', () => {
  it('guarda a rota atual no next, exceto a raiz', () => {
    expect(loginPath('/')).toBe('/login');
    expect(loginPath('/b/1?q=a')).toBe('/login?next=%2Fb%2F1%3Fq%3Da');
    expect(loginPath('//evil.com')).toBe('/login');
  });
});
