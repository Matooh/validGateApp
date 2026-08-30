# Flujo de Apoderados Secundarios

## Modelo de acceso

VALIDGATE separa el rol global de la relación con cada estudiante:

- El Apoderado Secundario conserva internamente `profiles.role = RETIRADOR_AUTORIZADO`, que entrega únicamente las capacidades base de esa cuenta.
- `guardian_students.relation_type = RETIRADOR_AUTORIZADO` identifica técnicamente al estudiante autorizado para ese Apoderado Secundario.
- `valid_from`, `valid_until` y `revoked_at` determinan si la relación se encuentra vigente.

El tipo histórico `APODERADO_PRINCIPAL` se migra a `APODERADO`; ambos se muestran funcionalmente como Apoderado Primario. Las relaciones permanentes no requieren vigencia. Los Apoderados Secundarios históricos que no tenían período explícito se conservan revocados y deben autorizarse nuevamente.

## Invitación y reutilización de cuentas

1. Un administrador o Apoderado Primario abre **Vínculos**.
2. Selecciona un estudiante permitido e ingresa nombre, correo, RUT y período de vigencia. El teléfono queda fuera del alcance actual.
3. Si el correo o RUT ya corresponde a un Apoderado Primario (`APODERADO`) o Secundario (`RETIRADOR_AUTORIZADO`), se reutiliza esa identidad después de comprobar que ambos identificadores pertenecen a la misma cuenta.
4. Si no existe, Supabase envía una invitación por correo y crea un perfil de Apoderado Secundario con rol técnico `RETIRADOR_AUTORIZADO`.
5. La cuenta puede permanecer registrada, pero RLS solo expone al estudiante mientras la relación esté vigente.

Las invitaciones requieren `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor y `NEXT_PUBLIC_SITE_URL` para construir el retorno de la invitación. La clave de servicio nunca debe publicarse mediante una variable `NEXT_PUBLIC_*`.

## Permisos y vigencia

- El administrador autoriza estudiantes de su institución.
- El Apoderado Primario autoriza solamente estudiantes con los que posee una relación técnica `APODERADO`.
- El Apoderado Secundario ve únicamente sus relaciones vigentes y puede iniciar una solicitud de retiro durante ese período.
- Portería y docente no tienen acceso a la vista **Vínculos**.
- El administrador o el Apoderado Primario que creó la autorización pueden revocarla anticipadamente.
- Las relaciones vencidas o revocadas se conservan como historial para los usuarios autorizados a administrarlas.

Las funciones de retiro verifican nuevamente la vigencia en la base de datos. Una expiración o revocación impide continuar un retiro, incluso si la interfaz quedó abierta previamente.

## Retiro y validación

1. El Apoderado Secundario solicita el retiro desde el estudiante que tiene asignado.
2. El estudiante recibe el mensaje institucional y acepta o rechaza la solicitud.
3. Después de aceptar se generan dos PIN distintos, uno para el estudiante y otro para el Apoderado Secundario.
4. Portería valida ambos PIN. Para Apoderados Secundarios no existe contingencia manual: el método es exclusivamente PIN.
5. Cada PIN se consume en su primera validación correcta y no puede reutilizarse, incluso después de completar la salida.
6. La segunda validación completa la salida efectiva y muestra a portería una instrucción nominal; no existe una aprobación adicional.

La revocación de la autorización cancela inmediatamente cualquier retiro activo asociado e invalida sus PIN. Un intento realizado desde una vista desactualizada también se rechaza en la base de datos.

## Trazabilidad y privacidad

Mientras la autorización está vigente, el Apoderado Secundario puede consultar los eventos permitidos del estudiante asignado. Después del vencimiento o la revocación pierde ese acceso general, pero conserva el retiro histórico que realizó personalmente. No puede consultar estudiantes no autorizados ni eventos de otra institución.

Las evidencias E2E muestran el componente completo **Trazabilidad reciente** y validan a la vez la presencia del retiro propio y la ausencia de eventos protegidos. En un retiro completado también muestran ambos PIN, las dos aprobaciones en verde y el estado final.

## Cobertura automatizada

El archivo `e2e/authorized-retriever-pickup.spec.ts` implementa:

| ID | Evidencia principal |
| --- | --- |
| PF-APO-SEC-001 | Ausencia inicial, formulario, registro nuevo, vínculo vigente y acceso del Apoderado Secundario. |
| PF-APO-SEC-002 | Cuenta preexistente sin estudiantes, reutilización, activación del vínculo y estudiante visible. |
| PF-APO-SEC-003 | Retiro como Apoderado Secundario: solicitud, aceptación, PIN de ambos actores, cierre automático y trazabilidad final. |
| PF-APO-SEC-004 | Vínculo inicialmente disponible, revocación concurrente y toast de rechazo. |
| PF-APO-SEC-005 | Retiro activo, revocación, cancelación inmediata e invalidación del PIN. |
| PF-APO-SEC-007 | Único estudiante visible y rechazo al solicitar otro estudiante. |

Las capturas enmascaran passwords y payloads. Los códigos de vinculación y PIN pueden mostrarse en evidencias E2E controladas cuando el caso exige comprobar el valor ingresado o entregado. Para una instalación que ya aplicó la migración 026 también debe aplicarse `027_fix_confirm_guardian_pickup_request_id.sql`.
