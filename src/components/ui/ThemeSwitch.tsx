import { Moon, Sun } from 'lucide-react';

import { setTheme, useTheme } from '../../lib/theme';

export function ThemeSwitch() {
  const isDark = useTheme() === 'dark';

  return (
    <div className="flex items-center gap-1.5 text-muted">
      <Sun aria-hidden size={14} className="max-[25rem]:hidden" />
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Tema escuro"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="group relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-border-strong bg-surface-sunken transition-colors duration-150 ease-standard after:absolute after:-inset-2 after:content-[''] aria-checked:border-accent aria-checked:bg-accent"
      >
        <span
          aria-hidden
          className="size-4 translate-x-[2px] rounded-full bg-muted transition-transform duration-150 ease-standard group-aria-checked:translate-x-[20px] group-aria-checked:bg-on-accent"
        />
      </button>
      <Moon aria-hidden size={14} className="max-[25rem]:hidden" />
    </div>
  );
}
