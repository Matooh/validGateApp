import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  ensureExistingRetriever,
  ensureRegisteredGuardian,
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
  return page.locator('form').filter({ has: page.getByRole('button', { name: 'Autorizar apoderado' }) }).first();
}

function authorizationCard(page: Page, identity: RetrieverIdentity) {
  return page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
}

async function expandStudentLinks(page: Page) {
  const trigger = page.getByRole('button', { name: /Estudiante E2E Dentro/ }).first();
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

function pickupQueue(page: Page) {
  return page.getByRole('heading', { name: /Retiros con validación dual/ }).locator('xpath=ancestor::section[1]');
}

async function openOperationalPickup(page: Page) {
  const request = page.locator('details[data-accordion]').filter({ hasText: 'Estudiante E2E Dentro' }).first();
  await expect(request).not.toHaveAttribute('open', '');
  await request.locator('summary').first().click();
  return request;
}

async function openLinksAndFillAuthorization(page: Page, identity: RetrieverIdentity) {
  await login(page, 'APODERADO');
  await page.goto('/links');
  const management = page.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Secundario-Estudiante' }).first();
  await management.locator('summary').first().click();
  const secondarySection = management.locator('details[data-accordion]').first();
  if (await secondarySection.count()) await secondarySection.locator('summary').first().click();
  const form = authorizationForm(page);
  const student = form.getByRole('combobox', { name: 'Estudiante', exact: true });
  await student.fill('Estudiante E2E Dentro');
  await form.getByRole('option').filter({ hasText: 'Estudiante E2E Dentro' }).first().getByRole('button').click();
  const guardian = form.getByRole('combobox', { name: 'Apoderado secundario', exact: true });
  await guardian.fill(identity.firstName);
  await form.getByRole('option').filter({ hasText: identity.firstName }).first().getByRole('button').click();
}

async function submitAuthorization(page: Page, _expectedMessage = 'Autorización creada correctamente.') {
  await page.getByRole('checkbox', { name: /Confirmo que puede retirar al estudiante/ }).check();
  const submit = page.getByRole('button', { name: 'Autorizar apoderado' });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/links(?:\?.*)?$/);
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

  test('PF-APO-SEC-001 — Vincular un Apoderado Secundario a estudiante', async ({ page, captureEvidence }) => {
    const identity = await ensureRegisteredGuardian('new');
    await login(page, 'APODERADO');
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Apoderado Primario');
    await captureEvidence('Paso 1: dashboard del Apoderado Primario que registrará al Apoderado Secundario');
    await page.goto('/links');
    await expect(page.getByRole('heading', { name: 'Vínculos', exact: true })).toBeVisible();
    await expect(page.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })).toHaveCount(0);
    await captureEvidence('Paso 2: vista inicial de Vínculos del Apoderado Primario, antes de agregar el vínculo');
    const managementByPosition = page.locator('details[data-accordion]').nth(1);
    await managementByPosition.locator('summary').first().click();
    const secondarySection = managementByPosition.locator('details[data-accordion]').first();
    if (await secondarySection.count()) await secondarySection.locator('summary').first().click();
    await captureEvidence('Paso 3: Apoderado Primario abre Gestionar vinculaciones y visualiza el formulario secundario', managementByPosition);

    const form = authorizationForm(page);
    await expect(form).toBeVisible();
    const student = form.getByRole('combobox', { name: 'Estudiante', exact: true });
    await student.fill('Estudiante E2E Dentro');
    await form.getByRole('option').filter({ hasText: 'Estudiante E2E Dentro' }).first().getByRole('button').click();
    const guardian = form.getByRole('combobox', { name: 'Apoderado secundario', exact: true });
    await guardian.fill(identity.firstName);
    await form.getByRole('option').filter({ hasText: identity.firstName }).first().getByRole('button').click();
    await captureEvidence('Paso 4: Apoderado Primario completa el proceso de vinculación', authorizationForm(page));

    await submitAuthorization(page, 'Invitación enviada y autorización creada correctamente.');
    await captureEvidence('Paso 5: vinculación confirmada y lista para verificar el estado posterior', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(page.getByText(/2\s+v/)).toBeVisible();
    await expandStudentLinks(page);
    const linkedCard = authorizationCard(page, identity);
    await expect(linkedCard.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Paso 6: vista posterior de Vínculos muestra el nuevo vínculo secundario vigente', linkedCard);

    await changeIdentity(page);
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(studentCard).toBeVisible();
    await captureEvidence('Nuevo Apoderado Secundario: cuenta activada y estudiante vinculado visible', studentCard);
  });

  test('PF-APO-SEC-002 — Autorizar un Apoderado Secundario registrado previamente', async ({ page, captureEvidence }) => {
    const identity = await ensureRegisteredGuardian('existing');
    await captureEvidence('Estado inicial: la cuenta del Apoderado Secundario ya existe, pero aún no tiene estudiantes');

    await changeIdentity(page);
    await openLinksAndFillAuthorization(page, identity);
    await expect(page.locator('#guardian-profile option').filter({ hasText: identity.firstName })).toHaveCount(1);
    const explicitAuthorization = page.getByRole('checkbox', { name: /Vinculación Apoderado Secundario-Estudiante/ });
    await expect(explicitAuthorization).toBeVisible();
    await explicitAuthorization.check();
    await page.getByLabel('Buscar apoderado').fill(identity.lastName);
    const guardianOption = page.locator('#guardian-profile option').filter({ hasText: identity.firstName });
    await page.locator('#guardian-profile').selectOption(await guardianOption.getAttribute('value') ?? '');
    await captureEvidence('Apoderado Primario: apoderado secundario encontrado mediante búsqueda', authorizationForm(page));

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
    const operationalPickup = await openOperationalPickup(page);
    await captureEvidence('Portería: solicitud aprobada disponible para validación dual', queue);

    await operationalPickup.getByLabel('PIN de apoderado secundario').fill(pins.guardianPin);
    await operationalPickup.getByRole('button', { name: 'Validar PIN' }).first().click();
    await expect(page.getByText('PIN validado correctamente.')).toBeVisible();
    await captureEvidence('Portería: PIN del Apoderado Secundario validado correctamente', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expect(queue.getByText('Apoderado Secundario: validado')).toBeVisible();
    await captureEvidence('Portería: identidad del Apoderado Secundario marcada como validada', queue);

    await operationalPickup.getByLabel('PIN de estudiante').fill(pins.studentPin);
    await operationalPickup.getByRole('button', { name: 'Validar PIN' }).click();
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

  test('PF-APO-SEC-005 — Revocar la autorización del apoderado secundario evita el retiro', async ({ page, captureEvidence }) => {
    const identity = await ensureExistingRetriever({ authorize: true });
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    const availableStudent = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(availableStudent.getByRole('button', { name: 'Notificar retiro' })).toBeEnabled();
    await captureEvidence('Paso 1: Apoderado Secundario autorizado puede iniciar un retiro', availableStudent);

    await changeIdentity(page);
    await login(page, 'APODERADO');
    await page.goto('/links');
    await expandStudentLinks(page);
    const authorization = authorizationCard(page, identity);
    await expect(authorization.getByText('Vigente', { exact: true })).toBeVisible();
    await captureEvidence('Paso 2: Apoderado Primario visualiza la autorización secundaria vigente', authorization);

    await authorization.getByRole('button', { name: 'Revocar autorización' }).click();
    await expect(page.getByText('Autorización revocada correctamente.')).toBeVisible();
    await captureEvidence('Paso 3: Apoderado Primario revoca la autorización secundaria', undefined, { preserveToast: true });
    await dismissNotification(page);
    await expandStudentLinks(page);
    const studentCard = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
    await expect(studentCard.getByText(/1\s+v/)).toBeVisible();
    await expect(studentCard.getByText(`${identity.firstName} ${identity.lastName}`, { exact: true })).toHaveCount(0);
    await captureEvidence('Paso 4: la autorización secundaria ya no aparece entre los vínculos activos', studentCard);

    await changeIdentity(page);
    await loginWithCredentials(page, identity.email, identity.password, 'RETIRADOR_AUTORIZADO');
    await expect(page.getByText('No tienes estudiantes vinculados para mostrar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notificar retiro' })).toHaveCount(0);
    expect(await pickupStateForRetriever(identity.profileId)).toBeNull();
    await captureEvidence('Paso 5: Apoderado Secundario ya no puede iniciar un retiro y no existe solicitud creada');
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
