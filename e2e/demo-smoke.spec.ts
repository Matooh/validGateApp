import { expect, test } from '@playwright/test';

test('DEMO-SMOKE-001 — disponibilidad, protección y login de administrador', async ({ page }) => {
  const credentials = {
    email: process.env.DEMO_ADMIN_EMAIL?.trim() ?? '',
    password: process.env.DEMO_ADMIN_PASSWORD ?? '',
  };
  expect(credentials.email, 'Falta DEMO_ADMIN_EMAIL en .env.e2e.local').not.toBe('');
  expect(credentials.password, 'Falta DEMO_ADMIN_PASSWORD en .env.e2e.local').not.toBe('');

  await test.step('La portada carga sin errores del servidor', async () => {
    const response = await page.goto('/');
    expect(response, 'La portada no entregó una respuesta HTTP').not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    await expect(page.getByText('ValidGateApp', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  await test.step('Una ruta protegida redirige al login sin sesión', async () => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  await test.step('Supabase Auth permite iniciar sesión y cargar el dashboard', async () => {
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('dashboard-role-eyebrow')).toHaveText('Administración');
  });
});
