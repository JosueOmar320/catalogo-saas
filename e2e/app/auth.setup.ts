import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE, admin, login } from './session';

setup('el administrador inicia sesión', async ({ page }) => {
  expect(admin.password, 'Corre estas pruebas con npm run test:e2e:app').not.toBe('');
  await login(page, admin.username, admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
