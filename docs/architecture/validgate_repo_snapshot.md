# Snapshot técnico y funcional de VALIDGATE

Fecha de inspección: 2026-07-19
Base de evidencia: repositorio local; no se consultó ni alteró una instancia de Supabase.
Regla de lectura: código, migraciones y configuración prevalecen sobre documentación.

## 1. Resumen ejecutivo

VALIDGATE es un MVP web para autenticar usuarios por rol, vincular apoderados con estudiantes, consultar estado/horario/trazabilidad y registrar ingresos, salidas y retiros.
El stack bloqueado es Next.js 16.2.6, React 19.2.5, TypeScript 6.0.2, Tailwind CSS 4.2.2 y Supabase JS 2.102.1.
La solución es un monolito modular serverless: App Router, Server Components, componentes cliente, Server Actions, un Route Handler y PostgreSQL/Supabase.
Existen cinco roles: `ADMIN`, `PORTERIA`, `DOCENTE`, `APODERADO` y `ESTUDIANTE`.
Hay flujos operativos de evento manual, QR opaco temporal y de uso único, solicitud/aprobación de salida y salida autónoma.
Las 15 tablas y reglas de seguridad se definen en 15 migraciones; la existencia en una base desplegada es **No verificado en el repositorio**.
RLS, triggers y RPC concentran reglas críticas, incluida la serialización de confirmaciones QR mediante bloqueos `FOR UPDATE`.
El avance es funcional pero parcial: no hay CRUD completo de estudiantes, cursos, usuarios ni personas autorizadas.
PIN, MFA, biometría, notificaciones externas y lector de cámara están documentados o presentados en UI, pero no son flujos implementados.
La entidad `authorized_people` existe, pero el retiro actual por QR no valida la identidad de esa persona.
La aprobación de solicitud y creación de autorización usa dos escrituras no transaccionales.
No hay suite automatizada ejecutable; solo un plan Gherkin documental de login.
Vercel está documentado como destino, sin archivo de infraestructura ni evidencia de despliegue.

## 2. Evidencia inspeccionada

| Elemento | Ruta | Estado | Observación |
|---|---|---|---|
| Dependencias | `package.json`, `package-lock.json` | Encontrado | El lock fija versiones; contiene JSON no parseable por PowerShell, pero sus entradas se leen como texto. |
| Next/TypeScript/Tailwind | `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` | Encontrado | App Router, modo estricto y Tailwind vía PostCSS. |
| Variables de entorno | `.env.example` | Encontrado | Solo se inspeccionaron nombres: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. |
| Aplicación | `src/app/` | Encontrado | 8 páginas/rutas principales, 5 archivos de Server Actions y un Route Handler. |
| UI | `src/components/` | Encontrado | Componentes cliente y de presentación. |
| Seguridad/apoyo | `src/lib/`, `src/middleware.ts` | Encontrado | Sesión, permisos, clientes Supabase, mensajes y validadores RUT/teléfono. |
| Base de datos | `supabase/migrations/001_init.sql` a `015_student_self_exit.sql` | Encontrado | 15 tablas declaradas, 10 enums, 5 triggers y RPC. |
| Tipos generados de Supabase | — | No encontrado | No hay `database.types.ts` ni equivalente. |
| Tests ejecutables | `tests/`, `e2e/`, `playwright.config.*` | No encontrado | No hay Playwright instalado ni configuración. |
| Plan de pruebas | `docs/test-plan.feature` | Parcial | Dos escenarios de login, sin step definitions ni runner. |
| Documentación vigente | `README.md`, `docs/validgate_sistema_actual.md` | Encontrado | Útil, pero contiene afirmaciones más amplias que el código. |
| Despliegue | `docs/CONFIGURACION_LOCAL.md` | Parcial | Procedimiento manual para Vercel; despliegue real no verificable. |
| CSV de esquema | — | No encontrado | No fue posible comparar CSV con migraciones. |

## 3. Estructura relevante del repositorio

```text
.
├── src/
│   ├── app/
│   │   ├── actions/{access,auth,authorization-requests,qr-credentials,students}.ts
│   │   ├── auth/callback/route.ts
│   │   ├── authentications/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── guard/page.tsx
│   │   ├── register/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── students/[id]/page.tsx
│   │   └── students/link/page.tsx
│   ├── components/
│   │   ├── authentication-qr-card.tsx
│   │   ├── qr-credential-validator.tsx
│   │   ├── record-access-form.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/{client,middleware,server}.ts
│   │   ├── students/get-current-student.ts
│   │   ├── auth.ts
│   │   ├── permissions.ts
│   │   └── types.ts
│   └── middleware.ts
├── supabase/migrations/001_init.sql ... 015_student_self_exit.sql
├── docs/
│   ├── CONFIGURACION_LOCAL.md
│   ├── test-plan.feature
│   ├── validgate_sistema_actual.md
│   └── validgate-context/*.md
├── package.json
├── package-lock.json
├── next.config.ts
└── tsconfig.json
```

## 4. Stack tecnológico verificado

| Tecnología | Versión | Propósito | Evidencia |
|---|---:|---|---|
| Next.js | 16.2.6 | Web, App Router, Server Actions/Components | `package-lock.json`, `src/app/` |
| React / React DOM | 19.2.5 | UI | `package-lock.json` |
| TypeScript | 6.0.2 | Tipado estricto | `package-lock.json`, `tsconfig.json` |
| Tailwind CSS | 4.2.2 | Estilos | `package-lock.json`, `postcss.config.mjs` |
| Supabase SSR | 0.10.0 | Clientes SSR/cookies | `package-lock.json`, `src/lib/supabase/` |
| Supabase JS | 2.102.1 | Auth, Data API y RPC | `package-lock.json` |
| PostgreSQL | No fijada | Persistencia, RLS, triggers/RPC | `supabase/migrations/` |
| Zod | 4.4.3 | Dependencia prevista | `package-lock.json`; sin importaciones en `src/` |
| html5-qrcode | 2.3.8 | Dependencia prevista para cámara | `package-lock.json`; sin importaciones en `src/` |
| react-qr-code | 2.0.21 | Render de QR | `authentication-qr-card.tsx` |
| React Hook Form | 7.76.0 | Dependencia prevista | Sin uso verificado en `src/` |
| Vercel | Servicio, sin versión | Destino documentado | `CONFIGURACION_LOCAL.md`; despliegue no verificado |
| Playwright | — | Pruebas E2E | No encontrado |

## 5. Arquitectura general detectada

Es una combinación cliente-servidor y serverless, implementada como monolito modular orientado a funcionalidades. Las páginas son Server Components salvo los componentes con `'use client'`. Los formularios invocan Server Actions; `/auth/callback` es el único Route Handler. No existe una capa formal de repositorios/servicios: páginas y acciones acceden directamente a Supabase.

```text
Actor humano
→ Navegador (React / componentes cliente)
→ Next.js App Router (Server Components)
→ Server Action o Route Handler
→ cliente Supabase SSR
→ Supabase Auth / Data API / RPC
→ PostgreSQL + RLS + triggers
```

- Middleware: renueva/valida sesión y protege toda ruta salvo `/`, `/register`, `/auth/callback`.
- Validación frontend: campos HTML y reglas UX en formularios.
- Validación servidor: comprobaciones manuales en Server Actions; Zod no se usa.
- Reglas atómicas: RPC `confirm_student_qr_access_event` y `confirm_student_self_exit`.
- Servicios externos: Supabase es verificable; Vercel solo está documentado.
- Storage: **No verificado en el repositorio**.

## 6. Actores y roles del sistema

| Actor o rol | Evidencia en código | Acciones permitidas | Restricciones | Estado |
|---|---|---|---|---|
| Administrador | `AppRole`, `permissions.ts`, RLS | Dashboard, porterías, QR, editar estudiante, política institucional | Misma institución; administración CRUD amplia no existe | Rol autenticado, parcial |
| Porterías | mismas fuentes, `guard/page.tsx` | Buscar, validar QR, registrar ingreso/salida/retiro, ver eventos | Misma institución | Rol autenticado, implementado |
| Docente | enum/permisos/RLS | Dashboard, estudiantes/cursos/asistencia | Sin módulo propio; `requireStaff` lo admite, pero `view_guard_module` lo bloquea | Rol autenticado, parcial |
| Apoderado | RLS, dashboard, acciones de autorización | Vincular/desvincular, ver eventos, generar QR, responder solicitudes | Solo vínculos propios | Rol autenticado, implementado |
| Estudiante | `student_profiles`, dashboard, RPC salida | Ver estado/horario/vínculos, QR, solicitar/confirmar salida | Un perfil por estudiante; no autoriza su propio retiro | Rol autenticado, implementado |
| Persona autorizada | `authorized_people`, `authorizations` | Se modela como retirador | No inicia sesión ni existe UI propia | Entidad/actor físico, no usuario |
| Supabase | clientes y migraciones | Auth, persistencia, RPC/RLS | Servicio externo | Servicio externo |

## 7. Requerimientos funcionales observables

| ID | Funcionalidad | Ruta o archivo | Evidencia | Estado |
|---|---|---|---|---|
| RF-OBS-01 | Autenticación email/password, registro y logout | `actions/auth.ts` | APIs Supabase Auth | Implementada |
| RF-OBS-02 | Control por rol | `permissions.ts`, `auth.ts`, RLS | UI, acciones y base | Implementada, con inconsistencias puntuales |
| RF-OBS-03 | Gestión de estudiantes | `students/[id]`, `updateStudentAction` | Consulta/edición parcial | Parcialmente implementada |
| RF-OBS-04 | Gestión de cursos | `guard`, `students/[id]` | Solo consulta | Parcialmente implementada |
| RF-OBS-05 | Vinculación estudiante-apoderado | `linkStudentByCodeAction`, `guardian_students` | RPC `link_student_by_code` es invocada | Parcialmente implementada; definición RPC no está en migraciones |
| RF-OBS-06 | Personas autorizadas | `authorized_people`, `authorizations` | Solo esquema/RLS select | Solo documentada/modelada |
| RF-OBS-07 | Ingreso/salida manual | `recordAccessEventAction` | Inserción auditable y trigger de estado | Implementada |
| RF-OBS-08 | Retiro | `QrCredentialValidator`, RPC QR | Mapea `RETIRO` a `SALIDA/RETIRO_AUTORIZADO` | Parcialmente implementada |
| RF-OBS-09 | Retiro anticipado | documentos/reason | No hay caso/UI específico | Solo documentada |
| RF-OBS-10 | Salida autónoma | acciones + `015_student_self_exit.sql` | RPC atómica con QR vigente | Implementada |
| RF-OBS-11 | QR temporal/opaco/uso único | acciones + tablas/RPC | UUID, expiración, usado/revocado | Implementada |
| RF-OBS-12 | PIN | UI y enum | Se puede etiquetar manualmente, sin credencial/validación PIN | Futura |
| RF-OBS-13 | Validación manual/contingencia | `access.ts`, `013_...sql` | La acción concatena notas, pero no llena las columnas de contingencia | Parcialmente implementada |
| RF-OBS-14 | Historial/trazabilidad | dashboards/guard, RLS | Últimos 8/10 eventos, sin filtros avanzados | Parcialmente implementada |
| RF-OBS-15 | Notificaciones | toast y cards | Solo feedback in-app; sin servicio/canal externo | Parcialmente implementada |
| RF-OBS-16 | Anulación | — | Sin campos, acción ni flujo | No encontrada |
| RF-OBS-17 | Observaciones | `access_events.notes` | Alta de nota; no edición posterior | Parcialmente implementada |
| RF-OBS-18 | Intentos fallidos | eventos manuales rechazados/logs | QR inválido no se persiste en tabla | Parcialmente implementada |

## 8. Casos de uso candidatos

### Administrador

- Configurar política de acceso — asociación; incluye `<<include>>` Autenticarse. `settings/page.tsx`, `updateAccessPolicyAction`. Implementado.
- Operar portería — asociación; incluye Validar sesión/rol. `guard/page.tsx`. Implementado.
- Actualizar datos/permisos de estudiante — asociación. `students/[id]`, `updateStudentAction`. Parcial.
- Gestionar usuarios, cursos y personas autorizadas — documentado, sin CRUD. No usar en diagrama “actual” salvo estereotipo de futuro.

### Portería

- Registrar ingreso/salida manual — asociación; `<<include>>` Seleccionar estudiante, Validar política, Registrar evento.
- Validar credencial QR — asociación; `<<include>>` Comprobar vigencia/uso/institución.
- Confirmar ingreso/salida/retiro por QR — asociación; especializaciones del registro de evento, no simples `include`.
- Registrar contingencia manual — `<<extend>>` Registrar evento, porque ocurre solo al faltar dispositivo.
- Consultar eventos recientes — asociación.

### Apoderado

- Vincular/desvincular estudiante — asociación; vincular incluye Validar código.
- Consultar estado e historial — asociación.
- Generar QR de estudiante vinculado — asociación.
- Aprobar/rechazar solicitud de salida — asociación; `<<extend>>` Aprobar crea autorización temporal.

### Estudiante

- Consultar estado, horario, responsables y eventos — asociación.
- Generar QR propio — asociación.
- Solicitar autorización de salida — asociación; incluye Verificar ingreso activo y apoderado vinculado.
- Registrar salida autónoma — asociación; incluye Verificar permiso, estado y QR vigente.

### Persona autorizada

- Presentarse para retiro es interacción física con porterías; la persona no usa la app. La validación de su identidad está **No verificado en el repositorio**.

## 9. Modelo de dominio para diagrama de clases

| Clase de dominio | Responsabilidad / atributos relevantes | Relaciones propuestas | Evidencia |
|---|---|---|---|
| Institution | Contexto multi-institución; id, name, type | 1 Institution–0..* Course/Student/Profile | `institutions` |
| UserProfile | Identidad de aplicación; role, names, email, rut, phone | 0..1 Institution; vínculos según rol | `profiles`, `AppRole` |
| Student | Alumno y estado; course, canLeaveAlone, isInInstitution | 1 Institution; 0..1 Course; 0..* eventos | `students` |
| Course | Agrupación académica | 1 Institution; 0..* Student/Schedule | `courses` |
| Guardian | Vista conceptual de UserProfile con rol APODERADO | 0..* Student mediante GuardianStudent | `profiles`, `guardian_students` |
| GuardianStudent | Tabla puente con relationType | 1 Guardian–1 Student por fila | `guardian_students` |
| AuthorizedPerson | Retirador; nombre, RUT/documento, teléfono, parentesco | 1 Institution; 0..* Authorization | `authorized_people` |
| Authorization | Autoriza persona para estudiante y vigencia | 1 Student, 1 AuthorizedPerson, 1 Guardian | `authorizations` |
| ExitPermission | Solicitud y autorización temporal de salida | Student/Guardian 1; autorización 0..1 por solicitud | `authorization_requests`, `student_exit_authorizations` |
| Schedule | Bloque de horario | 1 Course; 0..* AttendanceBlock | `schedule_blocks` |
| AccessEvent | Hecho auditable; tipo, método, resultado, fecha, nota | 1 Student; 0..1 actor/registrador/autorizado | `access_events` |
| Validation | Concepto embebido en AccessEvent/QR; no tabla propia | 1 evento–1 resultado/método | columnas + `student_qr_credentials` |
| Notification | Feedback local, sin agregado persistido | Sin relación persistente verificada | componentes toast/cards |

`StudentProfile` y `GuardianStudent` son tablas puente; los tipos en `src/lib/types.ts` son DTO/tipos TypeScript, no clases implementadas. Formularios y componentes UI no deben figurar como clases de dominio. No hay clases OO ni métodos de dominio implementados. “Validar credencial”, “registrar evento” y “aprobar salida” pueden anotarse como **Operación conceptual, no clase implementada en código**.

## 10. Modelo de datos real

| Tabla | Propósito | PK | FK / relaciones | Evidencia |
|---|---|---|---|---|
| institutions | Instituciones | id | raíz multi-tenant | `001_init.sql` |
| profiles | Perfil de `auth.users` | id UUID | institution_id | `001`, `010` |
| courses | Cursos | id | institution_id | `001` |
| students | Estudiantes/estado | id | institution_id, course_id | `001`, `010` |
| guardian_students | Vínculo apoderado-estudiante | id | profile, student; único compuesto | `001`, `011` |
| authorized_people | Personas físicas autorizadas | id | institution_id | `001`, `010` |
| authorizations | Autorización persona-estudiante | id | student, authorized_person, guardian | `001` |
| schedule_blocks | Horario por curso | id | course_id | `001` |
| attendance_blocks | Asistencia por bloque/fecha | id | student, block; único compuesto | `001` |
| access_events | Trazabilidad de acceso | id | student, actor, authorized person, recorder | `001`, `005`, `013` |
| institution_access_policies | Política por institución | institution_id | institución 1:1 | `005` |
| student_qr_credentials | QR temporal | UUID id | student, institution, auth user | `006` |
| student_profiles | Cuenta estudiante–registro | id | profile/student/institution; ambos vínculos únicos | `008` |
| authorization_requests | Solicitudes | UUID id | institution/student/guardian/requester | `012` |
| student_exit_authorizations | Permiso temporal consumible | UUID id | solicitud única, student, guardian | `012` |

Enums: `app_role`, `authorization_type`, `access_event_type`, `exit_type`, `validation_method`, `access_result`, `block_type`, `attendance_status`, `access_policy_failure`, `access_contingency_reason`.

Funciones/RPC efectivas: `handle_new_user`, `touch_updated_at`, `apply_access_event`, `current_user_role`, `current_user_institution_id`, `get_student_guardian_links`, `confirm_student_qr_access_event` y `confirm_student_self_exit`. La aplicación llama además `link_student_by_code`, pero su definición es **No verificado en el repositorio**. La cuenta textual de diez declaraciones incluye reemplazos de funciones en migraciones posteriores.

Triggers: creación automática de perfil; `updated_at` en perfiles/estudiantes/política; aplicación de evento a estado/asistencia. No hay vistas. RLS está habilitado en las 15 tablas y existen 41 declaraciones `CREATE POLICY` a lo largo del historial; varias reemplazan políticas homónimas, por lo que no equivalen necesariamente a 41 políticas finales simultáneas. Índices cubren QR, solicitudes/autorizaciones y RUT único. No hay soft delete; eventos no tienen anulación. `created_at` es generalizado; `updated_at` solo existe donde se declara. Estado real desplegado: **No verificado en el repositorio**.

## 11. Componentes de software candidatos

| Componente | Responsabilidad | Provee / requiere | Archivos |
|---|---|---|---|
| Aplicación Next.js | UI y composición server/client | Páginas; requiere Supabase | `src/app`, `components` |
| Autenticación | Login/registro/logout/perfil | Sesión; requiere Supabase Auth | `actions/auth.ts`, `lib/auth.ts` |
| Middleware de sesión | Renovar y proteger rutas | Cookie/session gate | `middleware.ts`, `lib/supabase/middleware.ts` |
| Dashboard por rol | Estado, vínculos, solicitudes, eventos | Consultas agregadas | `dashboard/page.tsx` |
| Portería | Evento manual y QR | Registro/consulta; requiere acciones/RPC | `guard/`, validadores/formulario |
| Autorizaciones | Solicitar, responder, consultar permiso | Server Actions; requiere tablas/RLS | `authorization-requests.ts` |
| Credenciales QR | Crear, validar, consumir | Server Actions/RPC | `qr-credentials.ts`, QR components |
| Gestión estudiante/asistencia | Vínculo y edición parcial | Acciones directas | `students.ts`, páginas student |
| Adaptadores Supabase | Clientes browser/server | Data API/Auth | `lib/supabase/` |
| PostgreSQL/RLS | Persistencia y autorización final | Tablas, policies, triggers | `supabase/migrations/` |
| Supabase Auth | Identidad/sesiones | Servicio externo | clientes y `auth.users` FK |
| Playwright | Pruebas E2E | No existe | **No verificado en el repositorio** |

## 12. Flujos técnicos para secuencia

### 12.1 Registro de ingreso

| Orden | Participante | Acción o mensaje | Archivo / función | Resultado |
|---:|---|---|---|---|
| 1 | Portería | Selecciona estudiante/curso y evento | `RecordAccessForm` | Payload |
| 2 | Server Action | Valida campos, sesión, rol e institución | `recordAccessEventAction` | Rechazo o continuidad |
| 3 | Supabase | Lee política y estudiantes | mismas función/tablas | Snapshot y estado |
| 4 | Server Action | Evalúa autenticador/ingreso duplicado | `resolvePolicyFailure` | aprobado/rechazado por alumno |
| 5 | Data API | Inserta `access_events` | `.insert(payload)` | Evento auditable |
| 6 | Trigger | Si aprobado, marca dentro y asistencia | `apply_access_event` | Estado actualizado |
| 7 | Next.js | Revalida guard/dashboard y redirige | `revalidatePath` | Feedback |

Alternativa QR: `QrCredentialValidator` → `validateStudentQrCredential` → `confirmStudentQrAccessEvent` → RPC con bloqueos → credencial usada + evento + trigger. No existe notificación externa.

### 12.2 Retiro por persona autorizada

| Orden | Participante | Acción o mensaje | Archivo / función | Resultado |
|---:|---|---|---|---|
| 1 | Portería | Pega/escanea payload | `QrCredentialValidator` | Validación solicitada |
| 2 | Action | Valida rol, formato, QR, institución, vigencia | `validateStudentQrCredential` | Datos mínimos o rechazo |
| 3 | Action | Busca permiso temporal si no sale solo | `getValidExitAuthorizationForStudent` | Permiso vigente/no |
| 4 | Portería | Confirma `RETIRO` | componente | RPC |
| 5 | RPC | Bloquea QR/estudiante/autorización y verifica estado | `confirm_student_qr_access_event` en `012` | rechazo o consumo |
| 6 | RPC | Inserta `SALIDA`, `RETIRO_AUTORIZADO`, `QR`, `APROBADO` | misma RPC | Trigger deja fuera |

Alternativas verificadas: QR no encontrado/vencido/usado/revocado; fuera del recinto; autorización temporal ausente; evento inválido; rol/institución prohibidos; concurrencia de consumo. “Estudiante no encontrado” se expresa como `QR_NOT_FOUND`. Horario no permitido y autorización excepcional: **No verificado en el repositorio**. La identidad/vigencia de `authorized_people` y la FK `access_events.authorized_person_id` no participan en este flujo; por tanto, “retiro por persona autorizada” está parcialmente implementado. Los rechazos QR no se insertan como `access_events`.

### 12.3 Salida autónoma

Flujo actual con permiso permanente: Estudiante → formulario dashboard → `confirmStudentSelfExitFromForm` → RPC `confirm_student_self_exit` → bloquea Student y QR → exige `is_in_institution`, `can_leave_alone` y QR vigente → consume QR → inserta `SALIDA/SOLO/QR/APROBADO` → trigger actualiza estado → revalida y redirige.

Flujo con aprobación: estudiante sin permiso crea `authorization_requests`; apoderado responde; si aprueba, la action crea `student_exit_authorizations`; portería puede consumirla mediante el flujo QR. Esto no convierte `can_leave_alone` en true y no habilita la RPC de auto-salida: requiere intervención de portería. La frase documental “salida autónoma con aprobación” debe modelarse como solicitud + aprobación + salida asistida por portería, salvo que se proponga un flujo futuro.

## 13. Participantes sugeridos

```text
Ingreso manual:
- PersonalPorteria
- GuardPage / RecordAccessForm
- recordAccessEventAction
- SupabaseServerClient
- institution_access_policies / students / access_events
- apply_access_event

Retiro QR:
- PersonaAutorizada (actor físico, sin sesión)
- PersonalPorteria
- QrCredentialValidator
- validateStudentQrCredential / confirmStudentQrAccessEvent
- confirm_student_qr_access_event
- student_qr_credentials / student_exit_authorizations / access_events

Salida autónoma:
- Estudiante
- DashboardPage
- confirmStudentSelfExitFromForm
- confirm_student_self_exit
- student_profiles / students / student_qr_credentials / access_events

Aprobación:
- Estudiante
- createStudentExitAuthorizationRequest
- Apoderado
- respondToAuthorizationRequest
- authorization_requests / student_exit_authorizations
```

## 14. Vista de procesos

Las acciones y consultas son síncronas desde la perspectiva del usuario, aunque usan promesas y transiciones React. Se revalidan rutas explícitamente. El refresco por expiración usa `setTimeout` cliente. No hay colas, jobs, webhooks ni realtime verificados.

Las RPC QR/self-exit usan transacción implícita de función y `FOR UPDATE`, dando protección contra doble consumo y carreras. El evento y el consumo quedan atómicos. El flujo manual lee estado y luego inserta sin bloqueo/RPC: dos operadores podrían aprobar eventos contradictorios. La aprobación de solicitud actualiza `authorization_requests` y después inserta autorización en dos llamadas; el `TODO` reconoce que debe ser transaccional. Hay guardas `.eq('status','PENDING')`, pero no se verifica el número de filas afectadas antes de crear la autorización. No se define clave de idempotencia para Server Actions; botones pendientes reducen doble clic, no sustituyen idempotencia.

## 15. Vista de desarrollo

```text
Páginas src/app
→ usan componentes src/components
→ invocan acciones src/app/actions
→ usan auth/permisos/tipos src/lib
→ acceden mediante src/lib/supabase
→ persisten en tablas/RPC de supabase/migrations
```

La separación es funcional, no estrictamente por capas. Hay buen aislamiento de clientes Supabase, permisos y mensajes QR/autorización, pero páginas grandes concentran consulta y presentación, y acciones mezclan validación, negocio y persistencia. `dashboard/page.tsx` y `record-access-form.tsx` tienen alto acoplamiento/volumen. No hay tipos generados del esquema: abundan snapshots manuales y casts. Mensajes de login/QR/autorización están parcialmente centralizados; muchos redirects conservan texto inline.

## 16. Vista física y despliegue

| Nodo o entorno | Artefacto | Tecnología/comunicación | Evidencia |
|---|---|---|---|
| Navegador admin/apoderado/estudiante | UI React | HTTPS a Next/Supabase mediante app | UI responsiva por rol |
| Dispositivo de porterías | UI guard | Navegador; payload pegado/escaneado | `guard`, sin API de cámara usada |
| Servidor Next.js | Build de app | Runtime serverless propuesto | Next; Vercel documentado |
| Supabase Auth | Identidad | HTTPS | clientes Auth |
| Supabase PostgreSQL/Data API | Datos/RPC/RLS | HTTPS/PostgREST/RPC | migraciones/clientes |
| Supabase Storage | — | — | **No verificado en el repositorio** |
| Vercel producción | App Next | Deploy desde GitHub propuesto | Solo documentación; no verificado |
| Local | `next dev` | Node + variables env | scripts/docs |
| Pruebas | — | — | Sin entorno automatizado |

Cámara/lector QR físico: no es nodo separado; sería capacidad del dispositivo de portería, pero el paquete de cámara no se usa.

## 17. Correspondencia con 4+1

| Vista 4+1 | Artefactos VALIDGATE | Evidencia | Pendientes |
|---|---|---|---|
| Lógica | Entidades, roles, reglas y relaciones | migraciones, tipos, acciones | Acordar clases conceptuales vs tablas |
| Procesos | Manual, QR, aprobación, auto-salida | actions/RPC/triggers | Retiro por persona y carreras manuales |
| Desarrollo | módulos Next, actions, Supabase adapters | `src/` | Reducir acoplamiento/tipos generados |
| Física | navegador, Next, Supabase, Vercel propuesto | config/docs | Evidencia real de despliegue |
| Escenarios +1 | ingreso, retiro, salida autónoma | UI/actions/SQL | Completar escenario de tercero |

4+1 define vistas arquitectónicas; no obliga a una lista fija única de cinco diagramas.

## 18. Seguridad y control de acceso

- Auth: Supabase email/password, OTP callback y sesiones cookie SSR.
- Login evita enumeración con mensaje genérico (`APP_MESSAGES`).
- Middleware protege rutas, pero es autenticación, no autorización por rol.
- Autorización: `requireUser`, `requireStaff`, `hasPermission` y RLS. La defensa final sensible está en RLS/RPC.
- Riesgo: `updateStudentAction` y `updateAttendanceStatusAction` no llaman explícitamente `requireUser/requireStaff`; dependen de middleware y RLS. `updateProfileAction` permite que cualquier usuario actualice solo su fila por RLS.
- Registro público crea perfiles APODERADO por defecto; política de habilitación/correo depende de Supabase y es **No verificado**.
- Entradas: validación manual; RUT/teléfono con librería/regex. Zod no se usa.
- QR: UUID opaco, 2 minutos, vigencia/uso/revocación/institución, bloqueo transaccional.
- Errores: login seguro; otros flujos registran detalles Supabase en `console.error`, potencialmente sensibles para logs internos.
- Sesiones: logout global y fallback de eliminación de cookies.
- Secretos: solo nombres de variables públicas detectados; valores no inspeccionados ni reportados.
- Auditoría de login fallido, MFA y rate limiting: **No verificado en el repositorio**.

## 19. Trazabilidad

`access_events` guarda estudiante, `actor_profile_id`, `recorded_by_profile_id`, persona autorizada opcional, tipo, tipo de salida, método, resultado, notas y `occurred_at`; también snapshot de política, fallo, autenticador requerido/presentado y columnas de contingencia. La acción manual actualmente expresa contingencia en `notes`, no en `access_mode`, `contingency_reason` y `contingency_note`, por lo que esas columnas quedan con valores por defecto/nulos.

Solicitud/autorización guarda solicitante, apoderado, estado, razón, respuesta, fechas, expiración y consumo. Rechazos por política manual se persisten; rechazos QR y fallos de autenticación no se guardan como eventos. Anulación, usuario anulador y motivo: **No verificado en el repositorio**. La marca NEW es `localStorage`, no auditoría persistente.

## 20. Pruebas existentes

| Tipo | Herramienta | Escenario | Archivo | Estado |
|---|---|---|---|---|
| Especificación BDD | Gherkin | Login exitoso por rol/fallido | `docs/test-plan.feature` | Documental |
| E2E | Playwright | — | — | No encontrada |
| Unitarias | — | — | — | No encontradas |
| Integración/RPC/RLS | — | — | — | No encontradas |
| Fixtures/seeds | SQL | Datos demo | `002_seed.sql`, `003_seed_multi_institution.sql` | Seeds, no tests |

Sin evidencia formal: aislamiento RLS, doble consumo QR, aprobación concurrente, ingreso duplicado manual, retiro autorizado, auto-salida, expiraciones, roles y regresiones de triggers.

## 21. Brechas detectadas

| Severidad | Brecha |
|---|---|
| Alta | Retiro por persona autorizada no valida `authorized_people/authorizations` ni registra `authorized_person_id`. |
| Alta | `link_student_by_code` es llamada por la app, pero su definición SQL no está en el repositorio. |
| Alta | Aprobación y creación de permiso temporal no son transaccionales; puede quedar solicitud aprobada sin autorización. |
| Alta | No hay pruebas automatizadas de RLS/RPC/flujos críticos. |
| Alta | Rechazos QR/intentos fallidos no quedan en auditoría persistente, pese al requerimiento documental. |
| Alta | Registro manual realiza check-then-insert sin bloqueo atómico; condición de carrera posible. |
| Media | PIN se selecciona como método, pero no existe credencial, expiración ni límite de intentos. |
| Media | Columnas normalizadas de contingencia no son escritas por la acción. |
| Media | CRUD de estudiantes/cursos/usuarios/apoderados/autorizados está incompleto o ausente. |
| Media | No hay horario aplicado a salidas/retiros pese a `schedule_blocks.exit_allowed`. |
| Media | Sin anulación/soft delete/auditoría de cambios críticos. |
| Media | Mensajes y validaciones no están completamente centralizados; Zod instalado sin uso. |
| Media | Salida aprobada por apoderado requiere porterías; no es auto-salida directa. |
| Baja | Badge NEW y remember-me dependen de `localStorage`. |
| Baja | Vercel/producción y cámara real están documentados, no verificados. |

## 22. Suficiencia para generar diagramas

| Diagrama | Información suficiente | Información faltante | Fuentes |
|---|---|---|---|
| Casos de uso | Sí, con estados | CRUD futuro y tercero | actions/pages/docs |
| Clases de dominio | Sí, conceptual | Decisión de unificar permisos | migrations |
| Componentes | Sí | Infra real | `src`, config |
| Actividades | Sí para actual | Excepciones de tercero/horario | actions/RPC |
| Secuencia ingreso | Sí | Concurrencia manual deseada | access action/trigger |
| Secuencia retiro | Parcial | Identidad de autorizado | QR RPC/tablas |
| Secuencia salida autónoma | Sí para permiso directo | Semántica de aprobación sin porterías | action/RPC |
| Despliegue | Parcial | Evidencia de Vercel/regiones/red | docs/config |
| Contexto | Sí | Integraciones futuras | README/docs |
| Base de datos | Sí, declarativa | Estado desplegado | migrations |
| Arquitectura general | Sí | Métricas runtime | todo lo anterior |

## 23. Recomendación de diagramas finales

### Exigidos por el profesor

- Casos de uso por actor, marcando futuro/parcial.
- Clases de dominio, no copia literal del ER.
- Componentes Next/Supabase.
- Actividades para registro y autorización.
- Secuencias separadas para ingreso manual/QR, retiro QR y salida autónoma.

### Necesarios para representar 4+1

- Casos de uso/escenarios (+1).
- Clases de dominio (lógica).
- Actividad y secuencias (procesos).
- Componentes (desarrollo).
- Despliegue (física), rotulando Vercel como propuesta no verificada.

### Complementarios

- Diagrama de contexto.
- ER de las 15 tablas.
- Arquitectura general cliente–Next–Supabase.
- Ishikawa académico ya documentado, separado de UML.

## 24. Fuentes internas consultadas

- `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `.env.example`, `README.md`.
- Todo `src/app/**/*.ts(x)`, `src/components/**/*.tsx`, `src/lib/**/*.ts` y `src/middleware.ts` (40 rutas TypeScript).
- `supabase/migrations/001_init.sql` a `supabase/migrations/015_student_self_exit.sql`.
- `docs/CONFIGURACION_LOCAL.md`, `docs/test-plan.feature`, `docs/validgate_sistema_actual.md`.
- `docs/validgate-context/validgate_especificacion_mvp_autenticacion_control_acceso.md`.
- `docs/validgate-context/validgate_flujo_mvp.md`.
- `docs/validgate-context/validgate_reporte_arquitectura_funcional_tecnica.md`.
- `docs/validgate-context/validgate_requerimientos_funcionales_no_funcionales.md`.
- `docs/prompts/prompt_codex_snapshot_validgate.md`.

No se usaron binarios, multimedia, `node_modules`, `.next` ni datos de una base externa. Total consolidado: 69 rutas textuales/configuración/código inspeccionadas; 8 módulos funcionales principales detectados; 15 tablas; 18 casos de uso candidatos; 14 brechas.
