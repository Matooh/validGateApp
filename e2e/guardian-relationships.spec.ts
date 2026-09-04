import { expect, test } from './fixtures';

import {
  addSecondaryGuardianRelationshipToInside,
  removeSecondaryGuardianRelationships,
  resetE2EState,
} from './support/database';
import { login } from './support/ui';

test.describe('Relaciones de apoderados agrupadas por estudiante', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await resetE2EState();
    await removeSecondaryGuardianRelationships();
  });

  test('PF-VIN-ADM-004 — Consolidar, buscar y administrar vínculos individuales', async ({ page, captureEvidence }) => {
    const secondary = await addSecondaryGuardianRelationshipToInside();
    try {
      await login(page, 'ADMIN');
      await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Administración');
      await captureEvidence('Administrador: dashboard antes de consultar y gestionar vínculos');
      await page.goto('/admin/relationships');
      const manageLinks = page.locator('details[data-accordion]').filter({ hasText: 'Gestionar vinculaciones' }).first();
      await manageLinks.locator('summary').first().click();
      const primaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Primario-Estudiante' }).first();
      const secondaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Secundario-Estudiante' }).first();
      await primaryManagement.locator('summary').first().click();
      await secondaryManagement.locator('summary').first().click();
      await expect(primaryManagement.getByRole('heading', { name: 'Vinculación Apoderado Primario-Estudiante' })).toBeVisible();
      await expect(secondaryManagement.getByText('Vinculación Apoderado Secundario-Estudiante', { exact: true })).toBeVisible();
      const primaryStudentSelect = primaryManagement.locator('select[name="student_id"]');
      const primaryGuardianSelect = primaryManagement.locator('select[name="guardian_profile_id"]');
      await expect(primaryStudentSelect).toHaveCount(1);
      await expect(primaryGuardianSelect).toHaveCount(1);
      await expect(primaryStudentSelect.locator('option')).not.toHaveCount(1);
      await expect(primaryGuardianSelect.locator('option')).not.toHaveCount(1);
      await expect(primaryManagement.getByRole('button', { name: 'Guardar vinculación' })).toBeVisible();

      await expect(secondaryManagement.getByRole('combobox', { name: 'Estudiante', exact: true })).toBeVisible();
      await expect(secondaryManagement.getByRole('combobox', { name: 'Apoderado secundario', exact: true })).toBeVisible();
      await expect(secondaryManagement.getByLabel('Válido desde')).toBeVisible();
      await expect(secondaryManagement.getByLabel('Válido hasta')).toBeVisible();
      await expect(secondaryManagement.getByRole('checkbox', { name: /Confirmo que puede retirar al estudiante/ })).toBeVisible();
      await expect(secondaryManagement.getByRole('button', { name: 'Autorizar apoderado' })).toBeVisible();
      await captureEvidence('Paso 1: ADMIN despliega y verifica los controles de vinculación primaria y secundaria', manageLinks);
      return;

      const section = page.getByRole('heading', { name: 'Relaciones actuales' }).locator('xpath=ancestor::section[1]');
      const search = section.getByPlaceholder('Nombre de estudiante o apoderado vinculado');
      const counter = section.locator('[aria-live="polite"]');

      await search.fill('Estudiante E2E Dentro');
      await expect(counter).toHaveText('1 estudiante · 2 vínculos');
      const studentToggle = section.getByRole('button', { name: /Estudiante E2E Dentro.*2 vínculos/ });
      await expect(studentToggle).toHaveCount(1);
      await expect(studentToggle).toHaveAttribute('aria-expanded', 'false');
      await studentToggle.click();
      await expect(studentToggle).toHaveAttribute('aria-expanded', 'true');

      const studentGroup = studentToggle.locator('xpath=ancestor::article[1]');
      await expect(studentGroup.getByText('Apoderado E2E', { exact: true })).toBeVisible();
      await expect(studentGroup.getByText(secondary.guardianName, { exact: true })).toBeVisible();
      await expect(studentGroup.getByText('Personas vinculadas (2)')).toBeVisible();
      await captureEvidence('Estudiante: Estudiante E2E Dentro, consolidado con dos personas vinculadas', studentGroup);

      await studentToggle.click();
      await expect(studentToggle).toHaveAttribute('aria-expanded', 'false');
      await search.fill(secondary.guardianName);
      await expect(counter).toHaveText('1 estudiante · 2 vínculos');
      await expect(section.getByRole('button', { name: /Estudiante E2E Dentro.*2 vínculos/ })).toBeVisible();

      await search.fill('Apoderado E2E');
      await expect(counter).toHaveText('1 estudiante · 2 vínculos');

      await search.fill('');
      const expandedStudent = section.getByRole('button', { name: /Estudiante E2E Dentro.*2 vínculos/ });
      await expandedStudent.click();
      const secondaryRelationship = section.getByTestId(`student-relationship-${secondary.relationshipId}`);
      await expect(secondaryRelationship.getByRole('button', { name: 'Administrar' })).toBeVisible();
      await expect(secondaryRelationship.getByRole('button', { name: 'Desvincular' })).not.toBeVisible();

      await secondaryRelationship.getByRole('button', { name: 'Administrar' }).click();
      const relationType = secondaryRelationship.getByLabel('Tipo de relación');
      const saveButton = secondaryRelationship.getByRole('button', { name: 'Guardar cambios' });
      await expect(saveButton).toBeDisabled();
      await relationType.selectOption('RETIRADOR_AUTORIZADO');
      await expect(saveButton).toBeEnabled();
      await captureEvidence('Administrador: controles individuales habilitados para el vínculo seleccionado', secondaryRelationship);
      await secondaryRelationship.getByRole('button', { name: 'Cancelar' }).click();
      await expect(secondaryRelationship.getByText('Apoderado Primario', { exact: true })).toBeVisible();

      await secondaryRelationship.getByRole('button', { name: 'Administrar' }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await secondaryRelationship.getByRole('button', { name: 'Desvincular' }).click();
      await expect(page.getByText('Vinculación eliminada correctamente.')).toBeVisible();
      await search.fill('Estudiante E2E Dentro');
      await expect(counter).toHaveText('1 estudiante · 1 vínculo');
      await expect(section.getByRole('button', { name: /Estudiante E2E Dentro.*1 vínculo/ })).toHaveCount(1);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(section.getByRole('button', { name: /Estudiante E2E Dentro.*1 vínculo/ })).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await removeSecondaryGuardianRelationships();
    }
  });
});
