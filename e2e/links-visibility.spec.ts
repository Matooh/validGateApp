import { expect, test } from './fixtures';

import type { E2ERole } from './support/env';
import { ensureSameNameInstitutionLink, removeSameNameInstitutionLink, ensureExistingRetriever, removeRetrieverFixture, removeSecondaryGuardianRelationships, resetE2EState } from './support/database';
import { login, loginWithCredentials } from './support/ui';

test.describe('Visibilidad de vínculos', () => {
  test.beforeEach(async () => {
    await resetE2EState();
    await removeSecondaryGuardianRelationships();
    await removeRetrieverFixture('existing');
  });

  for (const role of ['APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    const roleDisplayName = role === 'APODERADO' ? 'Apoderado Primario' : role;
    const caseId = role === 'APODERADO' ? 'PF-VIN-001B' : 'PF-VIN-001C';
    test(`${caseId} — ${roleDisplayName} consulta sus vínculos`, async ({ page, captureEvidence }) => {
      const sameName = role === 'APODERADO' ? await ensureSameNameInstitutionLink() : null;
      try {
        await login(page, role);
        await page.goto('/links');
        await expect(page.getByRole('heading', { name: 'Vínculos' })).toBeVisible();
        await expect(page.getByText('No fue posible cargar los vínculos.')).toHaveCount(0);
        const linkedStudents = page.locator('article').filter({ hasText: sameName?.studentName ?? 'Estudiante E2E Dentro' });
        await expect(linkedStudents).toHaveCount(sameName ? 2 : 1);
        for (const article of await linkedStudents.all()) {
          const toggle = article.getByRole('button');
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await expect(article.getByText('Apoderado Primario', { exact: true })).toBeVisible();
          await captureEvidence(`${roleDisplayName}: vínculo expandido con institución y persona visible`, article);
        }
        if (role === 'APODERADO') {
          const studentCards = await linkedStudents.allTextContents();
          expect(studentCards.some((text) => text.includes(sameName!.institutionName))).toBe(true);
          expect(studentCards.some((text) => text.includes('VALIDGATE E2E') && !text.includes(sameName!.institutionName))).toBe(true);
        }
      } finally {
        if (sameName) await removeSameNameInstitutionLink();
      }
    });
  }

  test.skip('PF-VIN-SEC-001 — Apoderado Secundario ve todos los vínculos del mismo estudiante', async ({ page }) => {
    const secondary = await ensureExistingRetriever({ authorize: true });
    try {
      await loginWithCredentials(page, secondary.email, secondary.password, 'RETIRADOR_AUTORIZADO');
      await page.goto('/links');

      const studentToggle = page.getByRole('button', { name: /Estudiante E2E Dentro.*2 vínculos/ });
      await expect(studentToggle).toHaveAttribute('aria-expanded', 'false');
      await studentToggle.click();
      const studentGroup = studentToggle.locator('xpath=ancestor::article[1]');
      await expect(studentGroup.getByText('Apoderado Primario', { exact: true })).toBeVisible();
      await expect(studentGroup.getByText('Apoderado Secundario', { exact: true })).toBeVisible();
      await expect(page.getByText('Estudiante E2E Fuera', { exact: true })).toHaveCount(0);
    } finally {
      await removeSecondaryGuardianRelationships();
      await removeRetrieverFixture('existing');
    }
  });
});
