# Flujo de retiradores autorizados

## Modelo de acceso

VALIDGATE separa el rol global de la relación con cada estudiante:

- `profiles.role = RETIRADOR_AUTORIZADO` entrega únicamente las capacidades base de esa cuenta.
- `guardian_students.relation_type = RETIRADOR_AUTORIZADO` identifica al estudiante autorizado.
- `valid_from`, `valid_until` y `revoked_at` determinan si la relación se encuentra vigente.

El tipo histórico `APODERADO_PRINCIPAL` se migra a `APODERADO`. Las relaciones permanentes de apoderado no requieren vigencia. Los retiradores históricos que no tenían período explícito se conservan revocados y deben autorizarse nuevamente.

## Invitación y reutilización de cuentas

1. Un administrador o apoderado abre **Vínculos**.
2. Selecciona un estudiante permitido, ingresa nombre, correo y período de vigencia.
3. Si el correo ya corresponde a un `APODERADO` o `RETIRADOR_AUTORIZADO`, se reutiliza esa identidad.
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
