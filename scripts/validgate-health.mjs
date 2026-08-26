import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function loadEnv(filename) {
  const filepath = path.join(root, filename);
  if (!fs.existsSync(filepath)) throw new Error(`No existe ${filename}.`);
  return dotenv.parse(fs.readFileSync(filepath));
}

function requireNames(values, names, filename) {
  const missing = names.filter((name) => !values[name]?.trim());
  if (missing.length) throw new Error(`Faltan variables en ${filename}: ${missing.join(', ')}.`);
  for (const name of names) console.log(`[OK] ${name}`);
}

function appConfig() {
  const env = loadEnv('.env.local');
  requireNames(env, ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'], '.env.local');
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no contiene una URL válida.');
  }
  if (url.protocol !== 'https:') throw new Error('Supabase Cloud debe utilizar HTTPS.');
  return { env, url: url.toString().replace(/\/$/, ''), key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

async function health() {
  const { url, key } = appConfig();
  const checks = [
    ['Auth', '/auth/v1/health'],
    ['PostgREST', '/rest/v1/institutions?select=id&limit=0'],
  ];
  for (const [name, endpoint] of checks) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url + endpoint, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${name} respondió HTTP ${response.status}.`);
      console.log(`[OK] ${name} disponible`);
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`${name} excedió el timeout de 10 segundos.`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') reject(new Error(`El puerto ${port} está ocupado.`));
      else reject(error);
    });
    // Sin host explícito, Node comprueba el endpoint dual-stack que Next.js usa
    // por defecto en Windows (:::puerto), evitando falsos libres en IPv4.
    server.listen({ port }, () => server.close(resolve));
  });
  console.log(`[OK] Puerto ${port} disponible`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'env') {
    const { env } = appConfig();
    if (env.NEXT_PUBLIC_SITE_URL?.trim()) console.log('[OK] NEXT_PUBLIC_SITE_URL');
    else console.log('[WARN] NEXT_PUBLIC_SITE_URL no configurada; se usará el fallback localhost para invitaciones.');
    if (env.SUPABASE_SERVICE_ROLE_KEY?.trim()) console.log('[OK] SUPABASE_SERVICE_ROLE_KEY (opcional)');
    else console.log('[WARN] SUPABASE_SERVICE_ROLE_KEY no configurada; las invitaciones por correo no estarán disponibles.');
    if (args.includes('--demo')) {
      const demo = loadEnv('.env.e2e.local');
      requireNames(demo, ['DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD'], '.env.e2e.local');
    }
    return;
  }
  if (command === 'supabase') return health();
  if (command === 'port-free') {
    const port = Number(args[0]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido.');
    return assertPortFree(port);
  }
  throw new Error('Uso: validgate-health.mjs env [--demo] | supabase | port-free <puerto>');
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
