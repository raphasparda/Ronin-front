function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('pt-BR', options).formatToParts(date)) {
    result[part.type] = part.value;
  }
  return result;
}

/** "23 set" (com o ano só quando é diferente do atual): datas curtas de screens.md. */
export function formatShortDate(iso: string, timeZone?: string, now = new Date()): string {
  const date = new Date(iso);
  const {
    day = '',
    month = '',
    year = '',
  } = parts(date, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
  const currentYear = parts(now, { year: 'numeric', timeZone }).year;
  const label = `${day} ${month.replace('.', '')}`;
  return year === currentYear ? label : `${label} ${year}`;
}

/** "23 set, 14:00". */
export function formatShortDateTime(iso: string, timeZone?: string, now = new Date()): string {
  const { hour = '', minute = '' } = parts(new Date(iso), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  return `${formatShortDate(iso, timeZone, now)}, ${hour}:${minute}`;
}

/** "Maria" de "Maria Clara Souza". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "agora", "há 5 min", "há 2 h", "ontem" ou a data curta (comentários, screens §8.9). */
export function formatRelativeTime(iso: string, timeZone?: string, now = new Date()): string {
  const elapsed = now.getTime() - Date.parse(iso);
  if (elapsed < MINUTE_MS) return 'agora';
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < 24 * HOUR_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  if (elapsed < 48 * HOUR_MS) return 'ontem';
  return formatShortDate(iso, timeZone, now);
}
