import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

import { latestQrPayload, resetE2EState, setExitPolicy, setStudentState } from './support/database';
import { fillManualAccessForm, login, selectStudentInGuard } from './support/ui';

async function readVisiblePickupPin(page: Page, label: string) {
  const container = page.getByText(label, { exact: true }).locator('..');
  const text = await container.locator('p').nth(1).innerText();
  const pin = text.replace(/\D/g, '');
  expect(pin).toMatch(/^\d{5}$/);
  return pin;
}

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

  test('PF-SAL-004 — Confirmar una salida regular mediante QR', async ({ page, captureEvidence }) => {
    await setExitPolicy(true, true);
    await setStudentState('inside', { inside: true, canLeaveAlone: true });
    await login(page, 'ESTUDIANTE');

    const initialStatusSection = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(initialStatusSection.getByText('Dentro de la institución')).toBeVisible();
    await captureEvidence('Vista 1: estudiante dentro de la institución', initialStatusSection);

    await page.goto('/authentications');
    await page.getByRole('button', { name: 'Generar QR' }).click();
    await expect(page.getByText('Credencial QR generada correctamente.')).toBeVisible();
    const qrCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(qrCard.locator('svg')).toBeVisible();
    await captureEvidence('Vista 2: estudiante genera una credencial QR vigente', qrCard);
    const payload = await latestQrPayload();

    await page.context().clearCookies();
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const qrValidationSection = page.getByRole('heading', { name: 'Validación QR' }).locator('xpath=ancestor::section[1]');
    await page.getByLabel('Payload QR').fill(payload);
    await expect(page.getByRole('button', { name: 'Validar QR' })).toBeEnabled();
    await captureEvidence('Vista 3: QR entregado e ingresado en el módulo de portería', qrValidationSection);

    await page.getByRole('button', { name: 'Validar QR' }).click();
    await expect(page.getByText('Credencial QR válida.')).toBeVisible();
    await expect(qrValidationSection.getByText('Estudiante E2E Dentro')).toBeVisible();
    await expect(qrValidationSection.getByText('Estado: Dentro del establecimiento')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar salida' })).toBeEnabled();
    await captureEvidence('Vista 4: QR registrado y salida habilitada en portería', qrValidationSection);

    await page.getByRole('button', { name: 'Confirmar salida' }).click();
    await expect(page.getByText('Salida registrada correctamente.')).toBeVisible();

    await page.reload();
    const recentExitEvent = page.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Salida' })
      .first();
    await expect(recentExitEvent).toBeVisible();
    await expect(recentExitEvent.getByText('Salida', { exact: true })).toBeVisible();
    await expect(recentExitEvent.getByText('Aprobado', { exact: true })).toBeVisible();
    await captureEvidence('Vista 5: trazabilidad reciente registra la salida aprobada del estudiante', recentExitEvent);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatusSection = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatusSection.getByText('Fuera de la institución')).toBeVisible();
    await captureEvidence('Vista 6: salida permitida y estudiante fuera de la institución', finalStatusSection);
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

  test('PF-SOL-002 — Rechazar la salida de un estudiante que no puede salir solo', async ({ page, captureEvidence }) => {
    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await login(page, 'ESTUDIANTE');

    const studentStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(studentStatus.getByText('Dentro de la institución')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Registrar salida' })).toHaveCount(0);
    await expect(studentStatus.getByRole('heading', { name: 'Solicitud de autorización de salida' })).toBeVisible();
    await captureEvidence('Estudiante sin permiso: la salida directa no está disponible', studentStatus);

    await studentStatus.getByRole('button', { name: 'Solicitar autorización de salida' }).click();
    await expect(page.getByText('Solicitud enviada al apoderado.')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Solicitud en curso' })).toBeDisabled();
    await captureEvidence('Estudiante: solicitud enviada y salida en espera de respuesta', studentStatus);

    await page.context().clearCookies();
    await login(page, 'APODERADO');
    const pendingRequest = page.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ has: page.getByRole('button', { name: 'Rechazar' }) })
      .first();
    await expect(pendingRequest).toBeVisible();
    await expect(pendingRequest).toContainText('Este estudiante no tiene permiso para salir solo.');
    await expect(pendingRequest.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
    await captureEvidence('Apoderado: salida directa bloqueada; solo puede rechazar o iniciar retiro dual', pendingRequest);
    await pendingRequest.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByText('Solicitud rechazada por el apoderado.')).toBeVisible();
    const guardianResponseSection = page.getByRole('heading', { name: 'Solicitudes pendientes' })
      .locator('xpath=ancestor::section[1]');
    await expect(guardianResponseSection.getByText('No hay solicitudes pendientes.')).toBeVisible();
    await captureEvidence('Apoderado: vista inmediatamente posterior al rechazo', guardianResponseSection);

    const rejectedTraceability = page.getByRole('heading', { name: 'Trazabilidad reciente' })
      .locator('xpath=ancestor::section[1]')
      .locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Solicitud de retiro rechazada' })
      .filter({ hasText: 'Rechazado' })
      .first();
    await expect(rejectedTraceability).toBeVisible();
    await captureEvidence('Trazabilidad reciente: solicitud de salida rechazada', rejectedTraceability);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatus.getByText('Dentro de la institución')).toBeVisible();
    await expect(finalStatus.getByRole('button', { name: 'Solicitar autorización de salida' })).toBeEnabled();
    await captureEvidence('Salida rechazada: el estudiante permanece dentro de la institución', finalStatus);
  });

  test('PF-SOL-002 — Aprobar el retiro de un estudiante que no puede salir solo', async ({ page, captureEvidence }) => {
    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await login(page, 'ESTUDIANTE');

    const studentStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(studentStatus.getByText('Dentro de la institución')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Registrar salida' })).toHaveCount(0);
    await studentStatus.getByRole('button', { name: 'Solicitar autorización de salida' }).click();
    await expect(page.getByText('Solicitud enviada al apoderado.')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Solicitud en curso' })).toBeDisabled();
    await captureEvidence('Estudiante: solicitud enviada y retiro pendiente de aprobación', studentStatus);

    await page.context().clearCookies();
    await login(page, 'APODERADO');
    const pendingRequest = page.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ has: page.getByRole('button', { name: 'Iniciar retiro con PIN dual' }) })
      .first();
    await expect(pendingRequest).toBeVisible();
    await expect(pendingRequest).toContainText('Este estudiante no tiene permiso para salir solo.');
    await expect(pendingRequest).toContainText('La salida directa no puede aprobarse');
    await expect(pendingRequest.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
    await captureEvidence('Apoderado: salida directa bloqueada y retiro con PIN dual disponible', pendingRequest);
    await pendingRequest.getByRole('button', { name: 'Iniciar retiro con PIN dual' }).click();
    await expect(page.getByText('Solicitud aprobada. Presenten ambos PIN en portería para confirmar el retiro.')).toBeVisible();

    const guardianPickup = page.getByRole('heading', { name: 'Retiros en curso' })
      .locator('xpath=ancestor::section[1]');
    await expect(guardianPickup.getByText('Pendiente de validación en portería')).toBeVisible();
    const guardianPin = await readVisiblePickupPin(page, 'Tu PIN de apoderado');
    await captureEvidence('Apoderado: aprobación genera PIN y mantiene el retiro pendiente', guardianPickup);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const studentPickup = page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' })
      .locator('xpath=ancestor::section[1]');
    const studentPin = await readVisiblePickupPin(page, 'Tu PIN de estudiante');
    expect(studentPin).not.toBe(guardianPin);
    await expect(studentStatus.getByText('Dentro de la institución')).toBeVisible();
    await captureEvidence('Estudiante: PIN disponible y estado aún dentro de la institución', studentPickup);

    await page.context().clearCookies();
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    let pickupAtGate = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(pickupAtGate.getByLabel('PIN de apoderado')).toBeVisible();
    await captureEvidence('Portería: retiro pendiente de validar ambas identidades', pickupAtGate);

    await pickupAtGate.getByLabel('PIN de apoderado').fill(guardianPin);
    await pickupAtGate.getByLabel('PIN de apoderado').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    pickupAtGate = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await captureEvidence('Portería: identidad del apoderado validada presencialmente', pickupAtGate);

    await pickupAtGate.getByLabel('PIN de estudiante').fill(studentPin);
    await pickupAtGate.getByLabel('PIN de estudiante').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText('Ambos validados', { exact: true })).toBeVisible();
    pickupAtGate = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await captureEvidence('Portería: apoderado y estudiante validados mediante PIN dual', pickupAtGate);

    await page.getByRole('button', { name: 'Confirmar retiro efectivo' }).click();
    await expect(page.getByText('Retiro confirmado y salida registrada.')).toBeVisible();
    await page.getByText('Retiros finalizados recientemente').click();
    const completedPickup = page.getByText('Retiros finalizados recientemente').locator('..');
    await expect(completedPickup.getByText('Completado', { exact: true })).toBeVisible();
    await captureEvidence('Portería: retiro confirmado después de la validación presencial', completedPickup);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatus.getByText('Fuera de la institución')).toBeVisible();
    await captureEvidence('Estado final: estudiante fuera tras confirmación de portería', finalStatus);
  });
});
