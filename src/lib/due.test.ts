import { describe, expect, it } from 'vitest';

import { describeDue, dueInputToIso, isoToDueInput, timeZoneDisplayName } from './due';

const TZ = 'America/Sao_Paulo';
const NOW = new Date('2026-09-17T15:00:00.000Z'); // 12:00 em São Paulo

describe('dueInputToIso / isoToDueInput', () => {
  it('sem hora vale 23:59:59.999 do dia no fuso do workspace', () => {
    expect(dueInputToIso({ date: '2026-09-20', time: null }, TZ)).toBe('2026-09-21T02:59:59.999Z');
  });

  it('com hora converte para UTC e volta', () => {
    const iso = dueInputToIso({ date: '2026-09-20', time: '14:30' }, TZ);
    expect(iso).toBe('2026-09-20T17:30:00.000Z');
    expect(isoToDueInput(iso, true, TZ)).toEqual({ date: '2026-09-20', time: '14:30' });
    expect(isoToDueInput('2026-09-21T02:59:59.999Z', false, TZ)).toEqual({
      date: '2026-09-20',
      time: null,
    });
  });
});

describe('describeDue', () => {
  const open = (dueAt: string | null, dueHasTime = false) => ({
    status: 'open' as const,
    dueAt,
    dueHasTime,
  });

  it('sem prazo e aberto: nada', () => {
    expect(describeDue(open(null), TZ, NOW)).toBeNull();
  });

  it('atrasado, vencendo e agendado sempre com texto', () => {
    expect(describeDue(open('2026-09-14T02:59:59.999Z'), TZ, NOW)).toEqual({
      state: 'overdue',
      text: 'Atrasado · 13 set',
      spoken: 'Atrasado, 13 de setembro',
    });
    expect(describeDue(open('2026-09-17T21:00:00.000Z', true), TZ, NOW)).toEqual({
      state: 'due_soon',
      text: 'Vencendo · hoje 18:00',
      spoken: 'Vencendo, hoje 18:00',
    });
    expect(describeDue(open('2026-09-18T12:00:00.000Z', true), TZ, NOW)?.text).toBe(
      'Vencendo · amanhã 09:00',
    );
    expect(describeDue(open('2026-09-30T17:00:00.000Z', true), TZ, NOW)).toEqual({
      state: 'scheduled',
      text: '30 set, 14:00',
      spoken: 'Prazo 30 de setembro, 14:00',
    });
    expect(describeDue(open('2027-01-05T02:59:59.999Z'), TZ, NOW)?.text).toBe('4 jan 2027');
  });

  it('concluído mostra "Concluído" com ou sem prazo', () => {
    expect(describeDue({ ...open(null), status: 'completed' }, TZ, NOW)?.text).toBe('Concluído');
    expect(
      describeDue({ ...open('2026-09-14T02:59:59.999Z'), status: 'completed' }, TZ, NOW)?.text,
    ).toBe('Concluído · 13 set');
  });
});

describe('timeZoneDisplayName', () => {
  it('nome amigável do fuso', () => {
    expect(timeZoneDisplayName(TZ)).toMatch(/Brasília/);
    expect(timeZoneDisplayName(undefined)).toBe('');
  });
});
