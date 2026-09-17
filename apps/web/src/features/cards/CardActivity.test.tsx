import { ACTIVITY_TYPES, type Activity, type ActivityEntry } from '@kanban/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActivityItem, type ActivityContext } from './CardActivity';

const ANA = '0f5b8f5e-6d0c-4f8e-9a51-6a7f2a6f1c11';
const BRUNO = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const LIST_A = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const LIST_B = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const BOARD_A = '6d3f1a2b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
const BOARD_B = '7e4a2b3c-5d6e-4f7a-9b0c-1d2e3f4a5b6c';

const ctx: ActivityContext = {
  userName: (id) => (id === ANA ? 'Ana Souza' : id === BRUNO ? 'Bruno Lima' : 'Alguém'),
  listColor: (id) => (id === LIST_A ? 'blue' : undefined),
  timeZone: 'America/Sao_Paulo',
};

function phrase(entry: ActivityEntry, actorId = ANA): string {
  const activity = {
    id: crypto.randomUUID(),
    cardId: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    actorId,
    createdAt: '2026-09-16T14:03:00.000Z',
    ...entry,
  } as Activity;
  const { unmount } = render(
    <ol>
      <ActivityItem activity={activity} ctx={ctx} />
    </ol>,
  );
  const text = (screen.getByRole('listitem').querySelector('p')?.textContent ?? '').replace(
    /\s+/g,
    ' ',
  );
  unmount();
  return text;
}

const moved = {
  fromListId: LIST_A,
  fromListName: 'A fazer',
  toListId: LIST_B,
  toListName: 'Fazendo',
  fromBoardId: BOARD_A,
  fromBoardName: 'Site',
  toBoardId: BOARD_A,
  toBoardName: 'Site',
};

const cases: Array<[ActivityEntry, string, string?]> = [
  [
    { type: 'card_created', data: { listId: LIST_A, listName: 'A fazer' } },
    'Ana Souza criou o card em A fazer',
  ],
  [
    { type: 'card_title_changed', data: { from: 'Menu', to: 'Corrigir menu do rodapé' } },
    'Ana Souza mudou o título de "Menu" para "Corrigir menu do rodapé"',
  ],
  [{ type: 'card_moved', data: moved }, 'Ana Souza moveu de A fazer para Fazendo'],
  [
    { type: 'card_moved', data: { ...moved, toBoardId: BOARD_B, toBoardName: 'App mobile' } },
    'Ana Souza moveu para o quadro App mobile Fazendo',
  ],
  [{ type: 'card_assignee_added', data: { userId: BRUNO } }, 'Ana Souza atribuiu Bruno Lima'],
  [{ type: 'card_assignee_added', data: { userId: ANA } }, 'Ana Souza se atribuiu ao card'],
  [{ type: 'card_assignee_removed', data: { userId: BRUNO } }, 'Ana Souza removeu Bruno Lima'],
  [
    { type: 'card_assignee_removed', data: { userId: ANA } },
    'Ana Souza deixou de ser responsável pelo card',
  ],
  [
    {
      type: 'card_due_changed',
      data: { from: null, to: '2026-09-14T21:00:00.000Z', hasTime: true },
    },
    'Ana Souza definiu o prazo para 14 set, 18:00',
  ],
  [
    {
      type: 'card_due_changed',
      data: { from: '2026-09-15T02:59:59.999Z', to: '2026-09-21T02:59:59.999Z', hasTime: false },
    },
    'Ana Souza alterou o prazo de 14 set para 20 set',
  ],
  [
    {
      type: 'card_due_changed',
      data: { from: '2026-09-15T02:59:59.999Z', to: null, hasTime: false },
    },
    'Ana Souza removeu o prazo',
  ],
  [
    { type: 'card_priority_changed', data: { from: null, to: 'urgent' } },
    'Ana Souza definiu a prioridade como Urgente',
  ],
  [
    { type: 'card_priority_changed', data: { from: 'medium', to: 'urgent' } },
    'Ana Souza alterou a prioridade de Média para Urgente',
  ],
  [
    { type: 'card_priority_changed', data: { from: 'low', to: null } },
    'Ana Souza removeu a prioridade Baixa',
  ],
  [{ type: 'card_completed', data: {} }, 'Ana Souza concluiu o card'],
  [{ type: 'card_reopened', data: {} }, 'Ana Souza reabriu o card'],
  [{ type: 'card_archived', data: {} }, 'Ana Souza arquivou o card'],
  [{ type: 'card_restored', data: {} }, 'Ana Souza restaurou o card'],
];

describe('Histórico do card: frases pt-BR', () => {
  it.each(cases)('%o', (entry, expected) => {
    expect(phrase(entry)).toBe(expected);
  });

  it('cobre os 11 tipos de atividade', () => {
    expect(new Set(cases.map(([entry]) => entry.type))).toEqual(new Set(ACTIVITY_TYPES));
  });

  it('lista com cor aparece como pílula colorida; sem lista ativa, pílula neutra', () => {
    render(
      <ol>
        <ActivityItem
          ctx={ctx}
          activity={{
            id: crypto.randomUUID(),
            cardId: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
            actorId: BRUNO,
            createdAt: '2026-09-16T14:03:00.000Z',
            type: 'card_moved',
            data: moved,
          }}
        />
      </ol>,
    );

    expect(screen.getByText('A fazer')).toHaveAttribute('data-color', 'blue');
    expect(screen.getByText('Fazendo')).not.toHaveAttribute('data-color');
    expect(screen.getByText('16 set, 11:03')).toHaveAttribute(
      'datetime',
      '2026-09-16T14:03:00.000Z',
    );
  });
});
