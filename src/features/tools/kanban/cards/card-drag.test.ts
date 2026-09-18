import { describe, expect, it } from 'vitest';

import {
  moveAcrossLists,
  placementAmongVisible,
  placementAtPosition,
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

  it('"Mover para…": a posição conta cards sendo criados, mas o placement os ignora', () => {
    const pending = new Set(['tmp1']);
    expect(placementAtPosition(['a', 'b', 'tmp1'], 4, 'x', pending)).toEqual({ type: 'end' });
    expect(placementAtPosition(['a', 'b', 'tmp1'], 3, 'x', pending)).toEqual({ type: 'end' });
    expect(placementAtPosition(['a', 'tmp1', 'b'], 3, 'x', pending)).toEqual({
      type: 'after',
      id: 'a',
    });
    expect(placementAtPosition(['tmp1', 'a'], 2, 'x', pending)).toEqual({ type: 'start' });
    expect(placementAtPosition(['a', 'b'], 2, 'x')).toEqual({ type: 'after', id: 'a' });
  });

  it('cards ainda sendo criados (id temporário) nunca viram vizinho do placement', () => {
    const withTemp: CardOrder = { todo: ['a', 'tmp1', 'b', 'c'], doing: ['d'] };
    const pending = new Set(['tmp1']);

    // c sobe para o lugar de b, logo depois de tmp1: o vizinho conhecido anterior é a.
    expect(
      resolveCardDrop(withTemp, withTemp, 'c', { type: 'card', id: 'b' }, undefined, pending),
    ).toEqual({ listId: 'todo', position: 3, placement: { type: 'after', id: 'a' } });

    // Sem pendentes, o mesmo arraste usaria o temporário.
    expect(resolveCardDrop(withTemp, withTemp, 'c', { type: 'card', id: 'b' })?.placement).toEqual({
      type: 'after',
      id: 'tmp1',
    });

    // Vindo de outra lista, d entra logo depois de tmp1.
    const current = moveAcrossLists(withTemp, 'd', { type: 'card', id: 'b' });
    expect(
      resolveCardDrop(
        withTemp,
        current,
        'd',
        { type: 'list-body', listId: 'todo' },
        undefined,
        pending,
      ),
    ).toEqual({ listId: 'todo', position: 3, placement: { type: 'after', id: 'a' } });

    // Temporário no topo: logo depois dele vira "start".
    const tempFirst: CardOrder = { todo: ['tmp1', 'a', 'b'] };
    expect(
      resolveCardDrop(tempFirst, tempFirst, 'b', { type: 'card', id: 'a' }, undefined, pending)
        ?.placement,
    ).toEqual({ type: 'start' });

    // Com filtro: o temporário também sai da ordem completa.
    const visible: CardOrder = { todo: ['a', 'b'] };
    expect(
      resolveCardDrop(
        visible,
        visible,
        'b',
        { type: 'card', id: 'a' },
        { todo: ['x', 'tmp1', 'a', 'b'] },
        pending,
      )?.placement,
    ).toEqual({ type: 'after', id: 'x' });
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
