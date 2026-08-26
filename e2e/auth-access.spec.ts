import { expect, test } from './fixtures';

import { credentialsFor, type E2ERole } from './support/env';
import {
  isOutsideStudentLinkedToGuardian,
  removeOutsideStudentGuardianLink,
  resetE2EState,
  resolveE2EData,
} from './support/database';
import { login } from './support/ui';

test.describe('Autenticación, roles y vinculación', () => {
  test.beforeEach(async () => resetE2EState());

  const dashboardEyebrowByRole: Record<E2ERole, string> = {
    ADMIN: 'Administración',
    PORTERIA: 'Portería',
    DOCENTE: 'Docencia',
    APODERADO: 'Apoderado',
    ESTUDIANTE: 'Estudiante',
  };

  for (const role of ['ADMIN', 'PORTERIA', 'DOCENTE', 'APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    test(`PF-AUTH-002 — Iniciar sesión como ${role}`, async ({ page }) => {
      await test.step(`Given tengo una cuenta activa con rol ${role}`, async () => {
        await page.goto('/');
      });
      await test.step('When ingreso credenciales correctas', async () => login(page, role));
      await test.step('Then accedo al dashboard correspondiente', async () => {
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText(dashboardEyebrowByRole[role]);
      });
    });
  }

  test('PF-AUTH-003 — Rechazar credenciales incorrectas', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill('usuario-e2e-inexistente@example.invalid');
    await page.getByLabel('Password').fill('password-incorrecta');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('No pudimos iniciar sesión. Revisa tus credenciales o solicita apoyo a la institución.')).toBeVisible();
  });

  for (const role of ['APODERADO', 'ESTUDIANTE', 'DOCENTE'] as E2ERole[]) {
    test(`PF-ACC-002 — Restringir Portería para ${role}`, async ({ page, captureEvidence }) => {
      await login(page, role);
      await page.goto('/guard');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('status').filter({ hasText: 'No tienes permiso para esta sección' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Lógica de control de ingreso y salida/ })).not.toBeVisible();
      await captureEvidence(`Acceso a Portería denegado para ${role}`);
    });
  }

  test('PF-ACC-003 — Impedir al apoderado consultar un estudiante ajeno', async ({ page, captureEvidence }) => {
    const { students } = await resolveE2EData();
    await login(page, 'APODERADO');
    await page.goto(`/students/${students.outside}`);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('status').filter({ hasText: 'No tienes permiso para consultar este estudiante' }),
    ).toBeVisible();
    await captureEvidence('Consulta de estudiante ajeno rechazada con mensaje explicativo');
  });

  test('PF-VIN-ADM-001 — Permitir al administrador gestionar vinculaciones existentes', async ({ page, captureEvidence }) => {
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
    try {
      await login(page, 'ADMIN');
      await page.goto('/admin/relationships');
      await expect(page.getByRole('heading', { name: 'Vinculación Apoderado-Estudiante' })).toBeVisible();

      const studentSelect = page.getByLabel('Estudiante');
      const guardianSelect = page.getByLabel('Apoderado', { exact: true });
      const addRelationshipForm = page.getByRole('heading', { name: 'Agregar vinculación' }).locator('xpath=ancestor::form[1]');
      const relationshipsSection = page.getByRole('heading', { name: 'Relaciones actuales' }).locator('xpath=ancestor::section[1]');
      const relationshipSearch = page.getByLabel('Buscar relaciones');
      const relationshipCount = relationshipsSection.locator('[aria-live="polite"]');
      const insideStudentValue = await page.locator('#student_id option').filter({ hasText: 'Estudiante E2E Dentro' }).getAttribute('value');
      const studentValue = await page.locator('#student_id option').filter({ hasText: 'Estudiante E2E Fuera' }).getAttribute('value');
      const guardianValue = await page.locator('#guardian_profile_id option').filter({ hasText: 'Apoderado E2E' }).getAttribute('value');
      expect(insideStudentValue).not.toBeNull();
      expect(studentValue).not.toBeNull();
      expect(guardianValue).not.toBeNull();

      await expect(studentSelect).toHaveValue('');
      await expect(guardianSelect).toHaveValue('');
      await captureEvidence('Vista 1: formulario de vinculación con ambos combos por defecto');

      await studentSelect.click();
      await expect(studentSelect).toBeFocused();
      await captureEvidence('Vista 2: combo de estudiantes desplegado');

      await studentSelect.selectOption(insideStudentValue!);
      await expect(studentSelect).toHaveValue(insideStudentValue!);
      await expect(guardianSelect).toHaveValue('');
      await captureEvidence('Vista 3: estudiante con vínculo existente seleccionado', addRelationshipForm);

      await relationshipSearch.fill('Estudiante E2E Dentro');
      await expect(relationshipCount).toHaveText('1 estudiante · 1 vínculo');
      const initialRelationship = relationshipsSection.getByRole('button', { name: /Estudiante E2E Dentro.*1 vínculo/ });
      await expect(initialRelationship).toHaveAttribute('aria-expanded', 'false');
      await initialRelationship.click();
      await expect(initialRelationship).toHaveAttribute('aria-expanded', 'true');
      const initialGroup = initialRelationship.locator('xpath=ancestor::article[1]');
      await expect(initialGroup.getByRole('button', { name: 'Administrar' })).toBeVisible();
      await expect(initialGroup.getByRole('button', { name: 'Desvincular' })).not.toBeVisible();
      await captureEvidence('Vista 4: vínculo actual del estudiante seleccionado desplegado', relationshipsSection);

      await studentSelect.selectOption(studentValue!);
      await expect(studentSelect).toHaveValue(studentValue!);
      await expect(guardianSelect).toHaveValue('');
      await captureEvidence('Vista 5: estudiante sin vínculo seleccionado para la nueva relación', addRelationshipForm);

      await relationshipSearch.fill('Estudiante E2E Fuera');
      await expect(relationshipCount).toHaveText('0 estudiantes · 0 vínculos');
      await expect(relationshipsSection.getByText('No hay relaciones que coincidan con la búsqueda.')).toBeVisible();
      await captureEvidence('Vista 6: 0 vínculos actuales para el estudiante que se vinculará', relationshipsSection);

      await guardianSelect.selectOption(guardianValue!);
      await expect(studentSelect).toHaveValue(studentValue!);
      await expect(guardianSelect).toHaveValue(guardianValue!);
      await expect(page.getByRole('button', { name: 'Guardar vinculación' })).toBeEnabled();
      await captureEvidence('Vista 7: generación de vínculo antes de presionar Guardar vinculación', addRelationshipForm);

      await page.getByRole('button', { name: 'Guardar vinculación' }).click();

      await expect(page.getByText('Vinculación guardada correctamente.')).toBeVisible();
      expect(await isOutsideStudentLinkedToGuardian()).toBe(true);

      await relationshipSearch.fill('Apoderado E2E');
      await expect(relationshipCount).toHaveText('2 estudiantes · 2 vínculos');
      const insideRelationship = relationshipsSection.getByRole('button', { name: /Estudiante E2E Dentro.*1 vínculo/ });
      const outsideRelationship = relationshipsSection.getByRole('button', { name: /Estudiante E2E Fuera.*1 vínculo/ });
      await insideRelationship.click();
      await outsideRelationship.click();
      await expect(insideRelationship).toHaveAttribute('aria-expanded', 'true');
      await expect(outsideRelationship).toHaveAttribute('aria-expanded', 'true');
      await expect(insideRelationship.locator('xpath=ancestor::article[1]')).toContainText('Apoderado E2E');
      await expect(outsideRelationship.locator('xpath=ancestor::article[1]')).toContainText('Apoderado E2E');
      await captureEvidence('Vista 8: 2 vínculos existentes con ambas relaciones desplegadas', relationshipsSection);
    } finally {
      await removeOutsideStudentGuardianLink();
    }
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
  });

  for (const role of ['PORTERIA', 'DOCENTE', 'APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    test(`PF-VIN-ADM-002 — Restringir gestión administrativa para ${role}`, async ({ page }) => {
      await login(page, role);
      await page.goto('/admin/relationships');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Vinculación Apoderado-Estudiante' })).not.toBeVisible();
    });
  }

  test('PF-VIN-ADM-003 — Impedir que el administrador se vincule personalmente a un estudiante mediante código', async ({ page, captureEvidence }) => {
    await login(page, 'ADMIN');
    await page.goto('/students/link');
    await expect(page).toHaveURL(/\/dashboard/);
    const accessDeniedToast = page
      .getByRole('status')
      .filter({ hasText: 'Solo los apoderados pueden vincularse mediante código' });
    await expect(accessDeniedToast).toBeVisible();
    await expect(accessDeniedToast).toHaveClass(/bg-rose-50/);
    await expect(accessDeniedToast).toHaveClass(/text-rose-900/);
    await expect(page.getByRole('heading', { name: 'Vincular estudiante a cuenta' })).not.toBeVisible();
    await captureEvidence('Vinculación por código restringida al rol apoderado');
  });

  test('PF-VIN-001 — Vincular un estudiante mediante código válido', async ({ page, captureEvidence }) => {
    const { codes } = await resolveE2EData();
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
    try {
      await login(page, 'APODERADO');
      await page.getByRole('button', { name: 'Cerrar notificación' }).click();
      const linkedStudents = page.getByRole('heading', { name: 'Estudiantes vinculados' }).locator('xpath=ancestor::section[1]');
      await expect(linkedStudents.getByText('Estudiante E2E Fuera', { exact: true })).not.toBeVisible();
      await expect(linkedStudents.getByText('Estudiante E2E Dentro', { exact: true })).toBeVisible();
      await captureEvidence('Estado inicial: solo figura el estudiante previamente vinculado', linkedStudents);

      await page.goto('/students/link');
      await page.getByLabel('Código de vinculación').fill(codes.outside);
      const linkStudentSection = page.getByRole('heading', { name: 'Vincular estudiante a cuenta' }).locator('xpath=ancestor::section[1]');
      await captureEvidence('Acción: formulario preparado con un código válido', linkStudentSection);

      await page.getByRole('button', { name: 'Vincular estudiante' }).click();
      const successToast = page.getByRole('status').filter({ hasText: 'Vinculación éxitosa' });
      await expect(successToast).toBeVisible();
      await captureEvidence('Confirmación: vinculación exitosa informada al apoderado');

      await expect(page.getByText('Estudiante E2E Fuera', { exact: true })).toBeVisible();
      expect(await isOutsideStudentLinkedToGuardian()).toBe(true);
      await expect(linkedStudents.getByText('Estudiante E2E Dentro', { exact: true })).toBeVisible();
      await expect(linkedStudents.getByText('Estudiante E2E Fuera', { exact: true })).toBeVisible();
      await captureEvidence('Estado final: ambos estudiantes figuran en la cuenta del apoderado', linkedStudents);
    } finally {
      await removeOutsideStudentGuardianLink();
    }
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
  });

  test('PF-VIN-002 — Rechazar un código de vinculación inválido', async ({ page }) => {
    await login(page, 'APODERADO');
    await page.goto('/students/link');
    await page.getByLabel('Código de vinculación').fill('E2E-CODIGO-INEXISTENTE');
    await page.getByRole('button', { name: 'Vincular estudiante' }).click();
    await expect(page.getByText('Código de vinculación no válido')).toBeVisible();
  });

  test('PF-VIN-002 — Informar un vínculo duplicado', async ({ page }) => {
    const { codes } = await resolveE2EData();
    await login(page, 'APODERADO');
    await page.goto('/students/link');
    await page.getByLabel('Código de vinculación').fill(codes.inside);
    await page.getByRole('button', { name: 'Vincular estudiante' }).click();
    await expect(page.getByText('Este estudiante ya está vinculado a tu cuenta')).toBeVisible();
  });
});
