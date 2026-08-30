# Configuración local de VALIDGATE

Esta guía prepara el MVP para desarrollo local. Para ejecutar la validación automatizada consulta [la guía E2E](../reports/README.md); para la demostración académica consulta [DEMO_LOCAL.md](DEMO_LOCAL.md).

## 1. Requisitos

- Node.js compatible con Next.js 16.
- npm.
- Un proyecto Supabase.
- Las migraciones de `supabase/migrations/` aplicadas en orden, desde `001_init.sql` hasta `027_fix_confirm_guardian_pickup_request_id.sql`.

Las migraciones `017`–`027` son necesarias para retiro con PIN dual, vínculos temporales del Apoderado Secundario, salida excepcional, revocación y consumo de PIN.

## 2. Variables de entorno

Copia `.env.example` como `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-clave-publica
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=tu-clave-de-servicio
```

`SUPABASE_SERVICE_ROLE_KEY` se utiliza únicamente en el servidor para invitar Apoderados Secundarios. No debe llevar el prefijo `NEXT_PUBLIC_`, incluirse en capturas ni versionarse.

## 3. Instalación y ejecución

```powershell
npm install
npm run dev
```

La aplicación queda disponible normalmente en `http://localhost:3000`.

Para verificar una compilación de producción:

```powershell
npm run build
npm run start
```

## 4. Configuración de Supabase Auth

Para un entorno controlado de MVP puede desactivarse la confirmación obligatoria de correo. Las cuentas se crean desde la aplicación, Supabase Auth o la preparación E2E.

Los roles técnicos actuales son:

- `ADMIN`;
- `PORTERIA`;
- `DOCENTE`;
- `APODERADO`, mostrado como **Apoderado Primario**;
- `ESTUDIANTE`;
- `RETIRADOR_AUTORIZADO`, mostrado como **Apoderado Secundario**.

La terminología visible no cambia los enums ni las políticas RLS existentes.

## 5. Capacidades que requieren las migraciones completas

- autenticación y perfiles;
- vínculos por código y administración institucional;
- RUT y teléfono normalizados;
- QR temporal, opaco y de un solo uso;
- políticas institucionales de ingreso y salida;
- eventos aprobados, rechazados y excepcionales;
- solicitudes de salida de estudiantes;
- retiro de Apoderado Primario o Secundario con dos PIN distintos;
- vigencia, intentos, bloqueo, revocación y consumo de PIN;
- trazabilidad protegida por institución, rol y relación.

## 6. Rutas principales

| Ruta | Uso |
| --- | --- |
| `/` | Login. |
| `/register` | Registro. |
| `/dashboard` | Panel según rol y trazabilidad reciente. |
| `/guard` | Portería, QR, PIN, ingreso, salida y retiro. |
| `/authentications` | QR y PIN disponibles. |
| `/links` | Vínculos y autorizaciones secundarias. |
| `/students/link` | Vinculación mediante código. |
| `/admin/relationships` | Gestión consolidada de vínculos. |
| `/students/[id]` | Detalle del estudiante. |
| `/settings` | Perfil y políticas permitidas. |

## 7. Consideraciones de seguridad

- Usa un proyecto Supabase exclusivo para pruebas automatizadas.
- No compartas `.env.local` ni `.env.e2e.local`.
- Las restricciones deben mantenerse en interfaz, servidor y RLS.
- Los Apoderados Primarios y estudiantes solo ven relaciones propias.
- El personal institucional queda limitado a su institución.
- Los Apoderados Secundarios dependen del estudiante autorizado y de la vigencia.
- Dos docentes de la misma institución comparten alcance en el MVP; no existe relación docente–curso.

## 8. Capacidades fuera del alcance actual

- MFA operativo;
- notificaciones push o SMS;
- biometría;
- asignación profesor jefe/ayudante o docente–curso;
- analítica institucional avanzada;
- historial integral con filtros;
- integración obligatoria con dispositivos físicos.
