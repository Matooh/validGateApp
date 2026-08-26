import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e.local'), quiet: true });

// El servidor Next iniciado por la suite necesita la misma clave administrativa
// exclusivamente para probar el alta/invitación de un retirador en el ambiente E2E.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const startLocalServer = process.env.E2E_START_LOCAL_SERVER === 'true';
if (startLocalServer) process.env.VALIDGATE_E2E_BYPASS_EMAIL_DELIVERY = 'true';
const startedAt = new Date();
const generatedReportRunId = [
  startedAt.getFullYear(),
  String(startedAt.getMonth() + 1).padStart(2, '0'),
  String(startedAt.getDate()).padStart(2, '0'),
  '-',
  String(startedAt.getHours()).padStart(2, '0'),
  String(startedAt.getMinutes()).padStart(2, '0'),
].join('');
const reportRunId = process.env.E2E_REPORT_RUN_ID ?? generatedReportRunId;
const reportDir = path.join('reports', reportRunId);

// El reportero personalizado se carga después de esta configuración. La variable
// permite que use exactamente la misma carpeta que los reporteros de Playwright.
process.env.E2E_REPORT_DIR = reportDir;
process.env.E2E_REPORT_RUN_ID = reportRunId;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: path.join(reportDir, 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(reportDir, 'playwright-html'), open: 'never', title: 'VALIDGATE — Pruebas funcionales E2E' }],
    ['json', { outputFile: path.join(reportDir, 'playwright-results.json') }],
    ['junit', { outputFile: path.join(reportDir, 'playwright-results.xml'), stripANSIControlSequences: true }],
    ['./e2e/reporters/pdf-reporter.ts'],
  ],
  use: {
    baseURL,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: startLocalServer
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
