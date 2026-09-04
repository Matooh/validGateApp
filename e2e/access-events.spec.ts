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

  test('PF-SAL-QR-002 — Un estudiante sin salida autónoma solo genera QR cuando está fuera', async ({ page }) => {
    await setStudentState('inside', { inside: false, canLeaveAlone: false });
    await login(page, 'ESTUDIANTE');
    await page.goto('/authentications');

    const qrButton = page.getByRole('button', { name: 'Generar QR', exact: true });
    await expect(qrButton).toBeEnabled();

    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Generar QR', exact: true })).toBeDisabled();
    await expect(page.getByText(/No se puede generar un QR de salida mientras el estudiante/)).toBeVisible();
  });

  test('PF-ING-001A — Registrar manualmente el ingreso de un estudiante', async ({ page, captureEvidence }) => {
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await captureEvidence('Paso 1: Porteria accede al registro manual de ingreso y salida');
    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await expect(page.getByLabel(/^Evento/)).toHaveValue('INGRESO');
    await expect(page.locator('#guard-course-filter')).toHaveValue(/Curso/);
    const manualForm = page.getByRole('heading', { name: 'Registro manual de ingreso y salida' }).locator('xpath=ancestor::form[1]');
    await captureEvidence('Paso 2: estudiante fuera seleccionado, curso autocompletado y evento Ingreso disponible', manualForm);
    await fillManualAccessForm(page);
    await captureEvidence('Paso 3: formulario de ingreso manual completo antes de registrar', manualForm);
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByText('Evento registrado')).toBeVisible();
    await captureEvidence('Paso 4: el ingreso manual fue registrado correctamente', undefined, { preserveToast: true });
    const recentEvents = page.getByRole('heading', { name: 'Eventos recientes' }).locator('xpath=ancestor::section[1]');
    const recentEvent = recentEvents.locator('article').filter({ hasText: 'Estudiante E2E Fuera' }).first();
    await expect(recentEvent).toBeVisible();
    await expect(recentEvent.getByText('Ingreso', { exact: true })).toBeVisible();
    await expect(recentEvent.getByText('Aprobado', { exact: true })).toBeVisible();
    await captureEvidence('Paso 5: trazabilidad muestra el evento como Ingreso aprobado', recentEvents);
  });

  test('PF-ING-001B — Validar políticas y observación obligatoria', async ({ page, captureEvidence }) => {
    await setStudentState('inside', { inside: true, canLeaveAlone: true });
    await setStudentState('outside', { inside: false, canLeaveAlone: true });
    await setExitPolicy(true, true);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await expect(page.getByRole('heading', { name: 'Registro manual de ingreso y salida' })).toBeVisible();

    const manualForm = page.getByRole('heading', { name: 'Registro manual de ingreso y salida' }).locator('xpath=ancestor::form[1]');

    // 1. Estudiante dentro que puede salir solo: política autónoma.
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'SOLO' });
    let policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy).toContainText('Salida: QR obligatorio para salida autónoma');
    await captureEvidence('Escenario 1: estudiante dentro autorizado para salir solo', policy);

    // 2. Estudiante dentro que no puede salir solo: política de PIN dual.
    await setStudentState('inside', { canLeaveAlone: false });
    await page.reload();
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'REGULAR' });
    policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy).toContainText('Salida: PIN dual obligatorio y excluyente');
    await captureEvidence('Escenario 2: estudiante dentro sin permiso de salida autónoma', policy);

    // 3. Estudiante fuera que puede salir solo: la política contextual se conserva.
    await setStudentState('outside', { canLeaveAlone: true });
    await page.reload();
    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await fillManualAccessForm(page);
    policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy).toContainText('Salida: QR obligatorio para salida autónoma');
    await captureEvidence('Escenario 3: estudiante fuera autorizado para salir solo', policy);

    // 4. Estudiante fuera que no puede salir solo: política dual y observación obligatoria.
    await setStudentState('outside', { canLeaveAlone: false });
    await page.reload();
    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await captureEvidence('Escenario 4: estudiante fuera sin permiso de salida autónoma', manualForm);
    await page.getByLabel(/Método de validación/).selectOption('MANUAL');
    await expect(page.getByLabel('Tipo de contingencia')).toHaveValue('CONTINGENCIA_SIN_DISPOSITIVO');
    await page.getByLabel(/Motivo de contingencia/).selectOption('OTRO');
    await page.getByLabel(/Resultado/).selectOption('APROBADO');
    await captureEvidence('Escenario 4: contingencia completa; falta la descripción', manualForm);
    await page.getByLabel('Descripción del evento').fill('Ingreso manual documentado');

    const summary = page.getByText('Resumen de selección', { exact: true }).locator('..');
    await expect(summary.locator('ul > li')).toHaveCount(2);
    await expect(summary).toContainText('Se APRUEBA ENTRADA para Estudiante E2E Fuera mediante REGISTRO MANUAL.');
    await expect(summary).toContainText('Contingencia: Dispositivo.');

    policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy.locator('ul > li')).toHaveCount(2);
    await expect(policy).toContainText('Ingreso: Autónomo; registro manual permitido.');
    await expect(policy).toContainText('Salida: PIN dual obligatorio y excluyente');
    await captureEvidence('Escenario 4: resumen y política en viñetas', manualForm);

    await page.getByLabel('Descripción del evento').fill('');
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Revisa la información antes de continuar' }))
      .toContainText('Debes registrar una observación para la contingencia.');
    await expect(page.getByLabel('Descripción del evento')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Describe la contingencia antes de registrar el evento.')).toBeVisible();
    await captureEvidence('Escenario 4: observación faltante destacada junto al resumen de errores', manualForm);
  });

  test('PF-ING-003 — Rechazar ingreso de estudiante que ya está dentro', async ({ page, captureEvidence }) => {
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const manualForm = page.getByRole('heading', { name: 'Registro manual de ingreso y salida' }).locator('xpath=ancestor::form[1]');
    await captureEvidence('Paso 1: módulo de portería antes de consultar al estudiante', manualForm);
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await captureEvidence('Paso 2: estudiante dentro seleccionado en portería', manualForm);
    await expect(page.getByLabel(/^Evento/)).toHaveValue('SALIDA');
    await expect(page.getByLabel(/^Evento/).locator('option[value="INGRESO"]')).toHaveCount(0);
    await captureEvidence('Paso 3: el combo de evento solo ofrece Salida', manualForm);
  });

  test('PF-SAL-003A — Exigir autenticador según la política de salida', async ({ page, captureEvidence }) => {
    test.setTimeout(60_000);
    await setStudentState('outside', { inside: true, canLeaveAlone: true });
    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await setExitPolicy(true, true);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const manualForm = page.getByRole('heading', { name: 'Registro manual de ingreso y salida' }).locator('xpath=ancestor::form[1]');

    await selectStudentInGuard(page, 'Estudiante E2E Fuera');
    await page.getByLabel(/Tipo salida/).selectOption('SOLO');
    await page.getByLabel(/Método de validación/).selectOption('QR');
    await page.getByLabel(/Resultado/).selectOption('APROBADO');
    await page.getByLabel(/Descripción del evento/).fill('Salida autónoma mediante QR para prueba E2E');
    const autonomousSummary = manualForm.getByText('Resumen de selección', { exact: true }).locator('..');
    await expect(autonomousSummary).toContainText('Estudiante E2E Fuera');
    await expect(autonomousSummary).toContainText('QR');
    await captureEvidence('Paso 1: estudiante autorizado para salir solo seleccionado', autonomousSummary);
    let appliedPolicy = manualForm.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(appliedPolicy).toContainText('QR obligatorio para salida autónoma');
    await captureEvidence('Paso 2: para quien puede salir solo, la política normal exige QR', appliedPolicy);

    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'REGULAR' });
    const selectionSummary = manualForm.getByText('Resumen de selección', { exact: true }).locator('..');
    await expect(selectionSummary).toContainText('Estudiante E2E Dentro');
    await captureEvidence('Paso 3: estudiante que no puede salir solo intenta un registro manual', selectionSummary);

    appliedPolicy = manualForm.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(appliedPolicy).toContainText('PIN dual obligatorio y excluyente');
    await expect(appliedPolicy).toContainText('el QR individual no autoriza la salida');
    await captureEvidence('Paso 4: para quien no puede salir solo, la política exige ambos PIN', appliedPolicy);

    await page.getByRole('button', { name: 'Registrar evento' }).click();
    const policyWarning = manualForm.getByRole('alert');
    await expect(policyWarning).toContainText('El estudiante no puede salir solo.');
    await expect(policyWarning).toContainText('PIN del estudiante y el PIN de su responsable');
    await expect(page).toHaveURL(/\/guard/);
    await captureEvidence('Paso 5: el formulario bloquea el registro manual y deriva al PIN dual', policyWarning);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatus.getByText('Dentro de la institución')).toBeVisible();
    await captureEvidence('Paso 6: la salida no se registró y el estudiante permanece dentro', finalStatus);
  });

  test('PF-SAL-003B — Permitir una salida excepcional documentada', async ({ page, captureEvidence }) => {
    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await setExitPolicy(true, true);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const manualForm = page.getByRole('heading', { name: 'Registro manual de ingreso y salida' }).locator('xpath=ancestor::form[1]');
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await expect(page.getByLabel(/^Evento/)).toHaveValue('SALIDA');
    await expect(page.locator('#guard-course-filter')).toHaveValue(/Curso/);
    await captureEvidence('Paso 1: estudiante dentro seleccionado, curso autocompletado y evento Salida', manualForm);
    await fillManualAccessForm(page, { exitKind: 'EXCEPCIONAL' });
    await expect(page.getByLabel(/Tipo salida/)).toHaveValue('EXCEPCIONAL');
    await expect(page.getByLabel(/Método de validación/)).toHaveValue('MANUAL');
    await expect(page.getByLabel(/Motivo de contingencia/)).toHaveValue('SIN_DISPOSITIVO');
    await expect(page.getByLabel(/Descripción del evento/)).toHaveValue('Contingencia controlada para prueba E2E');

    const policy = page.getByText('Política aplicada', { exact: true }).locator('..');
    await expect(policy).toContainText('Excepcional: omite QR/PIN y aprobación; observación obligatoria.');
    await captureEvidence('Paso 2: salida excepcional del estudiante que no puede salir solo, documentada y explicada', manualForm);
    await page.getByRole('button', { name: 'Registrar evento' }).click();

    await expect(page.getByText('Evento registrado')).toBeVisible();
    await captureEvidence('Paso 3: toast confirma la salida excepcional', undefined, { preserveToast: true });
    const recentEvents = page.getByRole('heading', { name: 'Eventos recientes' }).locator('xpath=ancestor::section[1]');
    const recentEvent = recentEvents.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(recentEvent.getByText('Excepcional', { exact: true })).toBeVisible();
    await expect(recentEvent.getByText('Aprobado', { exact: true })).toBeVisible();
    await expect(recentEvent).toContainText('Contingencia controlada para prueba E2E');
    await captureEvidence('Paso 4: sección completa de trazabilidad registra la salida excepcional aprobada', recentEvents);
  });

  test('PF-SAL-003C — Solicitar aprobación del Apoderado Primario para salida por contingencia', async ({ page, captureEvidence }) => {
    await setExitPolicy(true, true);
    await setStudentState('inside', { inside: true, canLeaveAlone: true });
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const manualForm = page.getByRole('heading', { name: 'Registro manual de ingreso y salida' }).locator('xpath=ancestor::form[1]');
    await selectStudentInGuard(page, 'Estudiante E2E Dentro');
    await fillManualAccessForm(page, { exitKind: 'SOLO' });

    const summary = page.getByText('Resumen de selección', { exact: true }).locator('..');
    await expect(summary).toContainText('Se SOLICITA AUTORIZACIÓN DE SALIDA');
    await captureEvidence('Paso 1: portería prepara la solicitud de contingencia al Apoderado Primario', manualForm);
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByText(/Solicitud de contingencia enviada al Apoderado Primario/)).toBeVisible();
    await captureEvidence('Paso 2: portería recibe confirmación de solicitud enviada', undefined, { preserveToast: true });

    await page.context().clearCookies();
    await login(page, 'APODERADO');
    const pendingRequest = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).filter({ hasText: 'Salida manual por contingencia' }).first();
    await expect(pendingRequest).toBeVisible();
    await captureEvidence('Paso 3: Apoderado Primario recibe la solicitud para su estudiante', pendingRequest);
    await pendingRequest.getByRole('button', { name: 'Aprobar' }).click();

    await expect(page.getByText('Solicitud aprobada por el Apoderado Primario.')).toBeVisible();
    await captureEvidence('Paso 4: Apoderado Primario aprueba la salida por contingencia', undefined, { preserveToast: true });
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).filter({ hasText: 'Fuera de institución' }).first();
    await expect(studentCard).toBeVisible();
    await captureEvidence('Paso 5: estudiante queda fuera tras la aprobación', studentCard);

    const recentTraceability = page.getByRole('heading', { name: 'Trazabilidad reciente' })
      .locator('xpath=ancestor::section[1]');
    const contingencyEvent = recentTraceability.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Contingencia' })
      .filter({ hasText: 'Manual' })
      .first();
    await expect(contingencyEvent).toBeVisible();
    await expect(contingencyEvent.getByText('Aprobado', { exact: true })).toBeVisible();
    await captureEvidence('Paso 6: sección completa de trazabilidad registra la salida por contingencia aprobada', recentTraceability);
  });

  test('PF-SAL-004 — Confirmar una salida autónoma a estudiante que puede salir solo mediante QR', async ({ page, captureEvidence }) => {
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
    const recentEvents = page.getByRole('heading', { name: 'Eventos recientes' }).locator('xpath=ancestor::section[1]');
    const recentExitEvent = recentEvents.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Salida' })
      .first();
    await expect(recentExitEvent).toBeVisible();
    await expect(recentExitEvent.getByText('Salida', { exact: true })).toBeVisible();
    await expect(recentExitEvent.getByText('Aprobado', { exact: true })).toBeVisible();
    await captureEvidence('Vista 5: sección completa de trazabilidad registra la salida aprobada del estudiante', recentEvents);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatusSection = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatusSection.getByText('Fuera de la institución')).toBeVisible();
    await captureEvidence('Vista 6: salida permitida y estudiante fuera de la institución', finalStatusSection);
  });

  test('PF-SOL-002B — Rechazar la salida de un estudiante que no puede salir solo', async ({ page, captureEvidence }) => {
    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await login(page, 'ESTUDIANTE');

    const studentStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(studentStatus.getByText('Dentro de la institución')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Registrar salida' })).toHaveCount(0);
    await expect(studentStatus.getByRole('heading', { name: 'Solicitud de autorización de salida' })).toBeVisible();
    await captureEvidence('Estudiante sin permiso: la salida directa no está disponible', studentStatus);

    await studentStatus.getByRole('button', { name: 'Solicitar autorización de salida' }).click();
    await expect(page.getByText('Solicitud enviada a tus apoderados vinculados.')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Solicitud en curso' })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Solicitud en curso' })).toBeDisabled();
    await expect(page.getByText(/Tus apoderados ya fueron notificados/)).toBeVisible();
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
    await captureEvidence('Apoderado Primario: salida directa bloqueada; solo puede rechazar o iniciar retiro dual', pendingRequest);
    await pendingRequest.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByText('Solicitud rechazada por el Apoderado Primario.')).toBeVisible();
    const guardianResponseSection = page.getByRole('heading', { name: 'Solicitudes pendientes' })
      .locator('xpath=ancestor::section[1]');
    await expect(guardianResponseSection.getByText('No hay solicitudes pendientes.')).toBeVisible();
    await captureEvidence('Apoderado Primario: vista inmediatamente posterior al rechazo', guardianResponseSection);

    const recentTraceability = page.getByRole('heading', { name: 'Trazabilidad reciente' })
      .locator('xpath=ancestor::section[1]');
    const rejectedTraceability = recentTraceability
      .locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Solicitud de retiro rechazada' })
      .filter({ hasText: 'Rechazado' })
      .first();
    await expect(rejectedTraceability).toBeVisible();
    await captureEvidence('Trazabilidad reciente completa: solicitud de salida rechazada', recentTraceability);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatus.getByText('Dentro de la institución')).toBeVisible();
    await expect(finalStatus.getByRole('button', { name: 'Solicitar autorización de salida' })).toBeEnabled();
    await captureEvidence('Salida rechazada: el estudiante permanece dentro de la institución', finalStatus);
  });

  test('PF-SOL-002A — Aprobar el retiro de un estudiante que no puede salir solo', async ({ page, captureEvidence }) => {
    test.setTimeout(120_000);
    await setStudentState('inside', { inside: true, canLeaveAlone: false });
    await login(page, 'ESTUDIANTE');

    const studentStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(studentStatus.getByText('Dentro de la institución')).toBeVisible();
    await expect(studentStatus.getByRole('button', { name: 'Registrar salida' })).toHaveCount(0);
    await studentStatus.getByRole('button', { name: 'Solicitar autorización de salida' }).click();
    await expect(page.getByText('Solicitud enviada a tus apoderados vinculados.')).toBeVisible();
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
    await captureEvidence('Apoderado Primario: salida directa bloqueada y retiro con PIN dual disponible', pendingRequest);
    await pendingRequest.getByRole('button', { name: 'Iniciar retiro con PIN dual' }).click();
    await expect(page.getByText('Solicitud aprobada. Presenten ambos PIN en portería para validar el retiro.')).toBeVisible();

    const guardianPickup = page.getByRole('heading', { name: 'Retiros en curso' })
      .locator('xpath=ancestor::section[1]');
    await expect(guardianPickup.getByText('Pendiente de validación en portería')).toBeVisible();
    const guardianPin = await readVisiblePickupPin(page, 'Tu PIN de Apoderado Primario');
    await captureEvidence('Apoderado Primario: aprobación genera PIN visible y mantiene el retiro pendiente', guardianPickup, { revealPins: true });

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const studentPickup = page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' })
      .locator('xpath=ancestor::section[1]');
    const studentPin = await readVisiblePickupPin(page, 'Tu PIN de estudiante');
    expect(studentPin).not.toBe(guardianPin);
    await expect(studentStatus.getByText('Dentro de la institución')).toBeVisible();
    await captureEvidence('Estudiante: PIN visible y estado aún dentro de la institución', studentPickup, { revealPins: true });

    await page.context().clearCookies();
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    let pickupAtGate = page.locator('details[data-accordion]').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(pickupAtGate).not.toHaveAttribute('open', '');
    await pickupAtGate.locator('summary').first().click();
    await expect(pickupAtGate.getByLabel('PIN de apoderado primario')).toBeVisible();
    await captureEvidence('Portería: retiro pendiente de validar ambas identidades', pickupAtGate);

    await pickupAtGate.getByLabel('PIN de apoderado primario').fill(guardianPin);
    await pickupAtGate.getByLabel('PIN de apoderado primario').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    pickupAtGate = page.locator('details[data-accordion]').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await captureEvidence('Portería: identidad del Apoderado Primario validada presencialmente', pickupAtGate);

    await pickupAtGate.getByLabel('PIN de estudiante').fill(studentPin);
    await pickupAtGate.getByLabel('PIN de estudiante').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText(/Validación OK.*Estudiante E2E Dentro.*Apoderado E2E/)).toBeVisible();
    await captureEvidence('Portería: ambos PIN validados y retiro completado sin aprobación adicional', undefined, { preserveToast: true });
    await page.getByText('Retiros finalizados recientemente').click();
    const completedPickup = page.getByText('Retiros finalizados recientemente').locator('..');
    await expect(completedPickup.getByText('Completado', { exact: true })).toBeVisible();
    const guardianValidated = completedPickup.getByText('Apoderado Primario: validado', { exact: true });
    const studentValidated = completedPickup.getByText('Estudiante: validado', { exact: true });
    await expect(guardianValidated.locator('..')).toHaveClass(/bg-emerald-50/);
    await expect(studentValidated.locator('..')).toHaveClass(/bg-emerald-50/);
    await captureEvidence('Portería: ambas aprobaciones en verde antes de continuar el flujo', completedPickup);

    await page.context().clearCookies();
    await login(page, 'ESTUDIANTE');
    const finalStatus = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(finalStatus.getByText('Fuera de la institución')).toBeVisible();
    await captureEvidence('Estado final: estudiante fuera tras confirmación de portería', finalStatus);

    const recentTraceability = page.getByRole('heading', { name: 'Trazabilidad reciente' })
      .locator('xpath=ancestor::section[1]');
    const pickupEvent = recentTraceability.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Retiro' })
      .filter({ hasText: 'Aprobado' })
      .first();
    await expect(pickupEvent).toBeVisible();
    await captureEvidence('Trazabilidad final completa: retiro aprobado registrado', recentTraceability);
  });
});
