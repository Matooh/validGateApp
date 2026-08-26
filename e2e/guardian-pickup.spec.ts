import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';

import { resetE2EState } from './support/database';
import { createPickupRequest, login } from './support/ui';

type CaptureEvidence = (label: string, target?: Locator) => Promise<void>;

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
      'Apoderado: retiro notificado, pendiente de respuesta',
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
    await captureEvidence('Estudiante: solicitud aceptada y PIN disponible', page.getByText('Tu PIN de estudiante', { exact: true }).locator('..'));
  }
  await changeRole(page);
  await login(page, 'APODERADO');
  await dismissLoginNotification(page);
  const guardianPin = await readVisiblePin(page, 'Tu PIN de apoderado');
  if (captureEvidence) {
    await captureEvidence('Apoderado: PIN disponible para validación', page.getByText('Tu PIN de apoderado', { exact: true }).locator('..'));
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
  await request.getByLabel('PIN de apoderado').fill(pins.guardianPin);
  await request.getByLabel('PIN de apoderado').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
  await expect(page.getByText('PIN validado correctamente.')).toBeVisible();

  const refreshed = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
  await refreshed.getByLabel('PIN de estudiante').fill(pins.studentPin);
  await refreshed.getByLabel('PIN de estudiante').locator('..').getByRole('button', { name: 'Validar PIN' }).click();
  await expect(page.getByText('Ambos validados', { exact: true })).toBeVisible();
  if (captureEvidence) {
    await captureEvidence(
      'Portería: apoderado y estudiante validados correctamente',
      page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first(),
    );
  }
}

test.describe('Retiro con PIN dual', () => {
  test.beforeEach(async () => resetE2EState());

  test('PF-RET-001 — Notificar el retiro de un estudiante', async ({ page, captureEvidence }) => {
    await login(page, 'ESTUDIANTE');
    await expect(page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' })).not.toBeVisible();
    await captureEvidence('Estado inicial del estudiante: sin solicitud de retiro');
    await changeRole(page);
    await createPickupRequest(page);
    await expect(page.getByRole('heading', { name: 'Retiros en curso' })).toBeVisible();
    await expect(page.getByText('Esperando respuesta del estudiante', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado: solicitud de retiro enviada', page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]'));
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
  });

  test('PF-RET-004 — Validar los PIN del apoderado y estudiante', async ({ page, captureEvidence }) => {
    const pins = await prepareAcceptedPickup(page, captureEvidence);
    expect(pins.studentPin).not.toBe(pins.guardianPin);
    await validateBothPins(page, pins, captureEvidence);
    await expect(page.getByRole('button', { name: 'Confirmar retiro efectivo' })).toBeVisible();
  });

  test('PF-RET-005 — Consultar el PIN DUAL vigente desde Autenticaciones', async ({ page, captureEvidence }) => {
    const pins = await prepareAcceptedPickup(page, captureEvidence);

    await page.getByRole('link', { name: 'PIN dual disponible' }).click();
    await expect(page.getByRole('heading', { name: 'Credenciales PIN DUAL' })).toBeVisible();
    await expect(page.getByText('Tu PIN de responsable', { exact: true })).toBeVisible();
    await expect(page.getByText(pins.guardianPin, { exact: true })).toBeVisible();
    await captureEvidence(
      'Apoderado: PIN DUAL vigente consultado en Autenticaciones',
      page.getByRole('heading', { name: 'Credenciales PIN DUAL' }).locator('xpath=ancestor::section[1]'),
    );

    await changeRole(page);
    await login(page, 'ESTUDIANTE');
    await page.getByRole('link', { name: 'PIN dual disponible' }).click();
    await expect(page.getByText('Tu PIN de estudiante', { exact: true })).toBeVisible();
    await expect(page.getByText(pins.studentPin, { exact: true })).toBeVisible();
    await captureEvidence(
      'Estudiante: PIN DUAL vigente consultado en Autenticaciones',
      page.getByRole('heading', { name: 'Credenciales PIN DUAL' }).locator('xpath=ancestor::section[1]'),
    );
  });

  test('PF-RET-006 — Registrar la salida efectiva del estudiante como apoderado', async ({ page, captureEvidence }) => {
    const pins = await prepareAcceptedPickup(page, captureEvidence);
    await validateBothPins(page, pins, captureEvidence);
    await page.getByRole('button', { name: 'Confirmar retiro efectivo' }).click();
    await expect(page.getByText('Retiro confirmado y salida registrada.')).toBeVisible();
    await expect(page.getByText('No hay retiros activos en la cola.')).toBeVisible();
    await page.getByText('Retiros finalizados recientemente').click();
    await expect(page.getByText('Completado', { exact: true })).toBeVisible();
    await captureEvidence('Portería: retiro efectivo confirmado', page.getByText('Retiros finalizados recientemente').locator('..'));

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
    await captureEvidence('Trazabilidad reciente: retiro aprobado registrado', pickupEvent);
  });
});
