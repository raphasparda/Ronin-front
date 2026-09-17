import { describe, expect, it } from 'vitest';

import {
  moveAcrossLists,
  placementAmongVisible,
  resolveCardDrop,
  type CardOrder,
} from './card-drag';

const original: CardOrder = { todo: ['a', 'b', 'c'], doing: ['d'], done: [] };

describe('arrastar cards', () => {
  it('ao passar para outra lista, entra no lugar do card apontado', () => {
    expect(moveAcrossLists(original, 'a', { type: 'card', id: 'd' })).toEqual({
      todo: ['b', 'c'],
      doing: ['a', 'd'],
      done: [],
    });
  });

  it('sobre o corpo de uma lista vazia, vai para o fim', () => {
    expect(moveAcrossLists(original, 'b', { type: 'list-body', listId: 'done' })).toEqual({
      todo: ['a', 'c'],
      doing: ['d'],
      done: ['b'],
    });
  });

  it('dentro da mesma lista não muda a ordem provisória', () => {
    expect(moveAcrossLists(original, 'a', { type: 'card', id: 'c' })).toBe(original);
  });

  it('soltar na mesma lista reordena e gera o placement', () => {
    expect(resolveCardDrop(original, original, 'a', { type: 'card', id: 'c' })).toEqual({
      listId: 'todo',
      position: 3,
      placement: { type: 'end' },
    });
    expect(resolveCardDrop(original, original, 'c', { type: 'card', id: 'b' })).toEqual({
      listId: 'todo',
      position: 2,
      placement: { type: 'after', id: 'a' },
    });
    expect(resolveCardDrop(original, original, 'b', { type: 'card', id: 'a' })).toEqual({
      listId: 'todo',
      position: 1,
      placement: { type: 'start' },
    });
  });

  it('soltar em outra lista usa a ordem provisória', () => {
    const current = moveAcrossLists(original, 'c', { type: 'list-body', listId: 'doing' });
    expect(resolveCardDrop(original, current, 'c', { type: 'list-body', listId: 'doing' })).toEqual(
      {
        listId: 'doing',
        position: 2,
        placement: { type: 'end' },
      },
    );
  });

  it('voltar ao mesmo lugar não gera movimento', () => {
    expect(resolveCardDrop(original, original, 'b', { type: 'card', id: 'b' })).toBeNull();
    expect(resolveCardDrop(original, original, 'b', null)).toBeNull();
  });

  describe('com filtro ativo (vizinhos visíveis)', () => {
    // Ordem completa: a, x, b, y, c. Ocultos pelo filtro: x e y.
    const full: CardOrder = { todo: ['a', 'x', 'b', 'y', 'c'], doing: ['d', 'z'] };
    const visible: CardOrder = { todo: ['a', 'b', 'c'], doing: ['d'] };

    it('fica logo depois do visível anterior', () => {
      expect(resolveCardDrop(visible, visible, 'a', { type: 'card', id: 'c' }, full)).toEqual({
        listId: 'todo',
        position: 3,
        placement: { type: 'after', id: 'c' },
      });
      expect(placementAmongVisible(full.todo ?? [], ['b', 'c', 'a'], 'c')).toEqual({
        type: 'after',
        id: 'b',
      });
    });

    it('no topo visível, fica logo antes do próximo visível (depois do oculto)', () => {
      expect(resolveCardDrop(visible, visible, 'c', { type: 'card', id: 'b' }, full)).toEqual({
        listId: 'todo',
        position: 2,
        placement: { type: 'after', id: 'a' },
      });
      expect(placementAmongVisible(full.todo ?? [], ['c', 'a', 'b'], 'c')).toEqual({
        type: 'start',
      });
      expect(placementAmongVisible(full.todo ?? [], ['b', 'a', 'c'], 'b')).toEqual({
        type: 'start',
      });
      expect(placementAmongVisible(['x', 'a', 'b'], ['c', 'a', 'b'], 'c')).toEqual({
        type: 'after',
        id: 'x',
      });
    });

    it('em lista sem cards visíveis vai para o fim', () => {
      expect(placementAmongVisible(['h1', 'h2'], ['a'], 'a')).toEqual({ type: 'end' });
    });
  });
});
