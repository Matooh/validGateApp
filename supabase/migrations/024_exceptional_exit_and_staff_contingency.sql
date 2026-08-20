alter type public.exit_type add value if not exists 'EXCEPCIONAL';

alter table public.authorization_requests
  drop constraint if exists authorization_requests_request_type_check;

alter table public.authorization_requests
  add constraint authorization_requests_request_type_check
  check (request_type in (
    'EXIT_ALONE',
    'EXIT_CONTINGENCY',
    'PICKUP_BY_GUARDIAN',
    'PICKUP_BY_AUTHORIZED_PERSON'
  ));

alter table public.authorization_requests
  add column if not exists contingency_reason public.access_contingency_reason,
  add column if not exists contingency_note text;

comment on column public.authorization_requests.contingency_reason is
  'Motivo normalizado cuando Porteria solicita una salida sin autenticador.';

comment on column public.authorization_requests.contingency_note is
  'Observacion obligatoria de la contingencia que debe revisar el apoderado.';

drop policy if exists "staff can create exit contingency requests"
  on public.authorization_requests;

create policy "staff can create exit contingency requests"
  on public.authorization_requests for insert
  to authenticated
  with check (
    request_type = 'EXIT_CONTINGENCY'
    and requested_by_profile_id = auth.uid()
    and institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
    and exists (
      select 1
      from public.students s
      where s.id = authorization_requests.student_id
        and s.institution_id = authorization_requests.institution_id
        and s.is_in_institution = true
        and s.can_leave_alone = true
    )
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = authorization_requests.student_id
        and gs.guardian_profile_id = authorization_requests.guardian_profile_id
    )
  );

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

    if request_record.request_type = 'EXIT_CONTINGENCY' then
      insert into public.access_events (
        student_id,
        actor_profile_id,
        recorded_by_profile_id,
        event_type,
        exit_kind,
        validation_kind,
        result,
        notes,
        access_mode,
        contingency_reason,
        contingency_note,
        authenticator_required,
        authenticator_presented
      )
      values (
        request_record.student_id,
        auth.uid(),
        request_record.requested_by_profile_id,
        'SALIDA',
        'SOLO',
        'MANUAL',
        'APROBADO',
        concat(
          'Salida por contingencia autorizada por el apoderado.',
          case when request_record.contingency_note is not null
            then ' Observacion: ' || request_record.contingency_note
            else '' end
        ),
        'CONTINGENCIA_SIN_DISPOSITIVO',
        request_record.contingency_reason,
        request_record.contingency_note,
        true,
        false
      );
    else
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
    end if;

    message_code := 'AUTH_REQUEST_APPROVED';
  else
    message_code := 'AUTH_REQUEST_REJECTED';
  end if;

  return next;
end;
$$;

revoke all on function public.respond_to_authorization_request(uuid, text, text) from public;
grant execute on function public.respond_to_authorization_request(uuid, text, text) to authenticated;

comment on function public.respond_to_authorization_request(uuid, text, text) is
  'Responde una solicitud y registra la salida aprobada, incluida la contingencia iniciada por personal.';

notify pgrst, 'reload schema';
