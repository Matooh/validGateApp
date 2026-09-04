import { expect, test } from './fixtures';

import { resolveE2EData, resetE2EState } from './support/database';
import { login } from './support/ui';

test.describe('Detalle y configuración del estudiante', () => {
  test.beforeEach(async () => resetE2EState());

  test('PF-EST-DET-002 — Estudiante - Al consultar detalle, se debe validar que RUT y teléfono se formateen antes de guardar', async ({ page }) => {
    const { students } = await resolveE2EData();
    await login(page, 'APODERADO');
    await page.goto(`/students/${students.inside}`);

    const form = page.getByRole('heading', { name: 'Configuración del estudiante' }).locator('xpath=ancestor::form[1]');
    const rut = form.locator('#validated-rut');
    const phone = form.locator('#validated-phone');
    await rut.fill('123');
    await rut.blur();
    await phone.fill('123');
    await phone.blur();

    await expect(rut).toHaveAttribute('aria-invalid', 'true');
    await expect(phone).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled();
  });
});
