# ValidGate MVP

MVP rapido para tesis con **Next.js + Vercel + Supabase**.

Incluye:
- login y registro simple
- remember me en login
- configuracion de perfil
- vinculacion de estudiante por codigo
- vista del estudiante con estado dentro/fuera de la institucion
- school timetable con colores de asistencia
- modulo de porteria para registrar ingresos y salidas
- trazabilidad de eventos de acceso

## 1) Crear el proyecto en Supabase

1. Crea un proyecto en Supabase.
2. En **Project Settings > Data API**, copia:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. En SQL Editor ejecuta primero:
   - `supabase/migrations/001_init.sql`
   - luego `supabase/migrations/002_seed.sql`
   - y si quieres probar apoderado multi-institucion, tambien `supabase/migrations/003_seed_multi_institution.sql`

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

## 9) Notas practicas

- El modelo fue adaptado para Supabase usando `auth.users` + `public.profiles`.
- El trigger `handle_new_user` crea el perfil automaticamente.
- El trigger `apply_access_event` actualiza `students.is_in_institution` al registrar ingresos/salidas aprobados.
- La asistencia por bloque se muestra con colores desde `attendance_blocks`.

## 10) Siguiente mejora recomendada

Cuando este MVP ya corra:
- agregar QR dinamico
- agregar autorizaciones temporales
- agregar dashboard por institucion
- agregar notificaciones al apoderado
- agregar validacion facial como modulo futuro
