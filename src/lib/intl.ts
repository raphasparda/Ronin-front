const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * `Intl.DateTimeFormat` reaproveitado por locale + opções: criar um formatter é caro e a face de
 * cada card formata datas a cada render (mesmo padrão de `src/lib/time.ts` do ronin-api).
 */
export function dateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}
