# Flujo de retiradores autorizados

## Modelo de acceso

VALIDGATE separa el rol global de la relación con cada estudiante:

- `profiles.role = RETIRADOR_AUTORIZADO` entrega únicamente las capacidades base de esa cuenta.
- `guardian_students.relation_type = RETIRADOR_AUTORIZADO` identifica al estudiante autorizado.
- `valid_from`, `valid_until` y `revoked_at` determinan si la relación se encuentra vigente.

El tipo histórico `APODERADO_PRINCIPAL` se migra a `APODERADO`. Las relaciones permanentes de apoderado no requieren vigencia. Los retiradores históricos que no tenían período explícito se conservan revocados y deben autorizarse nuevamente.

## Invitación y reutilización de cuentas

1. Un administrador o apoderado abre **Vínculos**.
2. Selecciona un estudiante permitido e ingresa nombre, correo, RUT y período de vigencia. El teléfono queda fuera del alcance actual.
3. Si el correo o RUT ya corresponde a un `APODERADO` o `RETIRADOR_AUTORIZADO`, se reutiliza esa identidad después de comprobar que ambos identificadores pertenecen a la misma cuenta.
4. Si no existe, Supabase envía una invitación por correo y crea un perfil con rol `RETIRADOR_AUTORIZADO`.
5. La cuenta puede permanecer registrada, pero RLS solo expone al estudiante mientras la relación esté vigente.

Las invitaciones requieren `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor y `NEXT_PUBLIC_SITE_URL` para construir el retorno de la invitación. La clave de servicio nunca debe publicarse mediante una variable `NEXT_PUBLIC_*`.

## Permisos y vigencia

- El administrador autoriza estudiantes de su institución.
- El apoderado autoriza solamente estudiantes con los que posee una relación `APODERADO`.
- El retirador ve únicamente sus relaciones vigentes y puede iniciar una solicitud de retiro durante ese período.
- Portería y docente no tienen acceso a la vista **Vínculos**.
- El administrador o el apoderado que creó la autorización pueden revocarla anticipadamente.
- Las relaciones vencidas o revocadas se conservan como historial para los usuarios autorizados a administrarlas.

Las funciones de retiro verifican nuevamente la vigencia en la base de datos. Una expiración o revocación impide continuar un retiro, incluso si la interfaz quedó abierta previamente.

## Retiro y validación

1. El retirador solicita el retiro desde el estudiante que tiene asignado.
2. El estudiante recibe el mensaje institucional y acepta o rechaza la solicitud.
3. Después de aceptar se generan dos PIN distintos, uno para el estudiante y otro para el retirador.
4. Portería valida ambos PIN. Para retiradores temporales no existe contingencia manual: el método es exclusivamente PIN.
5. Cada PIN se consume en su primera validación correcta y no puede reutilizarse, incluso después de completar la salida.
6. Portería confirma la salida efectiva solamente cuando ambas identidades están validadas.

La revocación de la autorización cancela inmediatamente cualquier retiro activo asociado e invalida sus PIN. Un intento realizado desde una vista desactualizada también se rechaza en la base de datos.

## Cobertura automatizada

El archivo `e2e/authorized-retriever-pickup.spec.ts` implementa:

| ID | Evidencia principal |
| --- | --- |
| PF-RET-AUT-001 | Ausencia inicial, formulario, registro nuevo, vínculo vigente y acceso del retirador. |
| PF-RET-AUT-002 | Cuenta preexistente sin estudiantes, reutilización, activación del vínculo y estudiante visible. |
| PF-RET-AUT-003 | Solicitud, mensaje al estudiante, aceptación, PIN de ambos actores, validación dual y confirmación. |
| PF-RET-AUT-004 | Vínculo inicialmente disponible, revocación concurrente y toast de rechazo. |
| PF-RET-AUT-005 | Retiro activo, revocación, cancelación inmediata e invalidación del PIN. |
| PF-RET-AUT-006 | Primer consumo aceptado, reutilización bloqueada y una única salida registrada. |
| PF-RET-AUT-007 | Único estudiante visible y rechazo al solicitar otro estudiante. |

Las capturas enmascaran passwords, payloads, códigos y PIN. Para una instalación que ya aplicó la migración 026 también debe aplicarse `027_fix_confirm_guardian_pickup_request_id.sql`.
