import { expect, type Page } from '@playwright/test';

import { credentialsFor, type E2ERole } from './env';

export async function login(page: Page, role: E2ERole) {
  const credentials = credentialsFor(role);
  await loginWithCredentials(page, credentials.email, credentials.password, role);
}

export async function loginWithCredentials(page: Page, email: string, password: string, expectedRole?: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  if (expectedRole) await expect(page.getByText(expectedRole, { exact: true }).first()).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /cerrar sesión/i }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function selectStudentInGuard(page: Page, name: string) {
  await page.getByLabel('Buscador de estudiante').fill(name);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByLabel(/^Estudiante/)).toHaveValue(/\d+/);
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
  const card = page.locator('article').filter({ hasText: 'Estudiante E2E Dentro' }).first();
  await card.getByRole('button', { name: 'Notificar retiro' }).click();
  await expect(page.getByText('Solicitud de retiro enviada al estudiante.')).toBeVisible();
}

export async function acceptPickupAsStudent(page: Page) {
  await login(page, 'ESTUDIANTE');
  const request = page.locator('article').filter({ hasText: /está esperando por ti/i }).first();
  await request.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText(/Los PIN estarán vigentes durante cinco minutos/)).toBeVisible();
}
