import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  cleanupTraceabilityFixtures,
  createRetrieverTraceabilityHistory,
  ensureExistingRetriever,
  expireRetrieverRelationDirect,
  prepareTraceabilityFixtures,
  removeRetrieverFixture,
  resetE2EState,
  revokeRetrieverRelationDirect,
  type TraceabilityEventFixture,
} from './support/database';
import { login, loginWithCredentials } from './support/ui';

type TraceabilityFixtures = Awaited<ReturnType<typeof prepareTraceabilityFixtures>>;

function traceabilitySection(page: Page) {
  return page.getByRole('heading', { name: 'Trazabilidad reciente' }).locator('xpath=ancestor::section[1]');
}

function eventCard(section: Locator, event: TraceabilityEventFixture) {
  return section.locator('article').filter({ hasText: event.note });
}

async function expectEventData(section: Locator, event: TraceabilityEventFixture) {
  const card = eventCard(section, event);
  await expect(card).toHaveCount(1);
  await expect(card.getByText(event.studentName, { exact: true })).toBeVisible();
  await expect(card.getByText(event.operation, { exact: true })).toBeVisible();
  await expect(card.getByText(event.result, { exact: true })).toBeVisible();
  await expect(card.getByText(event.method, { exact: true })).toBeVisible();
  await expect(card).toContainText('Descripción:');
  await expect(card).toContainText(event.note);
  await expect(card.locator('p').last()).toHaveText(/\d{1,2}[-/]\d{1,2}[-/]\d{4}.*\d{1,2}:\d{2}/);
  return card;
}

async function expectEventHidden(section: Locator, event: TraceabilityEventFixture) {
  await expect(eventCard(section, event)).toHaveCount(0);
  await expect(section.getByText(event.studentName, { exact: true })).toHaveCount(0);
}

async function changeIdentity(page: Page) {
  await page.context().clearCookies();
  await page.goto('/');
}

async function expectInstitutionTraceability(section: Locator, fixtures: TraceabilityFixtures) {
  await expectEventData(section, fixtures.events.familyA);
  await expectEventData(section, fixtures.events.familyB);
  await expectEventHidden(section, fixtures.events.foreign);
}

async function traceabilitySnapshot(section: Locator, marker: string) {
  return section.locator('article').filter({ hasText: marker }).evaluateAll((cards) =>
    cards.map((card) => card.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  );
}

test.describe('Aislamiento de trazabilidad según rol y vinculación', () => {
  test.describe.configure({ timeout: 180_000 });

  test.afterEach(async () => {
    await cleanupTraceabilityFixtures();
    await resetE2EState();
  });

  test('PF-TRA-002A — Aislar la trazabilidad entre apoderados y estudiantes de familias distintas', async ({ page, captureEvidence }) => {
    const fixtures = await prepareTraceabilityFixtures();

    await login(page, 'APODERADO');
    let section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.familyA);
    await expectEventHidden(section, fixtures.events.familyB);
    await captureEvidence('Familia A · Apoderado Primario: sección completa con evento propio y familia B ausente', section);

    await changeIdentity(page);
    await login(page, 'ESTUDIANTE');
    section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.familyA);
    await expectEventHidden(section, fixtures.events.familyB);
    await captureEvidence('Familia A · Estudiante: sección completa con trazabilidad propia y familia B ausente', section);

    await changeIdentity(page);
    await loginWithCredentials(page, fixtures.guardianB.email, fixtures.guardianB.password, fixtures.guardianB.role);
    section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.familyB);
    await expectEventHidden(section, fixtures.events.familyA);
    await captureEvidence('Familia B · Apoderado Primario: sección completa con evento propio y familia A ausente', section);

    await changeIdentity(page);
    await loginWithCredentials(page, fixtures.studentB.email, fixtures.studentB.password, fixtures.studentB.role);
    section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.familyB);
    await expectEventHidden(section, fixtures.events.familyA);
    await captureEvidence('Familia B · Estudiante: sección completa con trazabilidad propia y familia A ausente', section);
  });

  test('PF-TRA-002B — Limitar administrador y portería a la trazabilidad de su institución', async ({ page, captureEvidence }) => {
    const fixtures = await prepareTraceabilityFixtures();

    await login(page, 'ADMIN');
    let section = traceabilitySection(page);
    await expectInstitutionTraceability(section, fixtures);
    await captureEvidence('Administrador: eventos completos de su institución y ausencia de la institución ajena', section);

    await changeIdentity(page);
    await login(page, 'PORTERIA');
    section = traceabilitySection(page);
    await expectInstitutionTraceability(section, fixtures);
    await captureEvidence('Portería: eventos completos de su institución y ausencia de la institución ajena', section);
  });

  test('PF-TRA-002C — Limitar al Apoderado Secundario y conservar únicamente su retiro histórico', async ({ page, captureEvidence }) => {
    const fixtures = await prepareTraceabilityFixtures();
    await removeRetrieverFixture('existing');
    const retriever = await ensureExistingRetriever({ authorize: true });
    await createRetrieverTraceabilityHistory(retriever.profileId, retriever.relationId!);

    await loginWithCredentials(page, retriever.email, retriever.password, 'RETIRADOR_AUTORIZADO');
    let section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.familyA);
    await expectEventHidden(section, fixtures.events.familyB);
    const history = section.locator('article').filter({ hasText: 'Retiro con PIN dual' });
    await expect(history).toHaveCount(1);
    await expect(history.getByText('Estudiante E2E Dentro', { exact: true })).toBeVisible();
    await expect(history.getByText('Retiro', { exact: true })).toBeVisible();
    await expect(history.getByText('Cancelled authorization revoked', { exact: true })).toBeVisible();
    await expect(history.getByText(/Estado final: CANCELLED_AUTHORIZATION_REVOKED/)).toBeVisible();
    await expect(history.locator('p').last()).toHaveText(/\d{1,2}[-/]\d{1,2}[-/]\d{4}.*\d{1,2}:\d{2}/);
    await captureEvidence('Apoderado Secundario vigente: evento del estudiante autorizado e historial propio con datos completos', section);

    await revokeRetrieverRelationDirect(retriever.relationId!);
    await page.reload();
    section = traceabilitySection(page);
    await expect(eventCard(section, fixtures.events.familyA)).toHaveCount(0);
    await expect(history).toHaveCount(1);
    await captureEvidence('Apoderado Secundario revocado: sección completa sin eventos del estudiante y con su retiro histórico', section);

    await expireRetrieverRelationDirect(retriever.relationId!);
    await page.reload();
    section = traceabilitySection(page);
    await expect(eventCard(section, fixtures.events.familyA)).toHaveCount(0);
    const expiredHistory = section.locator('article').filter({ hasText: 'Retiro con PIN dual' });
    await expect(expiredHistory).toHaveCount(1);
    await expect(expiredHistory.getByText('Estudiante E2E Dentro', { exact: true })).toBeVisible();
    await captureEvidence('Apoderado Secundario vencido: sección completa, aislada y únicamente con su historial propio', section);

    await resetE2EState();
    await removeRetrieverFixture('existing');
  });

  test('PF-TRA-002D — Aislar al docente de la trazabilidad de otra institución', async ({ page, captureEvidence }) => {
    const fixtures = await prepareTraceabilityFixtures();

    await login(page, 'DOCENTE');
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Docencia');
    await captureEvidence('Docente: Dashboard de su institución antes de revisar la trazabilidad');
    const section = traceabilitySection(page);
    await expectInstitutionTraceability(section, fixtures);
    await captureEvidence('Docente: trazabilidad institucional completa con datos y evento ajeno ausente', section);
  });

  test('PF-TRA-002E — Mostrar la misma trazabilidad institucional a dos docentes de la misma institución', async ({ page, captureEvidence }) => {
    const fixtures = await prepareTraceabilityFixtures();

    await login(page, 'DOCENTE');
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Docencia');
    await captureEvidence('Docente A: Dashboard de la misma institución');
    let section = traceabilitySection(page);
    await expectInstitutionTraceability(section, fixtures);
    const primarySnapshot = await traceabilitySnapshot(section, fixtures.marker);
    expect(primarySnapshot).toHaveLength(2);
    await captureEvidence('Docente A: elementos de trazabilidad institucional con todos sus datos', section);

    await changeIdentity(page);
    await loginWithCredentials(page, fixtures.teacherB.email, fixtures.teacherB.password, fixtures.teacherB.role);
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Docencia');
    await captureEvidence('Docente B: Dashboard de la misma institución');
    section = traceabilitySection(page);
    await expectInstitutionTraceability(section, fixtures);
    const secondarySnapshot = await traceabilitySnapshot(section, fixtures.marker);
    expect(secondarySnapshot).toEqual(primarySnapshot);
    await captureEvidence('Docente B: exactamente los mismos elementos y datos que el docente A', section);
  });
  test('PF-TRA-002F — Mostrar distinta trazabilidad institucional a dos docentes de diferentes instituciones', async ({ page, captureEvidence }) => {
    const fixtures = await prepareTraceabilityFixtures();

    await login(page, 'DOCENTE');
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Docencia');
    await captureEvidence('Docente A: Dashboard de su institución');
    let section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.familyA);
    await expectEventData(section, fixtures.events.familyB);
    await expectEventHidden(section, fixtures.events.foreign);
    const primarySnapshot = await traceabilitySnapshot(section, fixtures.marker);
    await captureEvidence('Docente A: trazabilidad de su institución, sin eventos de la institución ajena', section);

    await changeIdentity(page);
    await loginWithCredentials(page, fixtures.teacherForeign.email, fixtures.teacherForeign.password, fixtures.teacherForeign.role);
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Docencia');
    await expect(page.getByText(fixtures.foreignInstitutionName, { exact: true })).toBeVisible();
    await captureEvidence('Docente B: Dashboard de una institución diferente');
    section = traceabilitySection(page);
    await expectEventData(section, fixtures.events.foreign);
    await expectEventHidden(section, fixtures.events.familyA);
    await expectEventHidden(section, fixtures.events.familyB);
    const foreignSnapshot = await traceabilitySnapshot(section, fixtures.marker);
    expect(foreignSnapshot).not.toEqual(primarySnapshot);
    await captureEvidence('Docente B: trazabilidad diferente y aislada de su institución', section);
  });
});
