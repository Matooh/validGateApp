import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  activateNewRetrieverAccount,
  ensureExistingRetriever,
  pickupStateForRetriever,
  requestPickupAsRetriever,
  resolveE2EData,
  removeRetrieverFixture,
  resetE2EState,
  retrieverFixture,
  revokeRetrieverRelationDirect,
  validatePickupPinAsPorteria,
} from './support/database';
import { login, loginWithCredentials } from './support/ui';

type RetrieverIdentity = ReturnType<typeof retrieverFixture>;
type CaptureEvidence = (
  label: string,
  target?: Locator,
  options?: { preserveToast?: boolean; revealPins?: boolean },
) => Promise<void>;

async function changeIdentity(page: Page) {
  await page.context().clearCookies();
  await page.goto('/');
}

async function dismissNotification(page: Page) {
  const close = page.locator('button[aria-label^="Cerrar notific"]');
  if (await close.first().isVisible().catch(() => false)) await close.first().click();
}

function authorizationForm(page: Page) {
  return page.getByRole('heading', { name: 'Autorizar Apoderado Secundario' }).locator('xpath=ancestor::form[1]');
}

function authorizationCard(page: Page, identity: RetrieverIdentity) {
  return page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
}

function pickupQueue(page: Page) {
  return page.getByRole('heading', { name: /Retiros con validación dual/ }).locator('xpath=ancestor::section[1]');
}

async function openLinksAndFillAuthorization(page: Page, identity: RetrieverIdentity) {
  await login(page, 'APODERADO');
  await page.goto('/links');
  await page.getByLabel('Estudiante', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Nombres', { exact: true }).fill(identity.firstName);
  await page.getByLabel('Apellidos', { exact: true }).fill(identity.lastName);
  await page.getByLabel('Correo', { exact: true }).fill(identity.email);
  await page.getByLabel('RUT', { exact: true }).fill(identity.rut);
}

async function submitAuthorization(page: Page, expectedMessage: string) {
  await page.getByRole('checkbox', { name: /Autorizar Apoderado Secundario previamente registrado/ }).check();
  await page.getByRole('button', { name: 'Invitar y autorizar' }).click();
  await expect(page.getByText(expectedMessage, { exact: true })).toBeVisible();
}

async function requestPickupWithEvidence(
  page: Page,
  identity: RetrieverIdentity,
  captureEvidence: CaptureEvidence,
) {
  await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
  const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
  await expect(studentCard.getByRole('button', { name: 'Notificar retiro' })).toBeVisible();
  await captureEvidence('Apoderado Secundario: estudiante autorizado disponible antes de solicitar el retiro', studentCard);

  await studentCard.getByRole('button', { name: 'Notificar retiro' }).click();
  await expect(page.getByText('Solicitud de retiro enviada al estudiante.')).toBeVisible();
  await captureEvidence('Apoderado Secundario: solicitud enviada y confirmada por la aplicación', undefined, { preserveToast: true });
  await dismissNotification(page);

  const activePickup = page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]');
  await expect(activePickup.getByText('Esperando respuesta del estudiante')).toBeVisible();
  await captureEvidence('Apoderado Secundario: retiro en curso mientras espera la respuesta del estudiante', activePickup);
}

async function acceptAndReadPinsWithEvidence(
  page: Page,
  captureEvidence: CaptureEvidence,
  options: { revealPins?: boolean } = { revealPins: true },
) {
  await changeIdentity(page);
  await login(page, 'ESTUDIANTE');
  await dismissNotification(page);
  const request = page.locator('article').filter({ hasText: /está esperando por ti/i }).first();
  await expect(request.getByRole('button', { name: 'Aceptar' })).toBeVisible();
  await captureEvidence('Estudiante: mensaje de retiro recibido antes de responder', request);

  await request.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText(/Los PIN estarán vigentes durante cinco minutos/)).toBeVisible({ timeout: 30_000 });
  await captureEvidence('Estudiante: aprobación recibida y generación de PIN confirmada', undefined, { preserveToast: true });
  await dismissNotification(page);
  const studentPin = await readPin(page, 'Tu PIN de estudiante');
  const studentSection = page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' }).locator('xpath=ancestor::section[1]');
  await captureEvidence('Estudiante: solicitud aprobada y PIN disponible para portería', studentSection, options);

  await changeIdentity(page);
  const identity = retrieverFixture('existing');
  await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
  await dismissNotification(page);
  const guardianPin = await readPin(page, 'Tu PIN de Apoderado Secundario');
  const retrieverSection = page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]');
  await captureEvidence('Apoderado Secundario: aprobación del estudiante recibida y PIN disponible', retrieverSection, options);
  return { guardianPin, studentPin };
}

async function readPin(page: Page, label: string) {
  const container = page.getByText(label, { exact: true }).locator('..');
  const pin = (await container.locator('p').nth(1).innerText()).replace(/\D/g, '');
  expect(pin).toMatch(/^\d{5}$/);
  return pin;
}

test.describe('Retiro por Apoderado Secundario autorizado temporalmente', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await resetE2EState();
    await removeRetrieverFixture('new');
    await removeRetrieverFixture('existing');
  });

  test('PF-APO-SEC-001 — Registrar un Apoderado Secundario nuevo con correo y RUT', async ({ page, captureEvidence }) => {
    const identity = retrieverFixture('new');
    await login(page, 'APODERADO');
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Apoderado Primario');
    await captureEvidence('Paso 1: dashboard del Apoderado Primario que registrará al Apoderado Secundario');
    await page.goto('/links');
    await expect(page.getByRole('heading', { name: 'Autorizar Apoderado Secundario' })).toBeVisible();
    await expect(page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })).toHaveCount(0);
    await captureEvidence('Estado inicial: el Apoderado Primario no tiene al nuevo Apoderado Secundario vinculado');

    await page.getByLabel('Estudiante', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Nombres', { exact: true }).fill(identity.firstName);
    await page.getByLabel('Apellidos', { exact: true }).fill(identity.lastName);
    await page.getByLabel('Correo', { exact: true }).fill(identity.email);
    await page.getByLabel('RUT', { exact: true }).fill(identity.rut.replace('-', ''));
    await expect(page.getByLabel('RUT', { exact: true })).toHaveValue(identity.rut);
    await captureEvidence('Apoderado Primario: datos del nuevo Apoderado Secundario y estudiante completados', authorizationForm(page));

    await submitAuthorization(page, 'Invitación enviada y autorización creada correctamente.');
    await captureEvidence('Apoderado Primario: registro y autorización confirmados', undefined, { preserveToast: true });
    await dismissNotification(page);
    const linkedCard = authorizationCard(page, identity);
    await expect(linkedCard.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado Primario: nuevo vínculo secundario vigente visible en la UI', linkedCard);

    const activated = await activateNewRetrieverAccount();
    await changeIdentity(page);
    await loginWithCredentials(page, activated.email, activated.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(studentCard).toBeVisible();
    await captureEvidence('Nuevo Apoderado Secundario: cuenta activada y estudiante vinculado visible', studentCard);
  });

  test('PF-APO-SEC-002 — Autorizar un Apoderado Secundario registrado previamente', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever();
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    await expect(page.getByText('No tienes estudiantes vinculados para mostrar.')).toBeVisible();
    await captureEvidence('Estado inicial: la cuenta del Apoderado Secundario ya existe, pero aún no tiene estudiantes');

    await changeIdentity(page);
    await openLinksAndFillAuthorization(page, identity);
    await expect(page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })).toHaveCount(0);
    const explicitAuthorization = page.getByRole('checkbox', { name: /Autorizar Apoderado Secundario previamente registrado/ });
    await expect(explicitAuthorization).toBeVisible();
    await explicitAuthorization.check();
    await captureEvidence('Apoderado Primario: cuenta secundaria identificada por correo y RUT para vincularla', authorizationForm(page));

    await submitAuthorization(page, 'Autorización creada usando la cuenta existente.');
    await captureEvidence('Apoderado Primario: reutilización de cuenta secundaria y activación confirmadas', undefined, { preserveToast: true });
    await dismissNotification(page);
    const linkedCard = authorizationCard(page, identity);
    await expect(linkedCard.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado Primario: vínculo del Apoderado Secundario previamente registrado aparece vigente', linkedCard);

    await changeIdentity(page);
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(studentCard).toBeVisible();
    await captureEvidence('Apoderado Secundario existente: vinculación activada y estudiante disponible', studentCard);
  });

  test('PF-APO-SEC-003 — Completar un retiro como Apoderado Secundario usando PIN dual', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await requestPickupWithEvidence(page, identity, captureEvidence);
    const pins = await acceptAndReadPinsWithEvidence(page, captureEvidence);

    await changeIdentity(page);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const queue = pickupQueue(page);
    await captureEvidence('Portería: solicitud aprobada disponible para validación dual', queue);

    await page.getByLabel('PIN de apoderado secundario').fill(pins.guardianPin);
    await page.getByRole('button', { name: 'Validar PIN' }).first().click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    await captureEvidence('Portería: PIN del Apoderado Secundario validado correctamente', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(queue.getByText('Apoderado Secundario: validado')).toBeVisible();
    await captureEvidence('Portería: identidad del Apoderado Secundario marcada como validada', queue);

    await page.getByLabel('PIN de estudiante').fill(pins.studentPin);
    await page.getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText(new RegExp(`Validación OK.*Estudiante E2E Dentro.*${identity.firstName} ${identity.lastName}`))).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar retiro efectivo' })).toHaveCount(0);
    await captureEvidence('Portería: segunda validación completa el retiro y muestra la instrucción nominal', undefined, { preserveToast: true });

    await page.getByText('Retiros finalizados recientemente').click();
    const completedPickup = page.getByText('Retiros finalizados recientemente').locator('..');
    await expect(completedPickup.getByText('Completado', { exact: true })).toBeVisible();
    const guardianValidated = completedPickup.getByText('Apoderado Secundario: validado', { exact: true });
    const studentValidated = completedPickup.getByText('Estudiante: validado', { exact: true });
    await expect(guardianValidated.locator('..')).toHaveClass(/bg-emerald-50/);
    await expect(studentValidated.locator('..')).toHaveClass(/bg-emerald-50/);
    await captureEvidence('Portería: ambas aprobaciones en verde antes de revisar la trazabilidad', completedPickup);

    const state = await pickupStateForRetriever(identity.profileId);
    expect(state).toMatchObject({ status: 'COMPLETED', authorization_link_id: identity.relationId, accessEventCount: 1 });

    const recentTraceability = page.getByRole('heading', { name: 'Eventos recientes' })
      .locator('xpath=ancestor::section[1]');
    const pickupEvent = recentTraceability.locator('article')
      .filter({ hasText: 'Estudiante E2E Dentro' })
      .filter({ hasText: 'Retiro' })
      .filter({ hasText: 'Aprobado' })
      .first();
    await expect(pickupEvent).toBeVisible();
    await expect(pickupEvent).toContainText(`Retirado por: ${identity.firstName} ${identity.lastName}`);
    await captureEvidence('Trazabilidad final completa: retiro autorizado aprobado registrado', recentTraceability);
  });

  test('PF-APO-SEC-004 — Rechazar una solicitud si la autorización secundaria dejó de estar vigente', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    const staleButton = studentCard.getByRole('button', { name: 'Notificar retiro' });
    await expect(staleButton).toBeVisible();
    await captureEvidence('Estado inicial: autorización vigente y acción de retiro disponible', studentCard);

    await revokeRetrieverRelationDirect(identity.relationId!);
    await captureEvidence('Apoderado Secundario: vista aún abierta antes de intentar usar el vínculo recién revocado', studentCard);
    await staleButton.click();
    const revokedToast = page.getByRole('status').filter({ hasText: 'El vínculo no está autorizado para realizar este retiro.' });
    await expect(revokedToast).toBeVisible();
    await expect(revokedToast).toHaveClass(/bg-rose-50/);
    await captureEvidence('Apoderado Secundario: solicitud rechazada con toast por vínculo no autorizado', undefined, { preserveToast: true });
    expect(await pickupStateForRetriever(identity.profileId)).toBeNull();

    await dismissNotification(page);
    await page.reload();
    await expect(page.getByText('No tienes estudiantes vinculados para mostrar.')).toBeVisible();
    await captureEvidence('Estado final: el vínculo revocado ya no está disponible en la UI');
  });

  test('PF-APO-SEC-005 — Revocar la autorización secundaria cancela el retiro e invalida sus PIN', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await requestPickupWithEvidence(page, identity, captureEvidence);
    const pins = await acceptAndReadPinsWithEvidence(page, captureEvidence);

    await changeIdentity(page);
    await login(page, 'APODERADO');
    await page.goto('/links');
    const authorization = authorizationCard(page, identity);
    await expect(authorization.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado Primario: autorización secundaria vigente antes de revocarla', authorization);

    await authorization.getByRole('button', { name: 'Revocar autorización' }).click();
    await expect(page.getByText('Autorización revocada correctamente.')).toBeVisible();
    await captureEvidence('Apoderado Primario: revocación inmediata confirmada', undefined, { preserveToast: true });
    await dismissNotification(page);
    const revokedAuthorization = authorizationCard(page, identity);
    await expect(revokedAuthorization.getByText('Revocado', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado Primario: vínculo secundario visible con estado revocado', revokedAuthorization);

    const state = await pickupStateForRetriever(identity.profileId);
    expect(state?.status).toBe('CANCELLED_AUTHORIZATION_REVOKED');
    const result = await validatePickupPinAsPorteria(state!.id, 'GUARDIAN', pins.guardianPin);
    expect(result.message_code).toBe('PICKUP_NOT_ALLOWED');

    await changeIdentity(page);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    await page.getByText('Retiros finalizados recientemente').click();
    const queue = pickupQueue(page);
    await expect(queue.getByText('Cancelado por revocación de autorización')).toBeVisible();
    await captureEvidence('Portería: retiro cancelado y PIN rechazado después de la revocación', queue);
  });

  test('PF-APO-SEC-007 — Impedir retirar un estudiante distinto del autorizado', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    const { students } = await resolveE2EData();

    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    await expect(page.getByText('Estudiante E2E Dentro')).toBeVisible();
    await expect(page.getByText('Estudiante E2E Fuera')).toHaveCount(0);
    await captureEvidence('Alcance autorizado: la UI muestra únicamente al estudiante vinculado');

    const result = await requestPickupAsRetriever(identity.profileId, identity.password, students.outside);
    expect(result).toMatchObject({ request_id: null, message_code: 'PICKUP_NOT_AUTHORIZED' });
    await captureEvidence('Resultado: solicitud para otro estudiante rechazada y ausente de la UI');
  });
});
