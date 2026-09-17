import { DEFAULT_TIMEZONE } from '@kanban/shared';

import type { SelectOption } from '../components/ui/Select';

let timezoneOptions: SelectOption[] | undefined;

/** Fusos IANA do runtime, em ordem alfabética, com o padrão sempre presente. */
export function getTimezoneOptions(): SelectOption[] {
  if (!timezoneOptions) {
    const zones = new Set(Intl.supportedValuesOf('timeZone'));
    zones.add(DEFAULT_TIMEZONE);
    timezoneOptions = [...zones]
      .sort((a, b) => a.localeCompare(b))
      .map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }));
  }
  return timezoneOptions;
}
