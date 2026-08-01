create or replace function public.respond_to_authorization_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns table (
  request_id uuid,
  message_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.authorization_requests%rowtype;
begin
  request_id := p_request_id;

  if auth.uid() is null or public.current_user_role() <> 'APODERADO' then
    message_code := 'AUTH_REQUEST_FORBIDDEN';
    return next;
    return;
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    message_code := 'AUTH_REQUEST_NOT_ALLOWED';
    return next;
    return;
  end if;

  select ar.*
  into request_record
  from public.authorization_requests ar
  where ar.id = p_request_id
    and ar.guardian_profile_id = auth.uid()
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = ar.student_id
        and gs.guardian_profile_id = auth.uid()
    )
  for update;

  if not found then
    message_code := 'AUTH_REQUEST_FORBIDDEN';
    return next;
    return;
  end if;

  if request_record.status <> 'PENDING' then
    message_code := 'AUTH_REQUEST_NOT_ALLOWED';
    return next;
    return;
  end if;

  if request_record.expires_at <= now() then
    update public.authorization_requests
    set status = 'EXPIRED', responded_at = now()
    where id = request_record.id;

    message_code := 'AUTH_REQUEST_EXPIRED';
    return next;
    return;
  end if;

  update public.authorization_requests
  set status = p_decision,
      guardian_response_note = nullif(trim(coalesce(p_note, '')), ''),
      responded_at = now()
  where id = request_record.id;

  if p_decision = 'APPROVED' then
    insert into public.student_exit_authorizations (
      authorization_request_id,
      institution_id,
      student_id,
      guardian_profile_id,
      valid_until,
      used_at,
      created_by_profile_id
    )
    values (
      request_record.id,
      request_record.institution_id,
      request_record.student_id,
      request_record.guardian_profile_id,
      now() + interval '30 minutes',
      now(),
      auth.uid()
    );

    insert into public.access_events (
      student_id,
      actor_profile_id,
      recorded_by_profile_id,
      event_type,
      exit_kind,
      validation_kind,
      result,
      notes
    )
    values (
      request_record.student_id,
      auth.uid(),
      auth.uid(),
      'SALIDA',
      'RETIRO_AUTORIZADO',
      'MANUAL',
      'APROBADO',
      'Retiro autorizado y confirmado por el apoderado desde el dashboard.'
    );

    message_code := 'AUTH_REQUEST_APPROVED';
  else
    message_code := 'AUTH_REQUEST_REJECTED';
  end if;

  return next;
end;
$$;

notify pgrst, 'reload schema';

revoke all on function public.respond_to_authorization_request(uuid, text, text) from public;
grant execute on function public.respond_to_authorization_request(uuid, text, text) to authenticated;

comment on function public.respond_to_authorization_request(uuid, text, text) is
  'Responde una solicitud de retiro de forma atomica y registra la salida al aprobarla.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'authorization_requests'
    ) then
      alter publication supabase_realtime add table public.authorization_requests;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'students'
    ) then
      alter publication supabase_realtime add table public.students;
    end if;
  end if;
end;
$$;
