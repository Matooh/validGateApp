# ValidGate MVP

MVP rapido para tesis con **Next.js + Vercel + Supabase**.

Incluye:
- login y registro simple
- remember me en login
- mensajes de login genéricos para evitar enumeracion de usuarios
- configuración de perfil
- configuración ADMIN de política de ingreso/salida con autenticador QR/PIN obligatorio o flexible
- vinculación de estudiante por código
- vista del estudiante con estado dentro/fuera de la institución
- school timetable con colores de asistencia
- módulo de portería para registrar ingresos y salidas
- trazabilidad de eventos de acceso, incluyendo método, resultado, política aplicada y rechazos operativos

## 1) Crear el proyecto en Supabase

1. Crea un proyecto en Supabase.
2. En **Project Settings > Data API**, copia:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. En SQL Editor ejecuta primero:
   - `supabase/migrations/001_init.sql`
   - luego `supabase/migrations/002_seed.sql`
- y si quieres probar apoderado multi-institución, también `supabase/migrations/003_seed_multi_institution.sql`
- para la configuración de seguridad de ingreso/salida, ejecuta `supabase/migrations/005_access_control_policies.sql`
- para credenciales QR opacas, temporales y de uso único, ejecuta `supabase/migrations/006_student_qr_credentials.sql`
- para reforzar reglas de salida por QR, ejecuta `supabase/migrations/007_enforce_qr_exit_rules.sql`
- para vincular usuarios ESTUDIANTE con `students`, ejecuta `supabase/migrations/008_student_profiles.sql`
- para que estudiantes vean sus apoderados/responsables, ejecuta `supabase/migrations/009_student_guardian_visibility.sql`
- para agregar RUT y teléfono chileno a estudiantes/adultos, ejecuta `supabase/migrations/010_contact_identity_fields.sql`
- para normalizar tipos de apoderado/responsable, ejecuta `supabase/migrations/011_guardian_relation_types.sql`
- para solicitudes de autorización y salida directa de estudiante, ejecuta `supabase/migrations/012_authorization_requests.sql` hasta `supabase/migrations/015_student_self_exit.sql`

## 2) Crear la app local

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 3) Variables de entorno

Completa `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## 4) Configuración recomendada en Supabase Auth

Para salir rapido con el MVP:
- desactiva temporalmente la confirmación obligatoria de email
- crea usuarios desde la propia app o desde **Authentication > Users**

## 5) Asignar roles e institución a usuarios ya creados

Después de registrar usuarios, ejecuta algo como esto en SQL Editor:

```sql
update public.profiles
set institution_id = 1,
    role = 'PORTERIA',
    first_name = 'Admin',
    last_name = 'Portería'
where email = 'admin@validgate.app';

update public.profiles
set institution_id = 1,
    role = 'APODERADO',
    first_name = 'Paula',
    last_name = 'Rojas'
where email = 'apoderado@validgate.app';

insert into public.guardian_students (guardian_profile_id, student_id, relation_type)
select id, 1, 'MADRE'
from public.profiles
where email = 'apoderado@validgate.app'
on conflict (guardian_profile_id, student_id) do nothing;
```

## 6) Datos demo incluidos

El seed base deja:
- institución demo con id `1`
- curso `Primero Básico A`
- estudiante `Lucas Perez` con código `VG-LUCAS`
- estudiante `Sofia Mora` con código `VG-SOFIA`
- bloques de horario y asistencia demo

El seed opcional `003_seed_multi_institution.sql` agrega:
- segunda institución `Colegio Valle Norte`
- curso `Segundo Básico B`
- estudiante `Martina Diaz` con código `VG-MARTINA`

Con eso, un apoderado puede vincular estudiantes de más de una institución y el dashboard mostrará los nombres reales de todas las instituciones asociadas.

## 7) Despliegue en Vercel

La via más rápida:
1. Sube este proyecto a GitHub.
2. En Vercel, crea **New Project**.
3. Conecta el repo.
4. Agrega las mismas variables de entorno.
5. Deploy.

Cada push a GitHub generará un deployment automáticamente.

## 8) Rutas principales

- `/` login
- `/register` registro
- `/dashboard` panel principal
- `/students/link` vincular estudiante
- `/students/[id]` detalle del estudiante
- `/settings` configuración de perfil
- `/guard` módulo de portería
- `/authentications` credenciales QR de estudiantes vinculados

## 9) Notas prácticas

- El modelo fue adaptado para Supabase usando `auth.users` + `public.profiles`.
- El trigger `handle_new_user` crea el perfil automáticamente.
- El trigger `apply_access_event` actualiza `students.is_in_institution` al registrar ingresos/salidas aprobados.
- La asistencia por bloque se muestra con colores desde `attendance_blocks`.
- La tabla `institution_access_policies` permite configurar si ingreso y salida requieren autenticador, y si esa regla es excluyente.
- Si una regla operativa falla, el evento queda auditado como `RECHAZADO` sin cambiar el estado dentro/fuera del estudiante.
- La tabla `student_qr_credentials` guarda credenciales QR opacas con expiración, revocación y uso único.
- El QR solo contiene `validgate-auth:{uuid}`. Los datos del estudiante se consultan en servidor al validar desde portería.
- La confirmación QR en portería bloquea salidas si el estudiante ya está fuera o si no tiene permiso para salir solo.
- La tabla `student_profiles` relaciona `profiles.id` con `students.id` para que el rol `ESTUDIANTE` genere solo su propia credencial QR.
- La migración `008_student_profiles.sql` vincula a `alan.estudiante@validgate.app` con el estudiante Alan de su institución cuando coinciden nombres y rol.
- La migración `009_student_guardian_visibility.sql` permite que un estudiante consulte sus apoderados mediante RPC sin abrir lectura amplia sobre `profiles`.
- La migración `010_contact_identity_fields.sql` agrega `rut` y `phone` opcionales. El RUT se normaliza con `rut.js` y el teléfono usa formato `+56979999999`.
- La migración `011_guardian_relation_types.sql` normaliza `guardian_students.relation_type` en `APODERADO_PRINCIPAL`, `APODERADO` y `RETIRADOR_AUTORIZADO`.

## 10) Librerías preparadas para evolucionar el MVP

- QR dinámico: `qrcode` para generar códigos y `react-qr-code` para renderizarlos en la credencial del estudiante.
- Escaneo QR en portería: `html5-qrcode` para lectura con cámara desde navegador.
- Tokens seguros y uso único: `jose` para firmar/verificar tokens y `uuid` para `jti`, eventos y auditoria.
- PIN temporal: `uuid`, `zod` y reglas server-side para vencimiento, intentos y bloqueo.
- Formularios de autorización y configuración: `zod`, `react-hook-form` y `@hookform/resolvers`.
- Notificaciones al apoderado y feedback operativo: `sonner`.
- MFA ADMIN/PORTERIA: se usará `@supabase/supabase-js`, ya incluido, mediante `supabase.auth.mfa`.
- Dashboard por institución: se apoya en Supabase/RLS y en las tablas existentes de institución, estudiantes y eventos.

## 11) Siguiente mejora recomendada

Cuando este MVP ya corra:
- integrar lector de cámara real con `html5-qrcode`
- implementar PIN temporal real con vencimiento y limite de intentos
- implementar autorizaciones temporales
- implementar dashboard por institución
- implementar notificaciones al apoderado
- implementar MFA de Supabase para ADMIN y PORTERIA
