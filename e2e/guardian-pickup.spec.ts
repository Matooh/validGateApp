import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';

import { resetE2EState } from './support/database';
import { createPickupRequest, login } from './support/ui';

type CaptureEvidence = (
  label: string,
  target?: Locator,
  options?: { preserveToast?: boolean; revealPins?: boolean },
) => Promise<void>;

async function changeRole(page: Page) {
  await page.context().clearCookies();
  await page.goto('/');
}

async function dismissLoginNotification(page: Page) {
  const closeButton = page.getByRole('button', { name: 'Cerrar notificación' });
  if (await closeButton.isVisible()) await closeButton.click();
}

async function readVisiblePin(page: Page, label: string) {
  const container = page.getByText(label, { exact: true }).locator('..');
  const text = await container.locator('p').nth(1).innerText();
  const pin = text.replace(/\D/g, '');
  expect(pin).toMatch(/^\d{5}$/);
  return pin;
}

async function prepareAcceptedPickup(page: Page, captureEvidence?: CaptureEvidence) {
  await createPickupRequest(page);
  if (captureEvidence) {
    await captureEvidence(
      'Apoderado Primario: retiro notificado, pendiente de respuesta',
      page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]'),
    );
  }
  await changeRole(page);
  await login(page, 'ESTUDIANTE');
  await dismissLoginNotification(page);
  const pendingStudentRequest = page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' }).locator('xpath=ancestor::section[1]');
  await expect(pendingStudentRequest).toBeVisible();
  if (captureEvidence) await captureEvidence('Estudiante: solicitud recibida, aún sin validar', pendingStudentRequest);
  const request = page.locator('article').filter({ hasText: /está esperando por ti/i }).first();
  await request.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText(/Los PIN estarán vigentes durante cinco minutos/)).toBeVisible();
  const studentPin = await readVisiblePin(page, 'Tu PIN de estudiante');
  if (captureEvidence) {
    await captureEvidence(
      'Estudiante: solicitud aceptada y PIN visible',
      page.getByText('Tu PIN de estudiante', { exact: true }).locator('..'),
      { revealPins: true },
    );
  }
  await changeRole(page);
  await login(page, 'APODERADO');
  await dismissLoginNotification(page);
  const guardianPin = await readVisiblePin(page, 'Tu PIN de Apoderado Primario');
  if (captureEvidence) {
    await captureEvidence(
      'Apoderado Primario: PIN visible para validación',
      page.getByText('Tu PIN de Apoderado Primario', { exact: true }).locator('..'),
      { revealPins: true },
    );
  }
  return { studentPin, guardianPin };
}

async function validateBothPins(
  page: Page,
  pins: { studentPin: string; guardianPin: string },
  captureEvidence?: CaptureEvidence,
) {
  await changeRole(page);
  await login(page, 'PORTERIA');
  await page.goto('/guard');
  const request = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
  if (captureEvidence) await captureEvidence('Portería: ambas personas pendientes de validación', request);
  await request.getByLabel('PIN de apoderado primario').fill(pins.guardianPin);
  await request.getByLabel('PIN de apoderado primario').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
  await expect(page.getByText('PIN validado correctamente.')).toBeVisible();

  const refreshed = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
  await refreshed.getByLabel('PIN de estudiante').fill(pins.studentPin);
  await refreshed.getByLabel('PIN de estudiante').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
  await expect(page.getByText(/Validación OK.*Estudiante E2E Dentro.*Apoderado E2E/)).toBeVisible();
  if (captureEvidence) {
    await captureEvidence(
      'Portería: ambos PIN validados y retiro completado automáticamente',
      undefined,
      { preserveToast: true },
    );
  }

  await page.getByText('Retiros finalizados recientemente').click();
  const completedPickup = page.getByText('Retiros finalizados recientemente').locator('..');
  await expect(completedPickup.getByText('Completado', { exact: true })).toBeVisible();
  const guardianValidated = completedPickup.getByText('Apoderado Primario: validado', { exact: true });
  const studentValidated = completedPickup.getByText('Estudiante: validado', { exact: true });
  await expect(guardianValidated.locator('..')).toHaveClass(/bg-emerald-50/);
  await expect(studentValidated.locator('..')).toHaveClass(/bg-emerald-50/);
  if (captureEvidence) {
    await captureEvidence('Portería: ambas aprobaciones en verde antes de continuar el flujo', completedPickup);
  }
  return completedPickup;
}

async function captureApprovedPickupTraceability(page: Page, captureEvidence: CaptureEvidence) {
  const recentTraceability = page.getByRole('heading', { name: 'Eventos recientes' }).locator('xpath=ancestor::section[1]');
  const pickupEvent = recentTraceability
    .locator('article')
    .filter({ hasText: 'Estudiante E2E Dentro' })
    .filter({ hasText: 'Retiro' })
    .filter({ hasText: 'Aprobado' })
    .first();
  await expect(pickupEvent).toBeVisible();
  await captureEvidence('Trazabilidad completa generada: retiro aprobado registrado', recentTraceability);
}

test.describe('Retiro con PIN dual', () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(async () => resetE2EState());

  test('PF-RET-001 — Notificar el retiro de un estudiante', async ({ page, captureEvidence }) => {
    await login(page, 'ESTUDIANTE');
    await expect(page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' })).not.toBeVisible();
    await captureEvidence('Estado inicial del estudiante: sin solicitud de retiro');
    await changeRole(page);
    await createPickupRequest(page);
    await expect(page.getByRole('heading', { name: 'Retiros en curso' })).toBeVisible();
    await expect(page.getByText('Esperando respuesta del estudiante', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado Primario: solicitud de retiro enviada', page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]'));
    await changeRole(page);
    await login(page, 'ESTUDIANTE');
    const receivedRequest = page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' }).locator('xpath=ancestor::section[1]');
    await expect(receivedRequest.getByText(/está esperando por ti/i)).toBeVisible();
    await captureEvidence('Estudiante: solicitud de retiro recibida', receivedRequest);
  });

  test('PF-RET-003 — Rechazar una solicitud de retiro como estudiante', async ({ page, captureEvidence }) => {
    await createPickupRequest(page);
    await changeRole(page);
    await login(page, 'ESTUDIANTE');
    const request = page.locator('article').filter({ hasText: /está esperando por ti/i }).first();
    await expect(request).toBeVisible();
    await captureEvidence('Estudiante: solicitud de retiro recibida', request);
    await request.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByText('Solicitud de retiro rechazada.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' })).not.toBeVisible();
    await captureEvidence('Estudiante: solicitud rechazada y retirada de pendientes');
    const traceability = page.getByRole('heading', { name: 'Trazabilidad reciente' })
      .locator('xpath=ancestor::section[1]');
    const rejectedPickup = traceability.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Retiro con PIN dual' })
      .filter({ hasText: 'Rechazado' })
      .first();
    await expect(rejectedPickup).toBeVisible();
    await captureEvidence('Trazabilidad reciente completa: rechazo de la solicitud registrado', traceability);
  });

  test('PF-RET-004 — Completar un retiro como Apoderado Primario usando PIN dual', async ({ page, captureEvidence }) => {
    const pins = await prepareAcceptedPickup(page, captureEvidence);
    expect(pins.studentPin).not.toBe(pins.guardianPin);
    await validateBothPins(page, pins, captureEvidence);
    await expect(page.getByRole('button', { name: 'Confirmar retiro efectivo' })).toHaveCount(0);
    await captureApprovedPickupTraceability(page, captureEvidence);
  });

  test('PF-RET-005 — Consultar el PIN DUAL vigente desde Autenticaciones', async ({ page, captureEvidence }) => {
    const pins = await prepareAcceptedPickup(page, captureEvidence);

    await page.getByRole('link', { name: 'PIN dual disponible' }).click();
    await expect(page.getByRole('heading', { name: 'Credenciales PIN DUAL' })).toBeVisible();
    await expect(page.getByText('Tu PIN de responsable', { exact: true })).toBeVisible();
    await expect(page.getByText(pins.guardianPin, { exact: true })).toBeVisible();
    await captureEvidence(
      'Apoderado Primario: PIN DUAL vigente consultado en Autenticaciones',
      page.getByRole('heading', { name: 'Credenciales PIN DUAL' }).locator('xpath=ancestor::section[1]'),
      { revealPins: true },
    );

    await changeRole(page);
    await login(page, 'ESTUDIANTE');
    await page.getByRole('link', { name: 'PIN dual disponible' }).click();
    await expect(page.getByText('Tu PIN de estudiante', { exact: true })).toBeVisible();
    await expect(page.getByText(pins.studentPin, { exact: true })).toBeVisible();
    await captureEvidence(
      'Estudiante: PIN DUAL vigente consultado en Autenticaciones',
      page.getByRole('heading', { name: 'Credenciales PIN DUAL' }).locator('xpath=ancestor::section[1]'),
      { revealPins: true },
    );

    await validateBothPins(page, pins, captureEvidence);
    await captureApprovedPickupTraceability(page, captureEvidence);
  });

  test('PF-RET-006 — Registrar la salida efectiva del estudiante como Apoderado Primario', async ({ page, captureEvidence }) => {
    const pins = await prepareAcceptedPickup(page, captureEvidence);
    const completedPickup = await validateBothPins(page, pins, captureEvidence);
    await expect(page.getByText('No hay retiros activos en la cola.')).toBeVisible();
    await expect(page.getByText('Completado', { exact: true })).toBeVisible();
    await captureEvidence('Portería: retiro efectivo confirmado', completedPickup);

    await changeRole(page);
    await login(page, 'ESTUDIANTE');
    await dismissLoginNotification(page);
    const statusSection = page.getByRole('heading', { name: 'Status' }).locator('xpath=ancestor::section[1]');
    await expect(statusSection.getByText('Fuera de la institución')).toBeVisible();
    await captureEvidence('Estado final: estudiante fuera de la institución', statusSection);

    const recentTraceability = page.getByRole('heading', { name: 'Trazabilidad reciente' }).locator('xpath=ancestor::section[1]');
    const pickupEvent = recentTraceability
      .locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Retiro' })
      .filter({ hasText: 'Aprobado' })
      .first();
    await expect(pickupEvent).toBeVisible();
    await captureEvidence('Trazabilidad reciente completa: retiro aprobado registrado', recentTraceability);
  });
});
