-- Una solicitud que espera la respuesta del estudiante no puede quedar activa
-- indefinidamente, especialmente si proviene de una prueba abandonada.
alter table public.guardian_pickup_requests
  alter column expires_at set default (now() + interval '15 minutes');

update public.guardian_pickup_requests
set expires_at = created_at + interval '15 minutes'
where status = 'PENDING_STUDENT_RESPONSE' and expires_at is null;

update public.guardian_pickup_requests
set status = 'EXPIRED', updated_at = now(), terminal_note = 'Solicitud expirada por falta de respuesta'
where status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
  and expires_at <= now();

notify pgrst, 'reload schema';
