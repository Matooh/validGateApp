import { expect, test } from './fixtures';

import { credentialsFor, type E2ERole } from './support/env';
import {
  ensureSecondaryGuardianProfile,
  isOutsideStudentLinkedToGuardian,
  removeOutsideStudentGuardianLink,
  removeSecondaryGuardianRelationships,
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
    APODERADO: 'Apoderado Primario',
    ESTUDIANTE: 'Estudiante',
  };

  const roleDisplayName = (role: E2ERole) =>
    role === 'APODERADO' ? 'Apoderado Primario' : role;

  const loginCaseIdByRole: Record<E2ERole, string> = {
    ADMIN: 'PF-AUTH-002A',
    PORTERIA: 'PF-AUTH-002B',
    DOCENTE: 'PF-AUTH-002C',
    APODERADO: 'PF-AUTH-002D',
    ESTUDIANTE: 'PF-AUTH-002E',
  };

  const guardRestrictionCaseIdByRole: Partial<Record<E2ERole, string>> = {
    APODERADO: 'PF-ACC-002A',
    ESTUDIANTE: 'PF-ACC-002B',
    DOCENTE: 'PF-ACC-002C',
  };

  const adminRestrictionCaseIdByRole: Partial<Record<E2ERole, string>> = {
    PORTERIA: 'PF-VIN-ADM-002A',
    DOCENTE: 'PF-VIN-ADM-002B',
    APODERADO: 'PF-VIN-ADM-002C',
    ESTUDIANTE: 'PF-VIN-ADM-002D',
  };

  for (const role of ['ADMIN', 'PORTERIA', 'DOCENTE', 'APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    test(`${loginCaseIdByRole[role]} — Iniciar sesión como ${roleDisplayName(role)}`, async ({ page, captureEvidence }) => {
      await test.step(`Given tengo una cuenta activa con rol ${roleDisplayName(role)}`, async () => {
        await page.goto('/');
      });
      await test.step('When ingreso credenciales correctas', async () => login(page, role));
      await test.step('Then accedo al dashboard correspondiente', async () => {
        await expect(page).toHaveURL(/\/dashboard/);
        const loginToast = page.getByRole('status').filter({ hasText: 'Ingreso exitoso.' });
        await expect(loginToast).toBeVisible();
        await expect(loginToast).toHaveClass(/bg-emerald-50/);
        await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText(dashboardEyebrowByRole[role]);
        await captureEvidence(`Inicio de sesión exitoso como ${roleDisplayName(role)} con toast visible`, undefined, { preserveToast: true });
      });
    });
  }

  test('PF-AUTH-003 — Rechazar credenciales incorrectas', async ({ page, captureEvidence }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill('usuario-e2e-inexistente@example.invalid');
    await page.getByLabel('Password').fill('password-incorrecta');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);
    const rejectedToast = page.getByRole('status').filter({ hasText: 'No pudimos iniciar sesión' });
    await expect(rejectedToast).toBeVisible();
    await expect(rejectedToast).toHaveClass(/bg-rose-50/);
    await captureEvidence('Credenciales incorrectas rechazadas mediante toast de error', undefined, { preserveToast: true });
  });

  for (const role of ['APODERADO', 'ESTUDIANTE', 'DOCENTE'] as E2ERole[]) {
    test(`${guardRestrictionCaseIdByRole[role]} — Restringir Portería para ${roleDisplayName(role)}`, async ({ page, captureEvidence }) => {
      await login(page, role);
      await page.goto('/guard');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('status').filter({ hasText: 'No tienes permiso para esta sección' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Lógica de control de ingreso y salida/ })).not.toBeVisible();
      await captureEvidence(`Acceso a Portería denegado para ${roleDisplayName(role)} mediante toast`, undefined, { preserveToast: true });
    });
  }

  test('PF-ACC-003 — Impedir al Apoderado Primario consultar un estudiante ajeno', async ({ page, captureEvidence }) => {
    const { students } = await resolveE2EData();
    await login(page, 'APODERADO');
    await captureEvidence(`Paso 1: Apoderado Primario autenticado intentará consultar al estudiante ajeno Estudiante E2E Fuera (ID ${students.outside})`);
    await page.goto(`/students/${students.outside}`);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('status').filter({ hasText: 'No tienes permiso para consultar este estudiante' }),
    ).toBeVisible();
    await captureEvidence(`Paso 2: consulta de Estudiante E2E Fuera (ID ${students.outside}) rechazada con toast`, undefined, { preserveToast: true });
  });

  test('PF-VIN-ADM-001 — Permitir al administrador gestionar vínculos', async ({ page, captureEvidence }) => {
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
    const secondary = await ensureSecondaryGuardianProfile();
    try {
      await login(page, 'ADMIN');
      await page.goto('/admin/relationships');
      await expect(page.getByRole('heading', { name: 'Vinculación Apoderado Primario-Estudiante' })).toBeVisible();

      const studentSelect = page.getByLabel('Estudiante');
      const guardianSelect = page.getByLabel('Apoderado Primario', { exact: true });
      const addRelationshipForm = page.getByRole('heading', { name: 'Agregar vinculación' }).locator('xpath=ancestor::form[1]');
      const relationshipsSection = page.getByRole('heading', { name: 'Relaciones actuales' }).locator('xpath=ancestor::section[1]');
      const relationshipSearch = page.getByLabel('Buscar relaciones');
      const relationshipCount = relationshipsSection.locator('[aria-live="polite"]');
      const insideStudentValue = await page.locator('#student_id option').filter({ hasText: 'Estudiante E2E Dentro' }).getAttribute('value');
      const studentValue = await page.locator('#student_id option').filter({ hasText: 'Estudiante E2E Fuera' }).getAttribute('value');
      const guardianValue = await page.locator('#guardian_profile_id option').filter({ hasText: 'Apoderado E2E' }).getAttribute('value');
      const secondaryGuardianValue = await page.locator('#guardian_profile_id option').filter({ hasText: secondary.guardianName }).getAttribute('value');
      expect(insideStudentValue).not.toBeNull();
      expect(studentValue).not.toBeNull();
      expect(guardianValue).not.toBeNull();
      expect(secondaryGuardianValue).not.toBeNull();

      await relationshipSearch.fill('Estudiante E2E Dentro');
      await expect(relationshipCount).toHaveText('1 estudiante · 1 vínculo');
      const initialRelationship = relationshipsSection.getByRole('button', { name: /Estudiante E2E Dentro.*1 vínculo/ });
      await expect(initialRelationship).toHaveAttribute('aria-expanded', 'false');
      await initialRelationship.click();
      await expect(initialRelationship).toHaveAttribute('aria-expanded', 'true');
      const initialGroup = initialRelationship.locator('xpath=ancestor::article[1]');
      await expect(initialGroup.getByRole('button', { name: 'Administrar' })).toBeVisible();
      await expect(initialGroup.getByRole('button', { name: 'Desvincular' })).not.toBeVisible();
      await captureEvidence('Caso 1 · Estado inicial: estudiante con su vínculo existente visible', relationshipsSection);

      await expect(studentSelect).toHaveValue('');
      await expect(guardianSelect).toHaveValue('');
      await captureEvidence('Caso 1: formulario de vinculación antes de agregar el segundo Apoderado Primario');

      await studentSelect.click();
      await expect(studentSelect).toBeFocused();
      await captureEvidence('Caso 1: combo de estudiantes desplegado');

      await studentSelect.selectOption(insideStudentValue!);
      await expect(studentSelect).toHaveValue(insideStudentValue!);
      await expect(guardianSelect).toHaveValue('');
      await captureEvidence('Caso 1: estudiante con vínculo existente seleccionado', addRelationshipForm);

      await guardianSelect.selectOption(secondaryGuardianValue!);
      await expect(page.getByRole('button', { name: 'Guardar vinculación' })).toBeEnabled();
      await captureEvidence('Caso 1: segundo Apoderado Primario seleccionado para el estudiante que ya tiene vínculo', addRelationshipForm);

      await page.getByRole('button', { name: 'Guardar vinculación' }).click();
      await expect(page.getByText('Vinculación guardada correctamente.')).toBeVisible();
      await captureEvidence('Caso 1: toast confirma el nuevo vínculo', undefined, { preserveToast: true });
      await page.goto('/admin/relationships');
      await expect(page.getByText('Vinculación guardada correctamente.')).not.toBeVisible();

      await relationshipSearch.fill('Estudiante E2E Dentro');
      await expect(relationshipCount).toHaveText('1 estudiante · 2 vínculos');
      const linkedStudent = relationshipsSection.getByRole('button', { name: /Estudiante E2E Dentro.*2 vínculos/ });
      await linkedStudent.click();
      const linkedStudentGroup = linkedStudent.locator('xpath=ancestor::article[1]');
      await expect(linkedStudentGroup).toContainText('Apoderado E2E');
      await expect(linkedStudentGroup).toContainText(secondary.guardianName);
      await captureEvidence('Caso 1 · Estado final: estudiante ahora muestra dos apoderados vinculados', linkedStudentGroup);

      await relationshipSearch.fill('Estudiante E2E Fuera');
      await expect(relationshipCount).toHaveText('0 estudiantes · 0 vínculos');
      await expect(relationshipsSection.getByText('No hay relaciones que coincidan con la búsqueda.')).toBeVisible();
      await captureEvidence('Caso 2 · Estado inicial: listado confirma que el estudiante no tiene vínculos', relationshipsSection);

      await studentSelect.selectOption(studentValue!);
      await expect(studentSelect).toHaveValue(studentValue!);
      await expect(guardianSelect).toHaveValue('');
      await captureEvidence('Caso 2: estudiante sin vínculo seleccionado para agregar el primero', addRelationshipForm);

      await guardianSelect.selectOption(guardianValue!);
      await expect(studentSelect).toHaveValue(studentValue!);
      await expect(guardianSelect).toHaveValue(guardianValue!);
      await expect(page.getByRole('button', { name: 'Guardar vinculación' })).toBeEnabled();
      await captureEvidence('Caso 2: primer Apoderado Primario seleccionado antes de guardar', addRelationshipForm);

      await page.getByRole('button', { name: 'Guardar vinculación' }).click();

      await expect(page.getByText('Vinculación guardada correctamente.')).toBeVisible();
      expect(await isOutsideStudentLinkedToGuardian()).toBe(true);
      await captureEvidence('Caso 2: toast confirma el primer vínculo del estudiante', undefined, { preserveToast: true });

      await relationshipSearch.fill('Estudiante E2E');
      await expect(relationshipCount).toHaveText('2 estudiantes · 3 vínculos');
      const insideRelationship = relationshipsSection.getByRole('button', { name: /Estudiante E2E Dentro.*2 vínculos/ });
      const outsideRelationship = relationshipsSection.getByRole('button', { name: /Estudiante E2E Fuera.*1 vínculo/ });
      await insideRelationship.click();
      await outsideRelationship.click();
      await expect(insideRelationship).toHaveAttribute('aria-expanded', 'true');
      await expect(outsideRelationship).toHaveAttribute('aria-expanded', 'true');
      await expect(insideRelationship.locator('xpath=ancestor::article[1]')).toContainText('Apoderado E2E');
      await expect(outsideRelationship.locator('xpath=ancestor::article[1]')).toContainText('Apoderado E2E');
      await expect(insideRelationship.locator('xpath=ancestor::article[1]')).toContainText(secondary.guardianName);
      await captureEvidence('Caso 2 · Estado final: ambos estudiantes quedan visibles con sus vínculos administrados', relationshipsSection);
    } finally {
      await removeOutsideStudentGuardianLink();
      await removeSecondaryGuardianRelationships();
    }
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
  });

  for (const role of ['PORTERIA', 'DOCENTE', 'APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    test(`${adminRestrictionCaseIdByRole[role]} — Restringir gestión administrativa para ${roleDisplayName(role)}`, async ({ page, captureEvidence }) => {
      await login(page, role);
      await page.goto('/admin/relationships');
      await expect(page).toHaveURL(/\/dashboard/);
      const deniedToast = page.getByRole('status').filter({ hasText: 'No tienes permiso' });
      await expect(deniedToast).toBeVisible();
      await expect(deniedToast).toHaveClass(/bg-rose-50/);
      await expect(page.getByRole('heading', { name: 'Vinculación Apoderado Primario-Estudiante' })).not.toBeVisible();
      await captureEvidence(`Gestión administrativa restringida para ${roleDisplayName(role)} mediante toast`, undefined, { preserveToast: true });
    });
  }

  test('PF-VIN-ADM-003 — Impedir que el administrador se vincule personalmente a un estudiante mediante código', async ({ page, captureEvidence }) => {
    await login(page, 'ADMIN');
    await captureEvidence('Paso 1: administrador autenticado antes de intentar la vinculación personal');
    await page.goto('/students/link');
    await expect(page).toHaveURL(/\/dashboard/);
    const accessDeniedToast = page
      .getByRole('status')
      .filter({ hasText: 'Solo los Apoderados Primarios pueden vincularse mediante código' });
    await expect(accessDeniedToast).toBeVisible();
    await expect(accessDeniedToast).toHaveClass(/bg-rose-50/);
    await expect(accessDeniedToast).toHaveClass(/text-rose-900/);
    await expect(page.getByRole('heading', { name: 'Vincular estudiante a cuenta' })).not.toBeVisible();
    await captureEvidence('Paso 2: intento de abrir la vinculación mediante código rechazado con toast de error', undefined, { preserveToast: true });
  });

  test('PF-VIN-001A — Vincular un estudiante mediante código válido', async ({ page, captureEvidence }) => {
    const { codes } = await resolveE2EData();
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
    try {
      await login(page, 'APODERADO');
      await page.getByRole('button', { name: 'Cerrar notificación' }).click();
      await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Apoderado Primario');
      await captureEvidence('Paso 1: dashboard del Apoderado Primario antes de iniciar la vinculación');
      const linkedStudents = page.getByRole('heading', { name: 'Estudiantes vinculados' }).locator('xpath=ancestor::section[1]');
      await expect(linkedStudents.getByText('Estudiante E2E Fuera', { exact: true })).not.toBeVisible();
      await expect(linkedStudents.getByText('Estudiante E2E Dentro', { exact: true })).toBeVisible();
      await captureEvidence('Paso 2: dashboard muestra solamente al estudiante previamente vinculado', linkedStudents);

      await page.goto('/students/link');
      await expect(page.getByRole('heading', { name: 'Vincular estudiante a cuenta' })).toBeVisible();
      await captureEvidence('Paso 3: Apoderado Primario accede al panel para vincular un estudiante');
      await page.getByLabel('Código de vinculación').fill(codes.outside);
      const linkStudentSection = page.getByRole('heading', { name: 'Vincular estudiante a cuenta' }).locator('xpath=ancestor::section[1]');
      await captureEvidence(`Paso 4: código válido ${codes.outside} ingresado en el formulario`, linkStudentSection, { revealCodes: true });

      await page.getByRole('button', { name: 'Vincular estudiante' }).click();
      const successToast = page.getByRole('status').filter({ hasText: 'Vinculación exitosa' });
      await expect(successToast).toBeVisible();
      await captureEvidence('Paso 5: toast confirma que la vinculación fue exitosa', undefined, { preserveToast: true });

      await expect(page.getByText('Estudiante E2E Fuera', { exact: true })).toBeVisible();
      expect(await isOutsideStudentLinkedToGuardian()).toBe(true);
      await expect(linkedStudents.getByText('Estudiante E2E Dentro', { exact: true })).toBeVisible();
      await expect(linkedStudents.getByText('Estudiante E2E Fuera', { exact: true })).toBeVisible();
      await captureEvidence('Estado final: ambos estudiantes figuran en la cuenta del Apoderado Primario', linkedStudents);
    } finally {
      await removeOutsideStudentGuardianLink();
    }
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
  });

  test('PF-VIN-002A — Rechazar un código de vinculación inválido', async ({ page, captureEvidence }) => {
    await login(page, 'APODERADO');
    await page.goto('/students/link');
    const invalidCode = 'E2E-CODIGO-INEXISTENTE';
    await page.getByLabel('Código de vinculación').fill(invalidCode);
    const linkStudentSection = page.getByRole('heading', { name: 'Vincular estudiante a cuenta' }).locator('xpath=ancestor::section[1]');
    await captureEvidence(`Código erróneo ingresado: ${invalidCode}`, linkStudentSection, { revealCodes: true });
    await page.getByRole('button', { name: 'Vincular estudiante' }).click();
    await expect(page.getByText('Código de vinculación no válido')).toBeVisible();
    await captureEvidence('Código erróneo rechazado con mensaje de validación', undefined, { preserveToast: true });
  });

  test('PF-VIN-002B — Informar un vínculo duplicado', async ({ page }) => {
    const { codes } = await resolveE2EData();
    await login(page, 'APODERADO');
    await page.goto('/students/link');
    await page.getByLabel('Código de vinculación').fill(codes.inside);
    await page.getByRole('button', { name: 'Vincular estudiante' }).click();
    await expect(page.getByText('Este estudiante ya está vinculado a tu cuenta')).toBeVisible();
  });
});
