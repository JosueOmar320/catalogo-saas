import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Revisión automática de accesibilidad (axe, WCAG 2.1 A y AA) de lo que está
 * en pantalla. Falla con la lista de problemas: regla, elementos y por qué.
 */
export async function expectAccessible(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const report = violations.map((v) => `${label} · ${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `   ${n.target.join(' ')}`).join('\n')}`);
  expect(report, report.join('\n\n')).toEqual([]);
}
