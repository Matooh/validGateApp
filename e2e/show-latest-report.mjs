import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const reportsDir = path.resolve(process.cwd(), 'reports');
const entries = await readdir(reportsDir, { withFileTypes: true });
const latestRun = entries
  .filter((entry) => entry.isDirectory() && /^\d{8}-\d{4}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort()
  .at(-1);

if (!latestRun) {
  throw new Error('No hay ejecuciones E2E con formato YYYYMMDD-HHMM en reports/.');
}

const reportDir = path.join(reportsDir, latestRun, 'playwright-html');
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['playwright', 'show-report', reportDir], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  throw error;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
