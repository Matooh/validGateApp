create table if not exists public.authorization_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id bigint not null references public.institutions(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  guardian_profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null default 'EXIT_ALONE'
    check (request_type in ('EXIT_ALONE', 'PICKUP_BY_GUARDIAN', 'PICKUP_BY_AUTHORIZED_PERSON')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  reason text null,
  guardian_response_note text null,
  requested_at timestamptz not null default now(),
  responded_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists idx_authorization_requests_student_id
on public.authorization_requests(student_id);

create index if not exists idx_authorization_requests_guardian_profile_id
on public.authorization_requests(guardian_profile_id);

create index if not exists idx_authorization_requests_institution_id
on public.authorization_requests(institution_id);

create index if not exists idx_authorization_requests_status
on public.authorization_requests(status);

create index if not exists idx_authorization_requests_expires_at
on public.authorization_requests(expires_at);

create table if not exists public.student_exit_authorizations (
  id uuid primary key default gen_random_uuid(),
  authorization_request_id uuid not null unique references public.authorization_requests(id) on delete cascade,
  institution_id bigint not null references public.institutions(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  guardian_profile_id uuid not null references public.profiles(id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null default (now() + interval '30 minutes'),
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  check (valid_until > valid_from)
);

create index if not exists idx_student_exit_authorizations_student_id
on public.student_exit_authorizations(student_id);

create index if not exists idx_student_exit_authorizations_guardian_profile_id
on public.student_exit_authorizations(guardian_profile_id);

create index if not exists idx_student_exit_authorizations_institution_id
on public.student_exit_authorizations(institution_id);

create index if not exists idx_student_exit_authorizations_valid_until
on public.student_exit_authorizations(valid_until);

drop policy if exists "students can read own guardian links"
  on public.guardian_students;

create policy "students can read own guardian links"
  on public.guardian_students for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_profiles sp
      where sp.profile_id = auth.uid()
        and sp.student_id = guardian_students.student_id
    )
  );

alter table public.authorization_requests enable row level security;
alter table public.student_exit_authorizations enable row level security;

drop policy if exists "students can create own authorization requests"
  on public.authorization_requests;

create policy "students can create own authorization requests"
  on public.authorization_requests for insert
  to authenticated
  with check (
    requested_by_profile_id = auth.uid()
    and exists (
      select 1
      from public.student_profiles sp
      where sp.profile_id = auth.uid()
        and sp.student_id = authorization_requests.student_id
        and sp.institution_id = authorization_requests.institution_id
    )
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = authorization_requests.student_id
        and gs.guardian_profile_id = authorization_requests.guardian_profile_id
    )
  );

drop policy if exists "students can read own authorization requests"
  on public.authorization_requests;

create policy "students can read own authorization requests"
  on public.authorization_requests for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_profiles sp
      where sp.profile_id = auth.uid()
        and sp.student_id = authorization_requests.student_id
        and sp.institution_id = authorization_requests.institution_id
    )
  );

drop policy if exists "guardians can read linked authorization requests"
  on public.authorization_requests;

create policy "guardians can read linked authorization requests"
  on public.authorization_requests for select
  to authenticated
  using (
    guardian_profile_id = auth.uid()
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = authorization_requests.student_id
        and gs.guardian_profile_id = auth.uid()
    )
  );

drop policy if exists "guardians can respond linked authorization requests"
  on public.authorization_requests;

create policy "guardians can respond linked authorization requests"
  on public.authorization_requests for update
  to authenticated
  using (
    guardian_profile_id = auth.uid()
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = authorization_requests.student_id
        and gs.guardian_profile_id = auth.uid()
    )
  )
  with check (
    guardian_profile_id = auth.uid()
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = authorization_requests.student_id
        and gs.guardian_profile_id = auth.uid()
    )
  );

drop policy if exists "staff can read authorization requests in institution"
  on public.authorization_requests;

create policy "staff can read authorization requests in institution"
  on public.authorization_requests for select
  to authenticated
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  );

drop policy if exists "linked users can read exit authorizations"
  on public.student_exit_authorizations;

create policy "linked users can read exit authorizations"
  on public.student_exit_authorizations for select
  to authenticated
  using (
    (
      institution_id = public.current_user_institution_id()
      and public.current_user_role() in ('ADMIN', 'PORTERIA')
    )
    or guardian_profile_id = auth.uid()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.profile_id = auth.uid()
        and sp.student_id = student_exit_authorizations.student_id
        and sp.institution_id = student_exit_authorizations.institution_id
    )
  );

drop policy if exists "guardians can create exit authorizations from approved requests"
  on public.student_exit_authorizations;

create policy "guardians can create exit authorizations from approved requests"
  on public.student_exit_authorizations for insert
  to authenticated
  with check (
    guardian_profile_id = auth.uid()
    and created_by_profile_id = auth.uid()
    and exists (
      select 1
      from public.authorization_requests ar
      where ar.id = student_exit_authorizations.authorization_request_id
        and ar.student_id = student_exit_authorizations.student_id
        and ar.institution_id = student_exit_authorizations.institution_id
        and ar.guardian_profile_id = auth.uid()
        and ar.status = 'APPROVED'
    )
  );

drop policy if exists "staff can consume exit authorizations in institution"
  on public.student_exit_authorizations;

create policy "staff can consume exit authorizations in institution"
  on public.student_exit_authorizations for update
  to authenticated
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  )
  with check (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  );

create or replace function public.confirm_student_qr_access_event(
  p_credential_id uuid,
  p_event_type text
)
returns table (
  credential_id uuid,
  student_id bigint,
  event_type public.access_event_type,
  exit_kind public.exit_type,
  message_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  credential_record public.student_qr_credentials%rowtype;
  student_record public.students%rowtype;
  exit_authorization_record public.student_exit_authorizations%rowtype;
  normalized_event_type text;
  access_event_type public.access_event_type;
  access_exit_kind public.exit_type;
begin
  credential_id := p_credential_id;

  if auth.uid() is null or public.current_user_role() not in ('ADMIN', 'PORTERIA') then
    message_code := 'QR_FORBIDDEN';
    return next;
    return;
  end if;

  normalized_event_type := upper(trim(p_event_type));

  if normalized_event_type = 'INGRESO' then
    access_event_type := 'INGRESO';
    access_exit_kind := null;
  elsif normalized_event_type = 'SALIDA' then
    access_event_type := 'SALIDA';
    access_exit_kind := 'REGULAR';
  elsif normalized_event_type = 'RETIRO' then
    access_event_type := 'SALIDA';
    access_exit_kind := 'RETIRO_AUTORIZADO';
  else
    message_code := 'QR_INVALID_EVENT';
    return next;
    return;
  end if;

  select *
  into credential_record
  from public.student_qr_credentials sqc
  where sqc.id = p_credential_id
    and sqc.institution_id = public.current_user_institution_id()
  for update;

  if not found then
    message_code := 'QR_NOT_FOUND';
    return next;
    return;
  end if;

  student_id := credential_record.student_id;

  if credential_record.revoked_at is not null then
    message_code := 'QR_REVOKED';
    return next;
    return;
  end if;

  if credential_record.used_at is not null then
    message_code := 'QR_ALREADY_USED';
    return next;
    return;
  end if;

  if credential_record.expires_at <= now() then
    message_code := 'QR_EXPIRED';
    return next;
    return;
  end if;

  select *
  into student_record
  from public.students s
  where s.id = credential_record.student_id
    and s.institution_id = credential_record.institution_id
  for update;

  if not found then
    message_code := 'QR_NOT_FOUND';
    return next;
    return;
  end if;

  if access_event_type = 'INGRESO' and student_record.is_in_institution then
    message_code := 'QR_ENTRY_ALREADY_ACTIVE';
    return next;
    return;
  end if;

  if access_event_type = 'SALIDA' and not student_record.is_in_institution then
    message_code := 'QR_STUDENT_NOT_INSIDE';
    return next;
    return;
  end if;

  if access_event_type = 'SALIDA' and not student_record.can_leave_alone then
    select *
    into exit_authorization_record
    from public.student_exit_authorizations sea
    where sea.student_id = student_record.id
      and sea.institution_id = student_record.institution_id
      and sea.used_at is null
      and sea.valid_from <= now()
      and sea.valid_until > now()
    order by sea.created_at desc
    limit 1
    for update;

    if not found then
      message_code := 'EXIT_AUTHORIZATION_REQUIRED';
      return next;
      return;
    end if;
  end if;

  update public.student_qr_credentials
  set used_at = now()
  where id = credential_record.id
    and used_at is null;

  if not found then
    message_code := 'QR_ALREADY_USED';
    return next;
    return;
  end if;

  if access_event_type = 'SALIDA' and not student_record.can_leave_alone then
    update public.student_exit_authorizations
    set used_at = now()
    where id = exit_authorization_record.id
      and used_at is null;

    if not found then
      message_code := 'EXIT_AUTHORIZATION_NOT_FOUND';
      return next;
      return;
    end if;
  end if;

  insert into public.access_events (
    student_id,
    recorded_by_profile_id,
    event_type,
    exit_kind,
    validation_kind,
    result,
    notes
  )
  values (
    credential_record.student_id,
    auth.uid(),
    access_event_type,
    access_exit_kind,
    'QR',
    'APROBADO',
    case
      when access_event_type = 'SALIDA' and not student_record.can_leave_alone
        then 'Salida confirmada con QR y autorizacion temporal de apoderado'
      when normalized_event_type = 'RETIRO' then 'Retiro confirmado mediante credencial QR temporal'
      else 'Evento confirmado mediante credencial QR temporal'
    end
  );

  event_type := access_event_type;
  exit_kind := access_exit_kind;
  message_code := 'QR_EVENT_REGISTERED';
  return next;
end;
$$;

grant execute on function public.confirm_student_qr_access_event(uuid, text) to authenticated;

comment on table public.authorization_requests is
  'Solicitudes trazables de autorizacion de salida o retiro iniciadas por estudiantes y respondidas por apoderados.';

comment on table public.student_exit_authorizations is
  'Autorizaciones temporales aprobadas por apoderados y consumidas por porteria al confirmar salida o retiro.';
