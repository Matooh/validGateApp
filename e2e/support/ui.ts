import { expect, type Page } from '@playwright/test';

import { credentialsFor, getE2EConfig, type E2ERole } from './env';

export async function login(page: Page, role: E2ERole) {
  const credentials = credentialsFor(role);
  await loginWithCredentials(page, credentials.email, credentials.password);
}

export async function loginWithCredentials(page: Page, email: string, password: string, expectedRole?: string) {
  await page.goto('/');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  if (expectedRole) await expect(page.getByText(expectedRole, { exact: true }).first()).toBeVisible();
}

async function logoutLegacy(page: Page) {
  await page.getByRole('button', { name: /cerrar sesión/i }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /abrir/i }).first().click();
  await page.getByRole('button', { name: /logout/i, exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function selectStudentInGuard(page: Page, name: string) {
  await page.getByLabel('Nombre Estudiante').fill(name);
  await page.getByRole('option').filter({ hasText: name }).first().getByRole('button').click();
  await expect(page.locator('#guard-student-picker')).toHaveValue(new RegExp(`^${name}`));
}

export async function fillManualAccessForm(
  page: Page,
  options: { exitKind?: 'REGULAR' | 'RETIRO_AUTORIZADO' | 'SOLO' | 'EXCEPCIONAL'; result?: 'APROBADO' | 'RECHAZADO' } = {},
) {
  await page.getByLabel(/Método de validación/).selectOption('MANUAL');
  await page.getByLabel(/Motivo de contingencia/).selectOption('SIN_DISPOSITIVO');
  await page.getByLabel(/Resultado/).selectOption(options.result ?? 'APROBADO');
  if (options.exitKind) await page.getByLabel(/Tipo salida/).selectOption(options.exitKind);
  await page.getByLabel(/Descripción del evento/).fill('Contingencia controlada para prueba E2E');
}

export async function createPickupRequest(page: Page) {
  await login(page, 'APODERADO');
  const linkedStudents = page.getByRole('heading', { name: 'Estudiantes vinculados' }).locator('xpath=ancestor::section[1]');
  const card = linkedStudents.locator('article')
    .filter({ hasText: 'Estudiante E2E Dentro' })
    .filter({ hasText: `VALIDGATE E2E ${getE2EConfig().namespace}` })
    .first();
  await expect(card.getByRole('button', { name: 'Notificar retiro' })).toBeEnabled();
  await card.getByRole('button', { name: 'Notificar retiro' }).click();
  await expect(page.getByText('Solicitud de retiro enviada al estudiante.')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Retiro en curso' })).toBeDisabled();
}

export async function acceptPickupAsStudent(page: Page) {
  await login(page, 'ESTUDIANTE');
  const request = page.locator('article').filter({ hasText: /está esperando por ti/i }).first();
  await request.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText(/Los PIN estarán vigentes durante cinco minutos/)).toBeVisible();
}
