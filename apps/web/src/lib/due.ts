import { getDueState, type CardStatus, type DueInput, type DueState } from '@kanban/shared';

import { dateTimeFormat } from './intl';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(ms: number, timeZone: string | undefined): ZonedParts {
  const values: Record<string, number> = {};
  const formatter = dateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  for (const part of formatter.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Diferença (ms) entre o relógio do fuso e o UTC no instante dado. */
function offsetMs(utcMs: number, timeZone: string | undefined): number {
  const p = zonedParts(utcMs, timeZone);
  const wholeSeconds = Math.floor(utcMs / 1000) * 1000;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - wholeSeconds;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Prazo local do workspace → ISO UTC, como o servidor grava (overview §4.3): sem hora, vale
 * `23:59:59.999` do dia. Usado no update otimista e no mock da API.
 */
export function dueInputToIso({ date, time }: DueInput, timeZone: string | undefined): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const [hour, minute] = time ? time.split(':').map(Number) : [23, 59];
  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour ?? 0,
    minute ?? 0,
    time ? 0 : 59,
    time ? 0 : 999,
  );
  let utc = localAsUtc - offsetMs(localAsUtc, timeZone);
  utc = localAsUtc - offsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

/** ISO UTC → `{ date, time }` no fuso do workspace (valores iniciais do formulário de prazo). */
export function isoToDueInput(
  iso: string,
  hasTime: boolean,
  timeZone: string | undefined,
): DueInput {
  const p = zonedParts(Date.parse(iso), timeZone);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: hasTime ? `${pad(p.hour)}:${pad(p.minute)}` : null,
  };
}

function dayNumber(ms: number, timeZone: string | undefined): number {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day) / DAY_MS;
}

type MonthStyle = 'short' | 'long';

function formatDate(ms: number, timeZone: string | undefined, now: Date, month: MonthStyle) {
  const parts: Record<string, string> = {};
  const formatter = dateTimeFormat('pt-BR', {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone,
  });
  for (const part of formatter.formatToParts(new Date(ms))) parts[part.type] = part.value;
  const sameYear = zonedParts(ms, timeZone).year === zonedParts(now.getTime(), timeZone).year;
  const monthName = (parts.month ?? '').replace('.', '');
  const base = month === 'long' ? `${parts.day} de ${monthName}` : `${parts.day} ${monthName}`;
  if (sameYear) return base;
  return month === 'long' ? `${base} de ${parts.year}` : `${base} ${parts.year}`;
}

function formatTime(ms: number, timeZone: string | undefined): string {
  const p = zonedParts(ms, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export interface DueDisplay {
  state: Exclude<DueState, 'none'>;
  /** Texto curto da pílula ("Atrasado · 14 set"). */
  text: string;
  /** Mesmo conteúdo para leitor de tela ("Atrasado, 14 de setembro"). */
  spoken: string;
}

export interface DueCard {
  status: CardStatus;
  dueAt: string | null;
  dueHasTime: boolean;
}

/**
 * Texto do prazo na face e no detalhe (screens §7.3), sempre com o estado por extenso (RN17).
 * `null` quando o card está aberto e sem prazo.
 */
export function describeDue(
  card: DueCard,
  timeZone: string | undefined,
  now: Date,
): DueDisplay | null {
  const state = getDueState(card, now);
  if (state === 'none') return null;

  if (card.dueAt === null) {
    return { state, text: 'Concluído', spoken: 'Concluído' };
  }

  const dueMs = Date.parse(card.dueAt);
  const days = dayNumber(dueMs, timeZone) - dayNumber(now.getTime(), timeZone);
  const time = card.dueHasTime ? formatTime(dueMs, timeZone) : null;
  const relative = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : days === -1 ? 'ontem' : null;

  const when = (month: MonthStyle) => {
    if (relative) return time ? `${relative} ${time}` : relative;
    const date = formatDate(dueMs, timeZone, now, month);
    return time ? `${date}, ${time}` : date;
  };
  const withPrefix = (prefix: string) => ({
    text: `${prefix} · ${when('short')}`,
    spoken: `${prefix}, ${when('long')}`,
  });

  switch (state) {
    case 'overdue':
      return { state, ...withPrefix('Atrasado') };
    case 'due_soon':
      return { state, ...withPrefix('Vencendo') };
    case 'completed':
      return { state, ...withPrefix('Concluído') };
    case 'scheduled':
      return { state, text: when('short'), spoken: `Prazo ${when('long')}` };
  }
}

/** "Horário de Brasília" para `America/Sao_Paulo`; o próprio id quando o runtime não tem nome. */
export function timeZoneDisplayName(timeZone: string | undefined): string {
  if (!timeZone) return '';
  try {
    const name = dateTimeFormat('pt-BR', { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    return name ?? timeZone;
  } catch {
    return timeZone;
  }
}
