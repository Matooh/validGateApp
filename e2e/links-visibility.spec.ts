import { expect, test } from './fixtures';

import type { E2ERole } from './support/env';
import { resetE2EState } from './support/database';
import { login } from './support/ui';

test.describe('Visibilidad de vínculos', () => {
  test.beforeEach(async () => resetE2EState());

  for (const role of ['APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    test(`PF-VIN-001 — ${role} consulta sus vínculos`, async ({ page }) => {
      await login(page, role);
      await page.goto('/links');

      await expect(page.getByRole('heading', { name: 'Vínculos' })).toBeVisible();
      await expect(page.getByText('No fue posible cargar los vínculos.')).toHaveCount(0);
      await expect(page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' })).toBeVisible();

      if (role === 'APODERADO') {
        await expect(page.getByLabel('Estudiante')).toContainText('Estudiante E2E Dentro');
      }
    });
  }
});
