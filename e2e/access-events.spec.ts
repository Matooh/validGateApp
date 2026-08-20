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

  test('PF-ING-001 — Mantener el formulario al refrescar el estado de portería', async ({ page }) => {
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await fillManualAccessForm(page);

    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(1_000);

    await expect(page.getByLabel('Buscador de estudiante')).toHaveValue('Estudiante E2E Fuera');
    await expect(page.getByLabel(/^Evento/)).toHaveValue('INGRESO');
    await expect(page.getByLabel(/Método de validación/)).toHaveValue('MANUAL');
    await expect(page.getByLabel(/Motivo de contingencia/)).toHaveValue('SIN_DISPOSITIVO');
    await expect(page.getByLabel(/Resultado/)).toHaveValue('APROBADO');
  });

  test('PF-ING-001 — Explicar la política, resumir con viñetas y destacar la observación faltante', async ({ page }) => {
    await setExitPolicy(true, true);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await expect(page.getByRole('heading', { name: 'Registro manual de ingreso y salida' })).toBeVisible();
    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await page.getByLabel(/Método de validación/).selectOption('MANUAL');
    await expect(page.getByLabel('Tipo de contingencia')).toHaveValue('CONTINGENCIA_SIN_DISPOSITIVO');
    await page.getByLabel(/Motivo de contingencia/).selectOption('OTRO');
    await page.getByLabel(/Resultado/).selectOption('APROBADO');
    await page.getByLabel('Descripción del evento').fill('Ingreso manual documentado');

    const summary = page.getByText('Resumen de selección', { exact: true }).locator('..');
    await expect(summary.locator('ul > li')).toHaveCount(2);
    await expect(summary).toContainText('Se APRUEBA ENTRADA para Estudiante E2E Fuera mediante REGISTRO MANUAL.');
    await expect(summary).toContainText('Contingencia: Dispositivo.');

    const policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy.locator('ul > li')).toHaveCount(2);
    await expect(policy).toContainText('Ingreso: Autónomo; registro manual permitido.');
    await expect(policy).toContainText('Salida: QR/PIN obligatorio; el retiro requiere validación dual');

    await page.getByLabel('Descripción del evento').fill('');
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Revisa la información antes de continuar' }))
      .toContainText('Debes registrar una observación para la contingencia.');
    await expect(page.getByLabel('Descripción del evento')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Describe la contingencia antes de registrar el evento.')).toBeVisible();
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

  test('PF-SAL-003 — Permitir una salida excepcional documentada', async ({ page }) => {
    await setExitPolicy(true, true);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'EXCEPCIONAL' });

    const policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy).toContainText('Excepcional: omite QR/PIN y aprobación; observación obligatoria.');
    await page.getByRole('button', { name: 'Registrar evento' }).click();

    await expect(page.getByText('Evento registrado')).toBeVisible();
    const recentEvent = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(recentEvent.getByText('Excepcional', { exact: true })).toBeVisible();
    await expect(recentEvent.getByText('Aprobado', { exact: true })).toBeVisible();
  });

  test('PF-SAL-003 — Solicitar aprobación del apoderado para salida por contingencia', async ({ page }) => {
    await setExitPolicy(true, true);
    await setStudentState('inside', { inside: true, canLeaveAlone: true });
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'SOLO' });

    const summary = page.getByText('Resumen de selección', { exact: true }).locator('..');
    await expect(summary).toContainText('Se SOLICITA AUTORIZACIÓN DE SALIDA');
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByText(/Solicitud de contingencia enviada al apoderado/)).toBeVisible();

    await page.context().clearCookies();
    await login(page, 'APODERADO');
    const pendingRequest = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).filter({ hasText: 'Salida manual por contingencia' }).first();
    await expect(pendingRequest).toBeVisible();
    await pendingRequest.getByRole('button', { name: 'Aprobar' }).click();

    await expect(page.getByText('Solicitud aprobada por el apoderado.')).toBeVisible();
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).filter({ hasText: 'Fuera de institución' }).first();
    await expect(studentCard).toBeVisible();
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
