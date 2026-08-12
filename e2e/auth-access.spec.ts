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

  test('PF-VIN-ADM-001 — Permitir al administrador gestionar vinculaciones existentes', async ({ page }) => {
    await login(page, 'ADMIN');
    await page.goto('/admin/relationships');
    await expect(page.getByRole('heading', { name: 'Vinculación Apoderado-Estudiante' })).toBeVisible();

    const studentValue = await page.locator('#student_id option').filter({ hasText: 'Estudiante E2E Fuera' }).getAttribute('value');
    const guardianValue = await page.locator('#guardian_profile_id option').filter({ hasText: 'Apoderado E2E' }).getAttribute('value');
    expect(studentValue).not.toBeNull();
    expect(guardianValue).not.toBeNull();
    await page.getByLabel('Estudiante').selectOption(studentValue!);
    await page.getByLabel('Apoderado').selectOption(guardianValue!);
    await page.getByRole('button', { name: 'Guardar vinculación' }).click();

    await expect(page.getByText('Vinculación guardada correctamente.')).toBeVisible();
    const relationship = page.locator('details').filter({ hasText: 'Estudiante E2E Fuera' });
    await expect(relationship).toContainText('Apoderado E2E');
    await expect(relationship).toContainText('Apoderado');
  });

  for (const role of ['PORTERIA', 'DOCENTE', 'APODERADO', 'ESTUDIANTE'] as E2ERole[]) {
    test(`PF-VIN-ADM-002 — Restringir gestión administrativa para ${role}`, async ({ page }) => {
      await login(page, role);
      await page.goto('/admin/relationships');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Vinculación Apoderado-Estudiante' })).not.toBeVisible();
    });
  }

  test('PF-VIN-ADM-003 — Impedir que un administrador use la vinculación mediante código', async ({ page, captureEvidence }) => {
    await login(page, 'ADMIN');
    await page.goto('/students/link');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('status').filter({ hasText: 'Solo los apoderados pueden vincularse mediante código' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vincular estudiante a cuenta' })).not.toBeVisible();
    await captureEvidence('Vinculación por código restringida al rol apoderado');
  });

  test('PF-VIN-001 — Vincular un estudiante mediante código válido', async ({ page, captureEvidence }) => {
    const { codes } = await resolveE2EData();
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
    try {
      await login(page, 'APODERADO');
      const linkedStudents = page.getByRole('heading', { name: 'Estudiantes vinculados' }).locator('xpath=ancestor::section[1]');
      await expect(linkedStudents.getByText('Estudiante E2E Fuera', { exact: true })).not.toBeVisible();
      await captureEvidence('Estado inicial: estudiante y apoderado no vinculados', linkedStudents);

      await page.goto('/students/link');
      await page.getByLabel('Código de vinculación').fill(codes.outside);
      await page.getByRole('button', { name: 'Vincular estudiante' }).click();
      await expect(page.getByText('Vinculación éxitosa')).toBeVisible();
      await expect(page.getByText('Estudiante E2E Fuera', { exact: true })).toBeVisible();
      expect(await isOutsideStudentLinkedToGuardian()).toBe(true);
      await captureEvidence('Estado final: estudiante vinculado al apoderado', page.locator('article').filter({ hasText: 'Estudiante E2E Fuera' }).first());
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
