import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export type Theme = 'light' | 'dark';

/** Mesma chave de `src/lib/theme.ts` e `public/theme-init.js`. */
export const THEME_STORAGE_KEY = 'ronin.theme';

/** Grava o tema no localStorage antes de qualquer script da página rodar. */
export async function presetTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    THEME_STORAGE_KEY,
    theme,
  ] as const);
}

/**
 * Janelas entram com fade/escala (globals.css §6): medir contraste ou tamanho de alvo no meio
 * da animação dá falso positivo. Espera as animações finitas em curso terminarem
 * (skeleton e spinners são infinitos e ficam de fora).
 */
export async function waitForFiniteAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** Confere que o tema foi aplicado e roda o axe (WCAG 2.x A/AA): zero violações sérias/críticas. */
export async function expectNoSeriousA11yViolations(page: Page, theme: Theme): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await waitForFiniteAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, summary: n.failureSummary })),
    }));
  expect(serious, `violações axe (tema ${theme}) em ${page.url()}`).toEqual([]);
}
