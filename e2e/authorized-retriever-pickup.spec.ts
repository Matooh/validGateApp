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
  options?: { preserveToast?: boolean },
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
  return page.getByRole('heading', { name: 'Autorizar retirador' }).locator('xpath=ancestor::form[1]');
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
  await page.getByLabel('Estudiante').selectOption({ index: 1 });
  await page.getByLabel('Nombres').fill(identity.firstName);
  await page.getByLabel('Apellidos').fill(identity.lastName);
  await page.getByLabel('Correo').fill(identity.email);
  await page.getByLabel('RUT').fill(identity.rut);
}

async function submitAuthorization(page: Page, expectedMessage: string) {
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
  await captureEvidence('Retirador: estudiante autorizado disponible antes de solicitar el retiro', studentCard);

  await studentCard.getByRole('button', { name: 'Notificar retiro' }).click();
  await expect(page.getByText('Solicitud de retiro enviada al estudiante.')).toBeVisible();
  await captureEvidence('Retirador: solicitud enviada y confirmada por la aplicación', undefined, { preserveToast: true });
  await dismissNotification(page);

  const activePickup = page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]');
  await expect(activePickup.getByText('Esperando respuesta del estudiante')).toBeVisible();
  await captureEvidence('Retirador: retiro en curso mientras espera la respuesta del estudiante', activePickup);
}

async function acceptAndReadPinsWithEvidence(page: Page, captureEvidence: CaptureEvidence) {
  await changeIdentity(page);
  await login(page, 'ESTUDIANTE');
  await dismissNotification(page);
  const request = page.locator('article').filter({ hasText: /está esperando por ti/i }).first();
  await expect(request.getByRole('button', { name: 'Aceptar' })).toBeVisible();
  await captureEvidence('Estudiante: mensaje de retiro recibido antes de responder', request);

  await request.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText(/Los PIN estarán vigentes durante cinco minutos/)).toBeVisible();
  await captureEvidence('Estudiante: aprobación recibida y generación de PIN confirmada', undefined, { preserveToast: true });
  await dismissNotification(page);
  const studentPin = await readPin(page, 'Tu PIN de estudiante');
  const studentSection = page.getByRole('heading', { name: 'Solicitudes de retiro pendientes' }).locator('xpath=ancestor::section[1]');
  await captureEvidence('Estudiante: solicitud aprobada y PIN disponible para portería', studentSection);

  await changeIdentity(page);
  const identity = retrieverFixture('existing');
  await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
  await dismissNotification(page);
  const guardianPin = await readPin(page, 'Tu PIN de apoderado');
  const retrieverSection = page.getByRole('heading', { name: 'Retiros en curso' }).locator('xpath=ancestor::section[1]');
  await captureEvidence('Retirador: aprobación del estudiante recibida y PIN disponible', retrieverSection);
  return { guardianPin, studentPin };
}

async function readPin(page: Page, label: string) {
  const container = page.getByText(label, { exact: true }).locator('..');
  const pin = (await container.locator('p').nth(1).innerText()).replace(/\D/g, '');
  expect(pin).toMatch(/^\d{5}$/);
  return pin;
}

test.describe('Retiro por persona autorizada temporalmente', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await resetE2EState();
    await removeRetrieverFixture('new');
    await removeRetrieverFixture('existing');
  });

  test('PF-RET-AUT-001 — Registrar un retirador nuevo con correo y RUT', async ({ page, captureEvidence }) => {
    const identity = retrieverFixture('new');
    await login(page, 'APODERADO');
    await page.goto('/links');
    await expect(page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })).toHaveCount(0);
    await captureEvidence('Estado inicial: el apoderado no tiene al nuevo retirador vinculado');

    await page.getByLabel('Estudiante').selectOption({ index: 1 });
    await page.getByLabel('Nombres').fill(identity.firstName);
    await page.getByLabel('Apellidos').fill(identity.lastName);
    await page.getByLabel('Correo').fill(identity.email);
    await page.getByLabel('RUT').fill(identity.rut);
    await captureEvidence('Apoderado: datos del nuevo retirador y estudiante completados', authorizationForm(page));

    await submitAuthorization(page, 'Invitación enviada y autorización creada correctamente.');
    await captureEvidence('Apoderado: registro y autorización confirmados', undefined, { preserveToast: true });
    await dismissNotification(page);
    const linkedCard = authorizationCard(page, identity);
    await expect(linkedCard.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado: nuevo vínculo vigente visible en la UI', linkedCard);

    const activated = await activateNewRetrieverAccount();
    await changeIdentity(page);
    await loginWithCredentials(page, activated.email, activated.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(studentCard).toBeVisible();
    await captureEvidence('Nuevo retirador: cuenta activada y estudiante vinculado visible', studentCard);
  });

  test('PF-RET-AUT-002 — Autorizar un retirador registrado previamente', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever();
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    await expect(page.getByText('No tienes estudiantes vinculados para mostrar.')).toBeVisible();
    await captureEvidence('Estado inicial: la cuenta del retirador ya existe, pero aún no tiene estudiantes');

    await changeIdentity(page);
    await openLinksAndFillAuthorization(page, identity);
    await expect(page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })).toHaveCount(0);
    await captureEvidence('Apoderado: cuenta existente identificada por correo y RUT para vincularla', authorizationForm(page));

    await submitAuthorization(page, 'Autorización creada usando la cuenta existente.');
    await captureEvidence('Apoderado: reutilización de cuenta y activación confirmadas', undefined, { preserveToast: true });
    await dismissNotification(page);
    const linkedCard = authorizationCard(page, identity);
    await expect(linkedCard.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado: vínculo de la persona previamente registrada aparece vigente', linkedCard);

    await changeIdentity(page);
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(studentCard).toBeVisible();
    await captureEvidence('Retirador existente: vinculación activada y estudiante disponible', studentCard);
  });

  test('PF-RET-AUT-003 — Completar un retiro autorizado con PIN dual', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await requestPickupWithEvidence(page, identity, captureEvidence);
    const pins = await acceptAndReadPinsWithEvidence(page, captureEvidence);

    await changeIdentity(page);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const queue = pickupQueue(page);
    await captureEvidence('Portería: solicitud aprobada disponible para validación dual', queue);

    await page.getByLabel('PIN de apoderado').fill(pins.guardianPin);
    await page.getByRole('button', { name: 'Validar PIN' }).first().click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    await captureEvidence('Portería: PIN del retirador validado correctamente', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(queue.getByText('Apoderado: validado')).toBeVisible();
    await captureEvidence('Portería: identidad del retirador marcada como validada', queue);

    await page.getByLabel('PIN de estudiante').fill(pins.studentPin);
    await page.getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    await captureEvidence('Portería: PIN del estudiante validado correctamente', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(page.getByRole('button', { name: 'Confirmar retiro efectivo' })).toBeVisible();
    await captureEvidence('Portería: estudiante y retirador aprobados antes de confirmar la salida', queue);

    await page.getByRole('button', { name: 'Confirmar retiro efectivo' }).click();
    await expect(page.getByText('Retiro confirmado y salida registrada.')).toBeVisible();
    await captureEvidence('Portería: retiro confirmado y salida registrada', undefined, { preserveToast: true });

    const state = await pickupStateForRetriever(identity.profileId);
    expect(state).toMatchObject({ status: 'COMPLETED', authorization_link_id: identity.relationId, accessEventCount: 1 });
  });

  test('PF-RET-AUT-004 — Rechazar una solicitud si la autorización dejó de estar vigente', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    const staleButton = studentCard.getByRole('button', { name: 'Notificar retiro' });
    await expect(staleButton).toBeVisible();
    await captureEvidence('Estado inicial: autorización vigente y acción de retiro disponible', studentCard);

    await revokeRetrieverRelationDirect(identity.relationId!);
    await captureEvidence('Retirador: vista aún abierta antes de intentar usar el vínculo recién revocado', studentCard);
    await staleButton.click();
    await expect(page.getByText('El vínculo no está autorizado para realizar este retiro.')).toBeVisible();
    await captureEvidence('Retirador: solicitud rechazada con toast por vínculo no autorizado', undefined, { preserveToast: true });
    expect(await pickupStateForRetriever(identity.profileId)).toBeNull();

    await dismissNotification(page);
    await page.reload();
    await expect(page.getByText('No tienes estudiantes vinculados para mostrar.')).toBeVisible();
    await captureEvidence('Estado final: el vínculo revocado ya no está disponible en la UI');
  });

  test('PF-RET-AUT-005 — Revocar la autorización cancela el retiro e invalida sus PIN', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await requestPickupWithEvidence(page, identity, captureEvidence);
    const pins = await acceptAndReadPinsWithEvidence(page, captureEvidence);

    await changeIdentity(page);
    await login(page, 'APODERADO');
    await page.goto('/links');
    const authorization = authorizationCard(page, identity);
    await expect(authorization.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado: autorización vigente antes de revocarla', authorization);

    await authorization.getByRole('button', { name: 'Revocar autorización' }).click();
    await expect(page.getByText('Autorización revocada correctamente.')).toBeVisible();
    await captureEvidence('Apoderado: revocación inmediata confirmada', undefined, { preserveToast: true });
    await dismissNotification(page);
    const revokedAuthorization = authorizationCard(page, identity);
    await expect(revokedAuthorization.getByText('Revocado', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado: vínculo visible con estado revocado', revokedAuthorization);

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

  test('PF-RET-AUT-006 — Un PIN consumido no puede utilizarse nuevamente', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await requestPickupWithEvidence(page, identity, captureEvidence);
    const pins = await acceptAndReadPinsWithEvidence(page, captureEvidence);
    const state = await pickupStateForRetriever(identity.profileId);

    await changeIdentity(page);
    await login(page, 'PORTERIA');
    await page.goto('/guard');
    const queue = pickupQueue(page);
    await captureEvidence('Portería: ambos PIN disponibles antes de consumirlos', queue);

    await page.getByLabel('PIN de apoderado').fill(pins.guardianPin);
    await page.getByRole('button', { name: 'Validar PIN' }).first().click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    await captureEvidence('Portería: primer uso del PIN del retirador aceptado', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(queue.getByText('Apoderado: validado')).toBeVisible();

    expect((await validatePickupPinAsPorteria(state!.id, 'GUARDIAN', pins.guardianPin)).message_code)
      .toBe('PICKUP_PIN_BLOCKED');
    await captureEvidence('Portería: reutilización rechazada; el PIN del retirador permanece consumido', queue);

    await page.getByLabel('PIN de estudiante').fill(pins.studentPin);
    await page.getByRole('button', { name: 'Validar PIN' }).click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    await captureEvidence('Portería: PIN del estudiante consumido y validado', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(page.getByRole('button', { name: 'Confirmar retiro efectivo' })).toBeVisible();
    await captureEvidence('Portería: ambos actores validados con sus PIN de un solo uso', queue);

    await page.getByRole('button', { name: 'Confirmar retiro efectivo' }).click();
    await expect(page.getByText('Retiro confirmado y salida registrada.')).toBeVisible();
    await captureEvidence('Portería: salida efectiva confirmada', undefined, { preserveToast: true });
    expect((await validatePickupPinAsPorteria(state!.id, 'GUARDIAN', pins.guardianPin)).message_code)
      .toBe('PICKUP_PIN_BLOCKED');
    expect((await pickupStateForRetriever(identity.profileId))?.accessEventCount).toBe(1);

    await dismissNotification(page);
    await page.getByText('Retiros finalizados recientemente').click();
    await expect(queue.getByText('Completado', { exact: true })).toBeVisible();
    await captureEvidence('Estado final: retiro completado una sola vez y PIN aún bloqueado', queue);
  });

  test('PF-RET-AUT-007 — Impedir retirar un estudiante distinto del autorizado', async ({ page, captureEvidence }) => {
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
