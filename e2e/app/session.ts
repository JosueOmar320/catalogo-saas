import type { Page } from '@playwright/test';

/** Sesión del administrador de prueba (la guarda auth.setup.ts; está en .gitignore). */
export const ADMIN_STATE = 'e2e/.auth/admin.json';

export const admin = {
  username: process.env.E2E_ADMIN_USERNAME ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? '',
};

/** Login por la interfaz, como lo hace una persona. */
export async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Nombre de usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
