# ValidGate MVP

MVP rapido para tesis con **Next.js + Vercel + Supabase**.

Incluye:
- login y registro simple
- remember me en login
- mensajes de login genericos para evitar enumeracion de usuarios
- configuracion de perfil
- configuracion ADMIN de politica de ingreso/salida con autenticador QR/PIN obligatorio o flexible
- vinculacion de estudiante por codigo
- vista del estudiante con estado dentro/fuera de la institucion
- school timetable con colores de asistencia
- modulo de porteria para registrar ingresos y salidas
- trazabilidad de eventos de acceso, incluyendo metodo, resultado, politica aplicada y rechazos operativos

## 1) Crear el proyecto en Supabase

1. Crea un proyecto en Supabase.
2. En **Project Settings > Data API**, copia:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. En SQL Editor ejecuta primero:
   - `supabase/migrations/001_init.sql`
   - luego `supabase/migrations/002_seed.sql`
- y si quieres probar apoderado multi-institucion, tambien `supabase/migrations/003_seed_multi_institution.sql`
- para la configuracion de seguridad de ingreso/salida, ejecuta `supabase/migrations/005_access_control_policies.sql`
- para credenciales QR opacas, temporales y de uso unico, ejecuta `supabase/migrations/006_student_qr_credentials.sql`
- para reforzar reglas de salida por QR, ejecuta `supabase/migrations/007_enforce_qr_exit_rules.sql`
- para vincular usuarios ESTUDIANTE con `students`, ejecuta `supabase/migrations/008_student_profiles.sql`
- para que estudiantes vean sus apoderados/responsables, ejecuta `supabase/migrations/009_student_guardian_visibility.sql`
- para agregar RUT y telefono chileno a estudiantes/adultos, ejecuta `supabase/migrations/010_contact_identity_fields.sql`
- para normalizar tipos de apoderado/responsable, ejecuta `supabase/migrations/011_guardian_relation_types.sql`
- para solicitudes de autorizacion y salida directa de estudiante, ejecuta `supabase/migrations/012_authorization_requests.sql` hasta `supabase/migrations/015_student_self_exit.sql`

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

## 4) Configuracion recomendada en Supabase Auth

Para salir rapido con el MVP:
- desactiva temporalmente la confirmacion obligatoria de email
- crea usuarios desde la propia app o desde **Authentication > Users**

## 5) Asignar roles e institucion a usuarios ya creados

Despues de registrar usuarios, ejecuta algo como esto en SQL Editor:

```sql
update public.profiles
set institution_id = 1,
    role = 'PORTERIA',
    first_name = 'Admin',
    last_name = 'Porteria'
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
- institucion demo con id `1`
- curso `Primero Basico A`
- estudiante `Lucas Perez` con codigo `VG-LUCAS`
- estudiante `Sofia Mora` con codigo `VG-SOFIA`
- bloques de horario y asistencia demo

El seed opcional `003_seed_multi_institution.sql` agrega:
- segunda institucion `Colegio Valle Norte`
- curso `Segundo Basico B`
- estudiante `Martina Diaz` con codigo `VG-MARTINA`

Con eso, un apoderado puede vincular estudiantes de mas de una institucion y el dashboard mostrara los nombres reales de todas las instituciones asociadas.

## 7) Despliegue en Vercel

La via mas rapida:
1. Sube este proyecto a GitHub.
2. En Vercel, crea **New Project**.
3. Conecta el repo.
4. Agrega las mismas variables de entorno.
5. Deploy.

Cada push a GitHub generara un deployment automaticamente.

## 8) Rutas principales

- `/` login
- `/register` registro
- `/dashboard` panel principal
- `/students/link` vincular estudiante
- `/students/[id]` detalle del estudiante
- `/settings` configuracion de perfil
- `/guard` modulo de porteria
- `/authentications` credenciales QR de estudiantes vinculados

## 9) Notas practicas

- El modelo fue adaptado para Supabase usando `auth.users` + `public.profiles`.
- El trigger `handle_new_user` crea el perfil automaticamente.
- El trigger `apply_access_event` actualiza `students.is_in_institution` al registrar ingresos/salidas aprobados.
- La asistencia por bloque se muestra con colores desde `attendance_blocks`.
- La tabla `institution_access_policies` permite configurar si ingreso y salida requieren autenticador, y si esa regla es excluyente.
- Si una regla operativa falla, el evento queda auditado como `RECHAZADO` sin cambiar el estado dentro/fuera del estudiante.
- La tabla `student_qr_credentials` guarda credenciales QR opacas con expiracion, revocacion y uso unico.
- El QR solo contiene `validgate-auth:{uuid}`. Los datos del estudiante se consultan en servidor al validar desde porteria.
- La confirmacion QR en porteria bloquea salidas si el estudiante ya esta fuera o si no tiene permiso para salir solo.
- La tabla `student_profiles` relaciona `profiles.id` con `students.id` para que el rol `ESTUDIANTE` genere solo su propia credencial QR.
- La migracion `008_student_profiles.sql` vincula a `alan.estudiante@validgate.app` con el estudiante Alan de su institucion cuando coinciden nombres y rol.
- La migracion `009_student_guardian_visibility.sql` permite que un estudiante consulte sus apoderados mediante RPC sin abrir lectura amplia sobre `profiles`.
- La migracion `010_contact_identity_fields.sql` agrega `rut` y `phone` opcionales. El RUT se normaliza con `rut.js` y el telefono usa formato `+56979999999`.
- La migracion `011_guardian_relation_types.sql` normaliza `guardian_students.relation_type` en `APODERADO_PRINCIPAL`, `APODERADO` y `RETIRADOR_AUTORIZADO`.

## 10) Librerias preparadas para evolucionar el MVP

- QR dinamico: `qrcode` para generar codigos y `react-qr-code` para renderizarlos en la credencial del estudiante.
- Escaneo QR en porteria: `html5-qrcode` para lectura con camara desde navegador.
- Tokens seguros y uso unico: `jose` para firmar/verificar tokens y `uuid` para `jti`, eventos y auditoria.
- PIN temporal: `uuid`, `zod` y reglas server-side para vencimiento, intentos y bloqueo.
- Formularios de autorizacion y configuracion: `zod`, `react-hook-form` y `@hookform/resolvers`.
- Notificaciones al apoderado y feedback operativo: `sonner`.
- MFA ADMIN/PORTERIA: se usara `@supabase/supabase-js`, ya incluido, mediante `supabase.auth.mfa`.
- Dashboard por institucion: se apoya en Supabase/RLS y en las tablas existentes de institucion, estudiantes y eventos.

## 11) Siguiente mejora recomendada

Cuando este MVP ya corra:
- integrar lector de camara real con `html5-qrcode`
- implementar PIN temporal real con vencimiento y limite de intentos
- implementar autorizaciones temporales
- implementar dashboard por institucion
- implementar notificaciones al apoderado
- implementar MFA de Supabase para ADMIN y PORTERIA