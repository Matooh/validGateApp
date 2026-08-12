# VALIDGATE - Documentacion del sistema actual

Fecha de referencia: 2026-05-24

## Proposito

VALIDGATE es un MVP para control de ingreso y salida estudiantil. El sistema registra eventos de acceso, mantiene el estado dentro/fuera de cada estudiante, entrega trazabilidad a apoderados y estudiantes, y permite operar reglas institucionales con QR dinámico, validación manual y autorizaciones de salida.

## Roles

- `ADMIN`: gestiona configuración institucional, políticas de acceso y puede operar portería.
- `PORTERIA`: valida QR, registra eventos de ingreso, salida y retiro, y revisa eventos recientes.
- `DOCENTE`: rol preparado para visibilidad institucional y asistencia.
- `APODERADO`: ve estudiantes vinculados, trazabilidad y responde solicitudes de autorización.
- `ESTUDIANTE`: ve su dashboard, apoderados vinculados, credenciales QR y puede solicitar o registrar salida según permiso.

## Módulos principales

- `/`: login con mensajes genéricos y opción de recordar email.
- `/register`: registro de usuario.
- `/dashboard`: panel principal adaptado por rol.
- `/guard`: módulo de portería para validar QR y registrar eventos.
- `/authentications`: credenciales QR dinámicas.
- `/settings`: perfil, password y políticas de acceso para administradores.
- `/students/link`: vinculación por código.
- `/students/[id]`: detalle del estudiante, contactos, permisos y asistencia.

## Control de acceso y portería

Portería registra eventos en `access_events`. Cada evento incluye estudiante, tipo (`INGRESO` o `SALIDA`), tipo de salida cuando aplica, método de validación, resultado, notas y snapshot de política.

Cuando un evento queda `APROBADO`, el trigger `apply_access_event` actualiza `students.is_in_institution`:

- `INGRESO`: deja al estudiante dentro de la institución.
- `SALIDA`: deja al estudiante fuera de la institución.

Si una regla falla, el sistema registra un evento `RECHAZADO` para trazabilidad sin cambiar el estado del estudiante.

## Políticas institucionales

La tabla `institution_access_policies` define si ingreso o salida requieren autenticador QR/PIN y si esa regla es excluyente.

El registro manual de portería evalúa:

- ingreso duplicado cuando el estudiante ya está dentro;
- salida sin ingreso activo;
- salida solo cuando el estudiante no tiene permiso;
- salida sin autenticador cuando la política lo exige;
- necesidad de observación en contingencias.

## Credenciales QR

Las credenciales QR se guardan en `student_qr_credentials`. Son opacas y temporales:

- el QR contiene solo `validgate-auth:{uuid}`;
- no contiene datos personales;
- tiene expiración;
- puede ser revocado;
- se marca como usado al confirmar un evento;
- un QR usado no puede reutilizarse.

En `/authentications`, el sistema muestra un QR vigente si existe. No genera ni refresca QR automáticamente al entrar a la página. Un nuevo QR se crea solo cuando el usuario presiona el botón `Generar QR`.

En el dashboard del estudiante:

- si no hay QR vigente, el CTA muestra `Generar QR`;
- si hay QR vigente, el CTA muestra `Ver QR`;
- el estado QR indica si existe una credencial vigente y su hora de expiración;
- `Registrar salida` queda deshabilitado si no existe QR vigente o si el estudiante está fuera de la institución.

## Salida por voluntad del estudiante

Un estudiante puede registrar su propia salida solo cuando:

- tiene rol `ESTUDIANTE`;
- está vinculado a un registro de estudiante;
- se encuentra dentro de la institución;
- tiene `can_leave_alone = true`;
- posee una credencial QR vigente, no usada y no revocada.

La RPC `confirm_student_self_exit()` realiza estas validaciones en base de datos y registra un evento `SALIDA` con `exit_kind = 'SOLO'`, `validation_kind = 'QR'` y resultado `APROBADO`.

Si falta una precondición, la UI muestra mensajes accionables para el usuario y el servidor registra logs estructurados con códigos internos y status HTTP semántico.

## Solicitudes de autorización

Cuando un estudiante no puede salir solo, puede crear una solicitud de autorización hacia su apoderado. El apoderado ve solicitudes pendientes en el dashboard y puede aprobar o rechazar.

Si se aprueba, el sistema crea una autorización temporal en `student_exit_authorizations`. Portería puede consumir esa autorización al confirmar salida/retiro mediante QR.

## Trazabilidad

El dashboard combina eventos recientes de `access_events` con solicitudes de autorización para mostrar una vista de trazabilidad por rol.

La card de evento puede mostrar una etiqueta visual `NEW`. Actualmente se usa `localStorage` para recordar eventos vistos por usuario, rol, módulo y tipo de evento. El badge desaparece al interactuar con la card. A futuro deberia reemplazarse por un modelo persistente de lectura, por ejemplo una tabla `access_event_views` o `notification_reads`.

## UI y comportamiento de formularios

Los botones que ejecutan server actions quedan bloqueados mientras la petición está pendiente. Esto evita doble envío y entrega feedback visual consistente.

El sistema usa mensajes inline o toasts según el flujo. Los mensajes descartables tienen botón de cierre cuando corresponde, por ejemplo en validación QR de portería.

## Seguridad y RLS

Las migraciones habilitan RLS para tablas sensibles y separan visibilidad por rol:

- staff ve datos de su institución;
- apoderados ven estudiantes y eventos vinculados;
- estudiantes ven su propio perfil, apoderados vinculados y eventos propios;
- QR y autorizaciones se consultan según relación y propietario.

Las operaciones sensibles de QR y salida directa se resuelven con RPC `security definer`, validando rol, institución, estado del estudiante y vigencia de credenciales dentro de la base de datos.

## Migraciones relevantes

- `001_init.sql`: esquema base, eventos, asistencia, triggers y políticas iniciales.
- `005_access_control_policies.sql`: políticas institucionales de autenticador.
- `006_student_qr_credentials.sql`: credenciales QR temporales.
- `007_enforce_qr_exit_rules.sql`: confirmación QR y reglas de salida.
- `008_student_profiles.sql`: vinculo entre usuarios estudiante y registros de estudiante.
- `009_student_guardian_visibility.sql`: visibilidad de apoderados para estudiantes.
- `010_contact_identity_fields.sql`: RUT y teléfono.
- `011_guardian_relation_types.sql`: normalizacion de tipos de relación.
- `012_authorization_requests.sql`: solicitudes y autorizaciones temporales.
- `013_access_event_contingency.sql`: contingencias por dispositivo.
- `014_student_access_events_visibility.sql`: eventos visibles para estudiantes.
- `015_student_self_exit.sql`: salida directa del estudiante autorizado.

## Limitaciones conocidas

- El badge `NEW` no tiene persistencia server-side; se apoya en `localStorage`.
- PIN temporal, MFA operativo y notificaciones externas están preparados conceptualmente, pero no completados como flujo productivo.
- La lectura QR por cámara puede evolucionar con `html5-qrcode`; hoy existe validación por payload pegado/escaneado.
- La notificacion al apoderado se refleja como trazabilidad visible; falta integracion con canales externos.
