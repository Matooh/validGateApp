import { expect, test } from './fixtures';

import { latestQrPayload, resetE2EState, setExitPolicy, setStudentState } from './support/database';
import { fillManualAccessForm, login, selectStudentInGuard } from './support/ui';

test.describe('Ingreso, salida y salida autónoma', () => {
  test.beforeEach(async () => resetE2EState());

  test('PF-ING-001 — Registrar manualmente el ingreso de un estudiante', async ({ page }) => {
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await expect(page.getByLabel(/^Evento/)).toHaveValue('INGRESO');
    await fillManualAccessForm(page);
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByText('Evento registrado')).toBeVisible();
    const recentEvent = page.locator('article').filter({ hasText: 'Estudiante E2E Fuera' }).first();
    await expect(recentEvent).toBeVisible();
    await expect(recentEvent.getByText('Ingreso', { exact: true })).toBeVisible();
    await expect(recentEvent.getByText('Aprobado', { exact: true })).toBeVisible();
  });

  test('PF-ING-003 — Impedir ingreso a estudiante que ya está dentro', async ({ page, captureEvidence }) => {
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await expect(page.getByLabel(/^Evento/)).toHaveValue('SALIDA');
    await expect(page.getByLabel(/^Evento/).locator('option[value="INGRESO"]')).toHaveCount(0);
    await captureEvidence('Estudiante dentro: la interfaz solo permite registrar salida', page.getByLabel(/^Evento/).locator('..'));
  });

  test('PF-SAL-003 — Exigir autenticador según la política de salida', async ({ page }) => {
    await setExitPolicy(true, true);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'REGULAR' });
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByText('La configuración exige QR o PIN para este evento.')).toBeVisible();
    await expect(page).toHaveURL(/\/guard/);
  });

  test('PF-SAL-004 — Confirmar una salida regular mediante QR', async ({ page }) => {
    await setExitPolicy(true, true);
    await setStudentState('inside', { inside: true, canLeaveAlone: true });
    await login(page, 'ESTUDIANTE');
    await page.goto('/authentications');
    await page.getByRole('button', { name: 'Generar QR' }).click();
    await expect(page.getByText('Credencial QR generada correctamente.')).toBeVisible();
    const payload = await latestQrPayload();

    await page.context().clearCookies();
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await page.getByLabel('Payload QR').fill(payload);
    await page.getByRole('button', { name: 'Validar QR' }).click();
    await expect(page.getByText('Credencial QR válida.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar salida' }).click();
    await expect(page.getByText('Salida registrada correctamente.')).toBeVisible();
  });

  test('PF-SAU-001 — Registrar una salida autónoma', async ({ page, captureEvidence }) => {
    await setStudentState('inside', { inside: true, canLeaveAlone: true });
    await login(page, 'ESTUDIANTE');
    const statusSection = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(statusSection.getByText('Dentro de la institución')).toBeVisible();
    await captureEvidence('Estado inicial: estudiante dentro de la institución', statusSection);
    await page.goto('/authentications');
    await page.getByRole('button', { name: 'Generar QR' }).click();
    await expect(page.getByText('Credencial QR generada correctamente.')).toBeVisible();
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Registrar salida' }).click();
    await expect(page.getByText('Salida registrada correctamente.')).toBeVisible();
    await expect(page.getByText('Fuera de la institución')).toBeVisible();
    await captureEvidence('Estado final: salida autónoma registrada', page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]'));
  });
});
