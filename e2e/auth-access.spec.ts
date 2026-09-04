import { expect, test } from './fixtures';

import { credentialsFor, type E2ERole } from './support/env';
import {
  ensureSecondaryGuardianProfile,
  activateRegistrationFixture,
  isOutsideStudentLinkedToGuardian,
  removeOutsideStudentGuardianLink,
  removeStudentByCode,
  removeSecondaryGuardianRelationships,
  registrationFixture,
  registrationProfile,
  removeRegistrationFixture,
  resetE2EState,
  resolveE2EData,
} from './support/database';
import { login, loginWithCredentials, logout } from './support/ui';

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
    await page.locator('#email').fill('usuario-e2e-inexistente@example.invalid');
    await page.locator('#password').fill('password-incorrecta');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);
    const rejectedToast = page.getByRole('status').filter({ hasText: 'No pudimos iniciar sesión' });
    await expect(rejectedToast).toBeVisible();
    await expect(rejectedToast).toHaveClass(/bg-rose-50/);
    await captureEvidence('Credenciales incorrectas rechazadas mediante toast de error', undefined, { preserveToast: true });
  });

  test('PF-AUTH-004 — Registrar usuario desde el home', async ({ page, captureEvidence }) => {
    test.setTimeout(90_000);
    const fixture = registrationFixture('basic');
    await removeRegistrationFixture('basic');
    try {
      await page.goto('/');
      await captureEvidence('Paso 1: home con acceso al formulario de inicio de sesión');
      await page.getByRole('link', { name: 'registrarse' }).click();
      await expect(page).toHaveURL(/\/register/);
      const form = page.getByRole('heading', { name: 'Registro de usuario' }).locator('xpath=ancestor::main[1]');
      await captureEvidence('Paso 2: formulario de registro visible desde el home', form);
      await form.getByLabel('Nombres').fill(fixture.firstName);
      await form.getByLabel('Apellidos').fill(fixture.lastName);
      await form.getByLabel('Institución').selectOption({ label: fixture.institutionName });
      await form.getByLabel('Correo electrónico').fill(fixture.email);
      await form.getByLabel('RUT').fill(fixture.rut);
      await form.getByLabel('Contraseña', { exact: true }).fill(fixture.password);
      await form.getByLabel('Repetir contraseña').fill(fixture.password);
      await captureEvidence('Paso 3: formulario de registro completo antes de enviar', form);
      await form.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('status').filter({ hasText: 'Registro exitoso' })).toBeVisible();
      await captureEvidence('Paso 4: registro exitoso antes de iniciar sesión', undefined, { preserveToast: true });
      await activateRegistrationFixture('basic');
      await loginWithCredentials(page, fixture.email, fixture.password);
      await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Sin rol asignado');
      await expect(page.getByText('Cuenta pendiente', { exact: true })).toBeVisible();
      const profile = await registrationProfile('basic');
      expect(profile.role).toBe('PENDIENTE');
      await captureEvidence('Paso 5: dashboard del usuario registrado con rol pendiente de asignación');
    } finally {
      await removeRegistrationFixture('basic');
    }
  });

  test('PF-AUTH-005 — Registrar usuario y asignar rol de Apoderado', async ({ page, captureEvidence }) => {
    test.setTimeout(90_000);
    const fixture = registrationFixture('guardian');
    await removeRegistrationFixture('guardian');
    try {
      await page.goto('/');
      await captureEvidence('Paso 1: home antes de iniciar el registro');
      await page.getByRole('link', { name: 'registrarse' }).click();
      const registration = page.getByRole('heading', { name: 'Registro de usuario' }).locator('xpath=ancestor::main[1]');
      await captureEvidence('Paso 2: formulario de registro abierto desde el home', registration);
      await registration.getByLabel('Nombres').fill(fixture.firstName);
      await registration.getByLabel('Apellidos').fill(fixture.lastName);
      await registration.getByLabel('Institución').selectOption({ label: fixture.institutionName });
      await registration.getByLabel('Correo electrónico').fill(fixture.email);
      await registration.getByLabel('RUT').fill(fixture.rut);
      await registration.getByLabel('Contraseña', { exact: true }).fill(fixture.password);
      await registration.getByLabel('Repetir contraseña').fill(fixture.password);
      await captureEvidence('Paso 3: usuario registrado listo para crear la cuenta', registration);
      await registration.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('status').filter({ hasText: 'Registro exitoso' })).toBeVisible();
      await captureEvidence('Paso 4: cuenta creada con estado pendiente', undefined, { preserveToast: true });

      await activateRegistrationFixture('guardian');
      await loginWithCredentials(page, fixture.email, fixture.password);
      await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Sin rol asignado');
      await expect(page.getByText('Cuenta pendiente', { exact: true })).toBeVisible();
      await captureEvidence('Paso 5: dashboard del usuario registrado antes de recibir un rol');
      await logout(page);

      await login(page, 'ADMIN');
      await captureEvidence('Paso 6: ADMIN ingresa al dashboard para gestionar el usuario');
      await page.goto('/admin/users');
      const userRow = page.locator('article').filter({ hasText: fixture.email });
      await expect(userRow).toBeVisible();
      await expect(userRow).toContainText('Sin rol asignado');
      await captureEvidence('Paso 7: ADMIN encuentra al usuario pendiente en el módulo de gestión de usuarios', userRow);
      await userRow.getByLabel('Asignar rol').selectOption('APODERADO');
      await captureEvidence('Paso 8: ADMIN selecciona el rol Apoderado', userRow);
      await userRow.getByRole('button', { name: 'Guardar rol' }).click();
      await expect(page.getByRole('status')).toContainText('Rol actualizado correctamente');
      await expect(userRow).toContainText('Rol actual: Apoderado');
      expect((await registrationProfile('guardian')).role).toBe('APODERADO');
      await captureEvidence('Paso 9: ADMIN confirma la asignación del rol Apoderado', userRow, { preserveToast: true });

      await logout(page);
      await loginWithCredentials(page, fixture.email, fixture.password, 'Apoderado Primario');
      await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Apoderado Primario');
      await expect(page.getByText('Apoderado Primario', { exact: true }).first()).toBeVisible();
      await captureEvidence('Paso 10: dashboard del usuario refleja el rol Apoderado asignado');
    } finally {
      await removeRegistrationFixture('guardian');
    }
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
    await login(page, 'ADMIN');
    await page.goto('/admin/relationships');
    const manageLinks = page.locator('details[data-accordion]').filter({ hasText: 'Gestionar vinculaciones' }).first();
    await expect(manageLinks).toHaveCount(1);
    await expect(manageLinks).not.toHaveAttribute('open', '');
    await manageLinks.locator('summary').first().click();
    const primaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Primario-Estudiante' }).first();
    const secondaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Secundario-Estudiante' }).first();
    await primaryManagement.locator('summary').first().click();
    await secondaryManagement.locator('summary').first().click();
    await expect(primaryManagement.getByRole('heading', { name: 'Vinculación Apoderado Primario-Estudiante' })).toBeVisible();
    await expect(secondaryManagement.getByRole('heading', { name: 'Vinculación Apoderado Secundario-Estudiante' })).toBeVisible();
    await captureEvidence('Paso 1: Administrador abre Gestionar vinculaciones y visualiza las opciones primaria y secundaria', manageLinks);
  });

  test.skip('PF-VIN-ADM-001-LEGACY — Permitir al administrador gestionar vínculos con administración de registros', async ({ page, captureEvidence }) => {
    expect(await isOutsideStudentLinkedToGuardian()).toBe(false);
    const secondary = await ensureSecondaryGuardianProfile();
    try {
      await login(page, 'ADMIN');
      await page.goto('/admin/relationships');
      const manageLinks = page.locator('details[data-accordion]').filter({ hasText: 'Gestionar vinculaciones' }).first();
      await expect(manageLinks).toHaveCount(1);
      await expect(manageLinks).not.toHaveAttribute('open', '');
      await manageLinks.locator('summary').first().click();
      const primaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Primario-Estudiante' }).first();
      const secondaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Secundario-Estudiante' }).first();
      await primaryManagement.locator('summary').first().click();
      await secondaryManagement.locator('summary').first().click();
      await expect(primaryManagement.getByRole('heading', { name: 'Vinculación Apoderado Primario-Estudiante' })).toBeVisible();
      await expect(secondaryManagement.getByText('Vinculación Apoderado Secundario-Estudiante', { exact: true })).toBeVisible();
      await captureEvidence('Administrador: desplegable Gestionar vinculaciones muestra las opciones primaria y secundaria', manageLinks);
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
      if (role === 'PORTERIA' || role === 'DOCENTE') {
        await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
        const navigation = page.getByRole('navigation', { name: 'Opciones de navegación' });
        await expect(navigation.getByRole('link', { name: 'Vínculos', exact: true })).toHaveCount(0);
        await captureEvidence(`Paso 1: ${roleDisplayName(role)} no muestra Vínculos en el menú hamburguesa`, navigation);
        await page.goto('/links');
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByRole('status').filter({ hasText: 'No tienes permiso para esta sección' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Vínculos', exact: true })).toHaveCount(0);
        await captureEvidence(`Paso 2: ${roleDisplayName(role)} no puede acceder directamente a /links`, undefined, { preserveToast: true });
        return;
      }
      await page.goto('/admin/relationships');
      await expect(page).toHaveURL(/\/links/);
      await expect(page.getByText('Gestionar vinculaciones', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Vinculación Apoderado Primario-Estudiante' })).not.toBeVisible();
      if (role === 'APODERADO') {
        await expect(page.getByText('Vinculación Apoderado Primario-Estudiante', { exact: true })).toHaveCount(0);
      }
      if (role === 'ESTUDIANTE') {
        await expect(page.getByText('Vinculación Apoderado Primario-Estudiante', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Vinculación Apoderado Secundario-Estudiante', { exact: true })).toHaveCount(0);
      }
      await captureEvidence(`Gestión administrativa restringida para ${roleDisplayName(role)}`);
    });
  }

  test('PF-VIN-ADM-003 — Impedir que el administrador se vincule personalmente a un estudiante', async ({ page, captureEvidence }) => {
    await login(page, 'ADMIN');
    await page.goto('/links');
    const manageLinks = page.locator('details[data-accordion]').filter({ hasText: 'Gestionar vinculaciones' }).first();
    await expect(manageLinks).toBeVisible();
    await manageLinks.locator('summary').first().click();
    const primaryManagement = manageLinks.locator('details[data-accordion]').filter({ hasText: 'Vinculación Apoderado Primario-Estudiante' }).first();
    await primaryManagement.locator('summary').click();
    const studentSelect = primaryManagement.getByRole('combobox', { name: 'Estudiante' });
    const guardianSelect = primaryManagement.getByRole('combobox', { name: 'Apoderado Primario' });
    const adminEmail = credentialsFor('ADMIN').email;
    await studentSelect.click();
    await expect(studentSelect).toHaveAttribute('aria-expanded', 'true');
    const studentOptions = primaryManagement.locator('#primary-student-options');
    await expect(studentOptions).toBeVisible();
    await expect(studentOptions).not.toContainText('Admin E2E');
    await expect(studentOptions).not.toContainText(adminEmail);
    await guardianSelect.click();
    await expect(guardianSelect).toHaveAttribute('aria-expanded', 'true');
    const guardianOptions = primaryManagement.locator('#primary-guardian-profile-options');
    await expect(guardianOptions).toBeVisible();
    expect(await guardianOptions.getByRole('option').count()).toBeGreaterThan(0);
    await expect(guardianOptions).toContainText('Apoderado Primario');
    await expect(guardianOptions).not.toContainText('Admin E2E');
    await expect(guardianOptions).not.toContainText(adminEmail);
    await captureEvidence('ADMIN: los desplegables de estudiante y apoderado no ofrecen vinculación con cuentas ADMIN', primaryManagement);
  });

  test('PF-VIN-001A — Registrar y vincular un estudiante mediante código válido', async ({ page, captureEvidence }) => {
    let linkCode = '';
    try {
      await login(page, 'ADMIN');
      await captureEvidence('Paso 1: ADMIN inicia sesion correctamente');
      await page.goto('/admin/students');
      const form = page.getByRole('heading', { name: 'Nuevo estudiante' }).locator('xpath=ancestor::form[1]');
      await expect(page.getByRole('heading', { name: 'Estudiantes', exact: true })).toBeVisible();
      await captureEvidence('Paso 2: ADMIN accede al modulo Estudiantes', form);
      await form.getByLabel('Nombres').fill('Estudiante E2E');
      await form.getByLabel('Apellidos').fill('Demo');
      await form.locator('#student-course').click();
      await form.getByRole('option').first().getByRole('button').click();
      await captureEvidence('Paso 3: ADMIN completa los datos del nuevo estudiante', form);
      await form.getByRole('button', { name: 'Crear estudiante' }).click();
      await expect(page.getByText(/Estudiante creado.*Código de vinculación/)).toBeVisible();
      const registered = page.getByRole('heading', { name: 'Estudiantes registrados' }).locator('xpath=ancestor::section[1]');
      const createdStudent = registered.locator('article').filter({ hasText: 'Estudiante E2E Demo' }).first();
      await expect(createdStudent).toBeVisible();
      await createdStudent.getByRole('button').click();
      const codeMatch = (await createdStudent.innerText()).match(/C.digo:\s*([A-Z0-9-]+)/i);
      expect(codeMatch?.[1]).toBeTruthy();
      linkCode = codeMatch![1];
      await captureEvidence(`Paso 4: ADMIN crea el estudiante y almacena el codigo ${linkCode}`, createdStudent, { revealCodes: true });
      await captureEvidence(`Administrador: estudiante creado y código ${linkCode} almacenado`, createdStudent, { revealCodes: true });

      await login(page, 'APODERADO');
      await captureEvidence('Paso 5: APODERADO inicia sesion correctamente');
      await page.goto('/students/link');
      const linkStudentSection = page.getByRole('heading', { name: 'Vincular estudiante a cuenta' }).locator('xpath=ancestor::section[1]');
      await expect(linkStudentSection).toBeVisible();
      await captureEvidence('Paso 6: APODERADO accede al modulo de vinculacion mediante codigo', linkStudentSection);
      await page.getByLabel('Código de vinculación').fill(linkCode);
      await captureEvidence(`Paso 7: APODERADO ingresa el codigo ${linkCode}`, linkStudentSection, { revealCodes: true });
      await page.getByRole('button', { name: 'Vincular estudiante' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Vinculación exitosa' })).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard/);
      const linkedStudents = page.getByRole('heading', { name: 'Estudiantes vinculados' }).locator('xpath=ancestor::section[1]');
      await expect(linkedStudents.getByRole('heading', { name: 'Estudiante E2E Demo' })).toBeVisible();
      await captureEvidence('Paso 8: estudiante figura en los vinculos del APODERADO', linkedStudents);
      await captureEvidence('Apoderado Primario: estudiante creado por el administrador aparece en sus vínculos', linkedStudents);
    } finally {
      if (linkCode) await removeStudentByCode(linkCode);
    }
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
