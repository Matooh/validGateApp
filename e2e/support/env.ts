import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e.local'), quiet: true });

export type E2ERole = 'ADMIN' | 'PORTERIA' | 'DOCENTE' | 'APODERADO' | 'ESTUDIANTE';

export type E2ECredentials = {
  email: string;
  password: string;
};

const rolePrefixes: Record<E2ERole, string> = {
  ADMIN: 'E2E_ADMIN',
  PORTERIA: 'E2E_PORTERIA',
  DOCENTE: 'E2E_DOCENTE',
  APODERADO: 'E2E_APODERADO',
  ESTUDIANTE: 'E2E_ESTUDIANTE',
};

export function credentialsFor(role: E2ERole): E2ECredentials {
  const prefix = rolePrefixes[role];
  return {
    email: process.env[`${prefix}_EMAIL`]?.trim() ?? '',
    password: process.env[`${prefix}_PASSWORD`] ?? '',
  };
}

export function missingE2EVariables(): string[] {
  const required = [
    'E2E_SUPABASE_URL',
    'E2E_SUPABASE_SERVICE_ROLE_KEY',
    ...Object.values(rolePrefixes).flatMap((prefix) => [`${prefix}_EMAIL`, `${prefix}_PASSWORD`]),
  ];
  return required.filter((name) => !process.env[name]?.trim());
}

export function getE2EConfig() {
  const missing = missingE2EVariables();
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables E2E en .env.e2e.local: ${missing.join(', ')}. ` +
        'Copia .env.e2e.example y completa valores ficticios.',
    );
  }
  if (process.env.E2E_ALLOW_REMOTE_MUTATIONS !== 'true') {
    throw new Error(
      'E2E_ALLOW_REMOTE_MUTATIONS debe ser true para preparar el namespace E2E en la base de testing.',
    );
  }

  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!.trim();
  if (serviceRoleKey.startsWith('sb_publishable_')) {
    throw new Error(
      'E2E_SUPABASE_SERVICE_ROLE_KEY contiene una clave pública. ' +
        'Configura una clave secreta sb_secret_... o la clave JWT legacy con rol service_role.',
    );
  }

  if (!serviceRoleKey.startsWith('sb_secret_')) {
    try {
      const payloadPart = serviceRoleKey.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { role?: string };
      if (payload.role !== 'service_role') {
        throw new Error('La clave JWT no declara el rol service_role.');
      }
    } catch {
      throw new Error(
        'E2E_SUPABASE_SERVICE_ROLE_KEY no es una clave administrativa válida. ' +
          'Usa una clave sb_secret_... o la clave JWT legacy con rol service_role.',
      );
    }
  }

  const namespace = process.env.E2E_NAMESPACE?.trim() || 'validgate-e2e';
  if (!/^[a-z0-9][a-z0-9-]{2,30}$/.test(namespace)) {
    throw new Error('E2E_NAMESPACE debe usar solo minúsculas, números y guiones (3 a 31 caracteres).');
  }

  const emailMarker = process.env.E2E_EMAIL_MARKER?.trim().toLowerCase() || 'e2e';
  const roles = Object.keys(rolePrefixes) as E2ERole[];
  for (const role of roles) {
    const { email } = credentialsFor(role);
    if (!email.toLowerCase().includes(emailMarker)) {
      throw new Error(`${role}: el correo debe contener el marcador seguro “${emailMarker}”.`);
    }
  }

  if (process.env.E2E_START_LOCAL_SERVER === 'true') {
    const localEnvPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
      const localEnv = dotenv.parse(fs.readFileSync(localEnvPath));
      const localSupabaseUrl = localEnv.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
      const e2eSupabaseUrl = process.env.E2E_SUPABASE_URL!.replace(/\/$/, '');
      if (localSupabaseUrl && localSupabaseUrl !== e2eSupabaseUrl) {
        throw new Error(
          'La aplicación local y el preparador E2E apuntan a proyectos Supabase diferentes. Ejecución detenida.',
        );
      }
    }
  }

  return {
    namespace,
    emailMarker,
    supabaseUrl: process.env.E2E_SUPABASE_URL!,
    serviceRoleKey,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    environmentName: process.env.E2E_ENVIRONMENT_NAME ?? 'Supabase testing',
    buildId: process.env.E2E_BUILD_ID ?? 'ejecucion-local',
  };
}

export const E2E_ROLES = Object.keys(rolePrefixes) as E2ERole[];
