# VALIDGATE - Documentacion del sistema actual

Fecha de referencia: 2026-05-24

## Proposito

VALIDGATE es un MVP para control de ingreso y salida estudiantil. El sistema registra eventos de acceso, mantiene el estado dentro/fuera de cada estudiante, entrega trazabilidad a apoderados y estudiantes, y permite operar reglas institucionales con QR dinamico, validacion manual y autorizaciones de salida.

## Roles

- `ADMIN`: gestiona configuracion institucional, politicas de acceso y puede operar porteria.
- `PORTERIA`: valida QR, registra eventos de ingreso, salida y retiro, y revisa eventos recientes.
- `DOCENTE`: rol preparado para visibilidad institucional y asistencia.
- `APODERADO`: ve estudiantes vinculados, trazabilidad y responde solicitudes de autorizacion.
- `ESTUDIANTE`: ve su dashboard, apoderados vinculados, credenciales QR y puede solicitar o registrar salida segun permiso.

## Modulos principales

- `/`: login con mensajes genericos y opcion de recordar email.
- `/register`: registro de usuario.
- `/dashboard`: panel principal adaptado por rol.
- `/guard`: modulo de porteria para validar QR y registrar eventos.
- `/authentications`: credenciales QR dinamicas.
- `/settings`: perfil, password y politicas de acceso para administradores.
- `/students/link`: vinculacion por codigo.
- `/students/[id]`: detalle del estudiante, contactos, permisos y asistencia.

## Control de acceso y porteria

Porteria registra eventos en `access_events`. Cada evento incluye estudiante, tipo (`INGRESO` o `SALIDA`), tipo de salida cuando aplica, metodo de validacion, resultado, notas y snapshot de politica.

Cuando un evento queda `APROBADO`, el trigger `apply_access_event` actualiza `students.is_in_institution`:

- `INGRESO`: deja al estudiante dentro de la institucion.
- `SALIDA`: deja al estudiante fuera de la institucion.

Si una regla falla, el sistema registra un evento `RECHAZADO` para trazabilidad sin cambiar el estado del estudiante.

## Politicas institucionales

La tabla `institution_access_policies` define si ingreso o salida requieren autenticador QR/PIN y si esa regla es excluyente.

El registro manual de porteria evalua:

- ingreso duplicado cuando el estudiante ya esta dentro;
- salida sin ingreso activo;
- salida solo cuando el estudiante no tiene permiso;
- salida sin autenticador cuando la politica lo exige;
- necesidad de observacion en contingencias.

## Credenciales QR

Las credenciales QR se guardan en `student_qr_credentials`. Son opacas y temporales:

- el QR contiene solo `validgate-auth:{uuid}`;
- no contiene datos personales;
- tiene expiracion;
- puede ser revocado;
- se marca como usado al confirmar un evento;
- un QR usado no puede reutilizarse.

En `/authentications`, el sistema muestra un QR vigente si existe. No genera ni refresca QR automaticamente al entrar a la pagina. Un nuevo QR se crea solo cuando el usuario presiona el boton `Generar QR`.

En el dashboard del estudiante:

- si no hay QR vigente, el CTA muestra `Generar QR`;
- si hay QR vigente, el CTA muestra `Ver QR`;
- el estado QR indica si existe una credencial vigente y su hora de expiracion;
- `Registrar salida` queda deshabilitado si no existe QR vigente o si el estudiante esta fuera de la institucion.

## Salida por voluntad del estudiante

Un estudiante puede registrar su propia salida solo cuando:

- tiene rol `ESTUDIANTE`;
- esta vinculado a un registro de estudiante;
- se encuentra dentro de la institucion;
- tiene `can_leave_alone = true`;
- posee una credencial QR vigente, no usada y no revocada.

La RPC `confirm_student_self_exit()` realiza estas validaciones en base de datos y registra un evento `SALIDA` con `exit_kind = 'SOLO'`, `validation_kind = 'QR'` y resultado `APROBADO`.

Si falta una precondicion, la UI muestra mensajes accionables para el usuario y el servidor registra logs estructurados con codigos internos y status HTTP semantico.

## Solicitudes de autorizacion

Cuando un estudiante no puede salir solo, puede crear una solicitud de autorizacion hacia su apoderado. El apoderado ve solicitudes pendientes en el dashboard y puede aprobar o rechazar.

Si se aprueba, el sistema crea una autorizacion temporal en `student_exit_authorizations`. Porteria puede consumir esa autorizacion al confirmar salida/retiro mediante QR.

## Trazabilidad

El dashboard combina eventos recientes de `access_events` con solicitudes de autorizacion para mostrar una vista de trazabilidad por rol.

La card de evento puede mostrar una etiqueta visual `NEW`. Actualmente se usa `localStorage` para recordar eventos vistos por usuario, rol, modulo y tipo de evento. El badge desaparece al interactuar con la card. A futuro deberia reemplazarse por un modelo persistente de lectura, por ejemplo una tabla `access_event_views` o `notification_reads`.

## UI y comportamiento de formularios

Los botones que ejecutan server actions quedan bloqueados mientras la peticion esta pendiente. Esto evita doble envio y entrega feedback visual consistente.

El sistema usa mensajes inline o toasts segun el flujo. Los mensajes descartables tienen boton de cierre cuando corresponde, por ejemplo en validacion QR de porteria.

## Seguridad y RLS

Las migraciones habilitan RLS para tablas sensibles y separan visibilidad por rol:

- staff ve datos de su institucion;
- apoderados ven estudiantes y eventos vinculados;
- estudiantes ven su propio perfil, apoderados vinculados y eventos propios;
- QR y autorizaciones se consultan segun relacion y propietario.

Las operaciones sensibles de QR y salida directa se resuelven con RPC `security definer`, validando rol, institucion, estado del estudiante y vigencia de credenciales dentro de la base de datos.

## Migraciones relevantes

- `001_init.sql`: esquema base, eventos, asistencia, triggers y politicas iniciales.
- `005_access_control_policies.sql`: politicas institucionales de autenticador.
- `006_student_qr_credentials.sql`: credenciales QR temporales.
- `007_enforce_qr_exit_rules.sql`: confirmacion QR y reglas de salida.
- `008_student_profiles.sql`: vinculo entre usuarios estudiante y registros de estudiante.
- `009_student_guardian_visibility.sql`: visibilidad de apoderados para estudiantes.
- `010_contact_identity_fields.sql`: RUT y telefono.
- `011_guardian_relation_types.sql`: normalizacion de tipos de relacion.
- `012_authorization_requests.sql`: solicitudes y autorizaciones temporales.
- `013_access_event_contingency.sql`: contingencias por dispositivo.
- `014_student_access_events_visibility.sql`: eventos visibles para estudiantes.
- `015_student_self_exit.sql`: salida directa del estudiante autorizado.

## Limitaciones conocidas

- El badge `NEW` no tiene persistencia server-side; se apoya en `localStorage`.
- PIN temporal, MFA operativo y notificaciones externas estan preparados conceptualmente, pero no completados como flujo productivo.
- La lectura QR por camara puede evolucionar con `html5-qrcode`; hoy existe validacion por payload pegado/escaneado.
- La notificacion al apoderado se refleja como trazabilidad visible; falta integracion con canales externos.

