create extension if not exists pgcrypto;

create table if not exists public.institution_pickup_settings (
  institution_id bigint primary key references public.institutions(id) on delete cascade,
  pin_ttl_minutes smallint not null default 5 check (pin_ttl_minutes between 1 and 60),
  max_pin_attempts smallint not null default 3 check (max_pin_attempts between 1 and 10),
  student_notification_message text not null default '{guardian_name} está esperando por ti',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.institution_pickup_settings (institution_id)
select id from public.institutions
on conflict (institution_id) do nothing;

create trigger institution_pickup_settings_updated_at
before update on public.institution_pickup_settings
for each row execute procedure public.touch_updated_at();

create table if not exists public.guardian_pickup_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id bigint not null references public.institutions(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  guardian_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'PENDING_STUDENT_RESPONSE' check (status in (
    'PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED',
    'COMPLETED', 'REJECTED_BY_STUDENT', 'CANCELLED_BY_GUARDIAN',
    'EXPIRED', 'BLOCKED_BY_ATTEMPTS', 'REJECTED_AT_GATE'
  )),
  guardian_validation_method text check (guardian_validation_method in ('PIN', 'MANUAL')),
  student_validation_method text check (student_validation_method in ('PIN', 'MANUAL')),
  guardian_validated_at timestamptz,
  student_validated_at timestamptz,
  guardian_validated_by uuid references public.profiles(id) on delete set null,
  student_validated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  student_responded_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  rejection_reason text,
  terminal_note text,
  updated_at timestamptz not null default now()
);

create unique index if not exists guardian_pickup_one_active_student
on public.guardian_pickup_requests(student_id)
where status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED');

create index if not exists guardian_pickup_requests_institution_status
on public.guardian_pickup_requests(institution_id, status, created_at desc);

create trigger guardian_pickup_requests_updated_at
before update on public.guardian_pickup_requests
for each row execute procedure public.touch_updated_at();

-- Los dos flujos coexisten, pero no pueden quedar activos simultáneamente para un mismo estudiante.
create or replace function public.enforce_single_active_exit_request()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(new.student_id);

  if tg_table_name = 'guardian_pickup_requests'
    and new.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
    and exists (
      select 1 from public.authorization_requests ar
      where ar.student_id = new.student_id and ar.status = 'PENDING' and ar.expires_at > now()
    ) then
    raise exception using errcode = '23505', message = 'ACTIVE_EXIT_REQUEST_EXISTS';
  end if;

  if tg_table_name = 'authorization_requests' and new.status = 'PENDING' and new.expires_at > now() then
    if exists (
      select 1 from public.authorization_requests ar
      where ar.student_id = new.student_id and ar.status = 'PENDING' and ar.expires_at > now()
        and ar.id <> new.id
    ) or exists (
      select 1 from public.guardian_pickup_requests r
      where r.student_id = new.student_id
        and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
    ) then
      raise exception using errcode = '23505', message = 'ACTIVE_EXIT_REQUEST_EXISTS';
    end if;
  end if;

  return new;
end;
$$;

create trigger guardian_pickup_single_active
before insert or update of status on public.guardian_pickup_requests
for each row execute procedure public.enforce_single_active_exit_request();

create trigger authorization_request_single_active
before insert or update of status on public.authorization_requests
for each row execute procedure public.enforce_single_active_exit_request();

create table if not exists public.guardian_pickup_pins (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.guardian_pickup_requests(id) on delete cascade,
  actor_type text not null check (actor_type in ('GUARDIAN', 'STUDENT')),
  pin_hash text not null,
  pin_ciphertext bytea not null,
  failed_attempts smallint not null default 0,
  max_attempts smallint not null check (max_attempts between 1 and 10),
  expires_at timestamptz not null,
  validated_at timestamptz,
  used_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, actor_type)
);

create table if not exists public.guardian_pickup_audit_events (
  id bigint generated by default as identity primary key,
  request_id uuid not null references public.guardian_pickup_requests(id) on delete cascade,
  institution_id bigint not null references public.institutions(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  performed_by_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  actor_type text check (actor_type in ('GUARDIAN', 'STUDENT')),
  result text not null check (result in ('SUCCESS', 'FAILURE', 'INFO')),
  method text check (method in ('PIN', 'MANUAL', 'SYSTEM')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists guardian_pickup_audit_request
on public.guardian_pickup_audit_events(request_id, occurred_at desc);

create table if not exists public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  institution_id bigint not null references public.institutions(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  entity_type text not null,
  entity_id uuid not null,
  channel text not null default 'IN_APP',
  delivery_status text not null default 'DELIVERED',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- El secreto de cifrado queda aislado de la API pública. Los PIN nunca se guardan en texto plano.
create table if not exists public.guardian_pickup_secrets (
  singleton boolean primary key default true check (singleton),
  encryption_key text not null
);

insert into public.guardian_pickup_secrets (singleton, encryption_key)
values (true, encode(gen_random_bytes(32), 'hex'))
on conflict (singleton) do nothing;

revoke all on public.guardian_pickup_secrets from public, anon, authenticated;

alter table public.institution_pickup_settings enable row level security;
alter table public.guardian_pickup_requests enable row level security;
alter table public.guardian_pickup_pins enable row level security;
alter table public.guardian_pickup_audit_events enable row level security;
alter table public.internal_notifications enable row level security;

create policy "institution users can view pickup settings"
on public.institution_pickup_settings for select to authenticated
using (
  institution_id = public.current_user_institution_id()
  or exists (
    select 1 from public.guardian_students gs
    join public.students s on s.id = gs.student_id
    where gs.guardian_profile_id = auth.uid() and s.institution_id = institution_pickup_settings.institution_id
  )
  or exists (
    select 1 from public.student_profiles sp
    where sp.profile_id = auth.uid() and sp.institution_id = institution_pickup_settings.institution_id
  )
);

create policy "admins can manage pickup settings"
on public.institution_pickup_settings for all to authenticated
using (institution_id = public.current_user_institution_id() and public.current_user_role() = 'ADMIN')
with check (institution_id = public.current_user_institution_id() and public.current_user_role() = 'ADMIN');

create policy "participants and gate can view pickup requests"
on public.guardian_pickup_requests for select to authenticated
using (
  guardian_profile_id = auth.uid()
  or exists (select 1 from public.student_profiles sp where sp.profile_id = auth.uid() and sp.student_id = student_id)
  or (institution_id = public.current_user_institution_id() and public.current_user_role() in ('ADMIN', 'PORTERIA'))
);

create policy "participants and gate can view pickup audit"
on public.guardian_pickup_audit_events for select to authenticated
using (
  exists (
    select 1 from public.guardian_pickup_requests r
    where r.id = request_id and (
      r.guardian_profile_id = auth.uid()
      or exists (select 1 from public.student_profiles sp where sp.profile_id = auth.uid() and sp.student_id = r.student_id)
      or (r.institution_id = public.current_user_institution_id() and public.current_user_role() in ('ADMIN', 'PORTERIA'))
    )
  )
);

create policy "users can view own internal notifications"
on public.internal_notifications for select to authenticated
using (recipient_profile_id = auth.uid());

create or replace function public.generate_secure_five_digit_pin()
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  bytes bytea;
  value bigint;
begin
  bytes := gen_random_bytes(4);
  value := get_byte(bytes, 0)::bigint * 16777216
    + get_byte(bytes, 1)::bigint * 65536
    + get_byte(bytes, 2)::bigint * 256
    + get_byte(bytes, 3)::bigint;
  return lpad((value % 100000)::text, 5, '0');
end;
$$;

revoke all on function public.generate_secure_five_digit_pin() from public, anon, authenticated;

create or replace function public.create_guardian_pickup_request(p_student_id bigint)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare
  student_record public.students%rowtype;
  settings_record public.institution_pickup_settings%rowtype;
  guardian_name text;
begin
  if auth.uid() is null or public.current_user_role() <> 'APODERADO' then
    return query select null::uuid, 'PICKUP_FORBIDDEN'::text; return;
  end if;

  select s.* into student_record from public.students s
  join public.guardian_students gs on gs.student_id = s.id
  where s.id = p_student_id and gs.guardian_profile_id = auth.uid()
    and gs.relation_type in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO')
  for update of s;

  if not found then return query select null::uuid, 'PICKUP_NOT_AUTHORIZED'::text; return; end if;
  if not student_record.is_in_institution then return query select null::uuid, 'PICKUP_STUDENT_NOT_INSIDE'::text; return; end if;

  with expired as (
    update public.guardian_pickup_requests
    set status = 'EXPIRED'
    where student_id = p_student_id
      and status in ('PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
      and expires_at <= now()
    returning id, institution_id
  )
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, performed_by_profile_id, event_type, result, method)
  select id, institution_id, auth.uid(), 'REQUEST_EXPIRED', 'INFO', 'SYSTEM' from expired;
  update public.guardian_pickup_pins p
  set invalidated_at = now()
  where p.request_id in (
    select r.id from public.guardian_pickup_requests r
    where r.student_id = p_student_id and r.status = 'EXPIRED'
  ) and p.invalidated_at is null;

  select r.id into request_id from public.guardian_pickup_requests r
  where r.student_id = p_student_id and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
  limit 1;
  if request_id is not null then return query select request_id, 'PICKUP_ALREADY_ACTIVE'::text; return; end if;

  insert into public.institution_pickup_settings (institution_id) values (student_record.institution_id)
  on conflict (institution_id) do nothing;
  select * into settings_record from public.institution_pickup_settings where institution_id = student_record.institution_id;

  insert into public.guardian_pickup_requests (institution_id, student_id, guardian_profile_id)
  values (student_record.institution_id, student_record.id, auth.uid()) returning id into request_id;

  select trim(concat_ws(' ', first_name, last_name)) into guardian_name from public.profiles where id = auth.uid();

  insert into public.internal_notifications (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
  select sp.profile_id, student_record.institution_id, 'GUARDIAN_PICKUP_REQUEST', 'Solicitud de retiro',
    replace(settings_record.student_notification_message, '{guardian_name}', coalesce(nullif(guardian_name, ''), 'Tu apoderado')),
    'GUARDIAN_PICKUP_REQUEST', request_id
  from public.student_profiles sp where sp.student_id = student_record.id;

  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method)
  values (request_id, student_record.institution_id, auth.uid(), auth.uid(), 'REQUEST_CREATED', 'SUCCESS', 'SYSTEM');

  return query select request_id, 'PICKUP_REQUEST_CREATED'::text;
exception when unique_violation then
  select r.id into request_id from public.guardian_pickup_requests r
  where r.student_id = p_student_id and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') limit 1;
  return query select request_id, 'PICKUP_ALREADY_ACTIVE'::text;
end;
$$;

create or replace function public.respond_guardian_pickup_request(p_request_id uuid, p_accept boolean)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  request_record public.guardian_pickup_requests%rowtype;
  settings_record public.institution_pickup_settings%rowtype;
  guardian_pin text;
  student_pin text;
  encryption_key text;
  student_profile_id uuid;
begin
  if auth.uid() is null or public.current_user_role() <> 'ESTUDIANTE' then
    return query select p_request_id, 'PICKUP_FORBIDDEN'::text; return;
  end if;

  select r.* into request_record from public.guardian_pickup_requests r
  where r.id = p_request_id and exists (
    select 1 from public.student_profiles sp where sp.profile_id = auth.uid() and sp.student_id = r.student_id
  ) for update;
  if not found then return query select p_request_id, 'PICKUP_FORBIDDEN'::text; return; end if;
  if request_record.status <> 'PENDING_STUDENT_RESPONSE' then
    return query select p_request_id, 'PICKUP_NOT_ALLOWED'::text; return;
  end if;

  if not p_accept then
    update public.guardian_pickup_requests set status = 'REJECTED_BY_STUDENT', student_responded_at = now()
    where id = request_record.id;
    insert into public.internal_notifications (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
    values (request_record.guardian_profile_id, request_record.institution_id, 'PICKUP_REJECTED', 'Retiro rechazado',
      'El estudiante rechazó la solicitud de retiro.', 'GUARDIAN_PICKUP_REQUEST', request_record.id);
    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, actor_type, result, method)
    values (request_record.id, request_record.institution_id, auth.uid(), auth.uid(), 'STUDENT_REJECTED', 'STUDENT', 'SUCCESS', 'SYSTEM');
    return query select request_record.id, 'PICKUP_REJECTED_BY_STUDENT'::text; return;
  end if;

  if not exists (select 1 from public.students s where s.id = request_record.student_id and s.is_in_institution) then
    return query select p_request_id, 'PICKUP_STUDENT_NOT_INSIDE'::text; return;
  end if;
  if not exists (select 1 from public.guardian_students gs where gs.student_id = request_record.student_id
    and gs.guardian_profile_id = request_record.guardian_profile_id
    and gs.relation_type in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO')) then
    return query select p_request_id, 'PICKUP_NOT_AUTHORIZED'::text; return;
  end if;

  select * into settings_record from public.institution_pickup_settings where institution_id = request_record.institution_id;
  select s.encryption_key into encryption_key from public.guardian_pickup_secrets s where singleton;
  guardian_pin := public.generate_secure_five_digit_pin();
  student_pin := public.generate_secure_five_digit_pin();
  while student_pin = guardian_pin loop student_pin := public.generate_secure_five_digit_pin(); end loop;

  update public.guardian_pickup_requests set status = 'PENDING_GUARD_VALIDATION', student_responded_at = now(),
    expires_at = now() + make_interval(mins => settings_record.pin_ttl_minutes)
  where id = request_record.id;

  insert into public.guardian_pickup_pins (request_id, actor_type, pin_hash, pin_ciphertext, max_attempts, expires_at)
  values
    (request_record.id, 'GUARDIAN', crypt(guardian_pin, gen_salt('bf')), pgp_sym_encrypt(guardian_pin, encryption_key), settings_record.max_pin_attempts, now() + make_interval(mins => settings_record.pin_ttl_minutes)),
    (request_record.id, 'STUDENT', crypt(student_pin, gen_salt('bf')), pgp_sym_encrypt(student_pin, encryption_key), settings_record.max_pin_attempts, now() + make_interval(mins => settings_record.pin_ttl_minutes));

  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, actor_type, result, method)
  values (request_record.id, request_record.institution_id, auth.uid(), auth.uid(), 'STUDENT_ACCEPTED_PINS_CREATED', 'STUDENT', 'SUCCESS', 'SYSTEM');

  insert into public.internal_notifications (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
  values (request_record.guardian_profile_id, request_record.institution_id, 'PICKUP_ACCEPTED', 'Estudiante en camino',
    'El estudiante aceptó. Presenten ambos PIN en portería.', 'GUARDIAN_PICKUP_REQUEST', request_record.id);

  return query select request_record.id, 'PICKUP_ACCEPTED_PINS_CREATED'::text;
end;
$$;

create or replace function public.get_my_guardian_pickup_pin(p_request_id uuid)
returns table (request_id uuid, actor_type text, pin text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare encryption_key text;
begin
  select s.encryption_key into encryption_key from public.guardian_pickup_secrets s where singleton;
  return query
  select r.id, p.actor_type, pgp_sym_decrypt(p.pin_ciphertext, encryption_key), p.expires_at
  from public.guardian_pickup_requests r
  join public.guardian_pickup_pins p on p.request_id = r.id
  where r.id = p_request_id and p.invalidated_at is null and p.used_at is null and p.expires_at > now()
    and ((p.actor_type = 'GUARDIAN' and r.guardian_profile_id = auth.uid())
      or (p.actor_type = 'STUDENT' and exists (
        select 1 from public.student_profiles sp where sp.profile_id = auth.uid() and sp.student_id = r.student_id
      )));
end;
$$;

create or replace function public.validate_guardian_pickup_pin(p_request_id uuid, p_actor_type text, p_pin text)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  request_record public.guardian_pickup_requests%rowtype;
  pin_record public.guardian_pickup_pins%rowtype;
  normalized_actor text := upper(trim(p_actor_type));
  new_attempts integer;
begin
  if auth.uid() is null or public.current_user_role() not in ('ADMIN', 'PORTERIA') then
    return query select p_request_id, 'PICKUP_FORBIDDEN'::text; return;
  end if;
  if normalized_actor not in ('GUARDIAN', 'STUDENT') or p_pin !~ '^[0-9]{5}$' then
    return query select p_request_id, 'PICKUP_INVALID_PIN'::text; return;
  end if;

  select r.* into request_record from public.guardian_pickup_requests r
  where r.id = p_request_id and r.institution_id = public.current_user_institution_id() for update;
  if not found then return query select p_request_id, 'PICKUP_FORBIDDEN'::text; return; end if;
  if request_record.status = 'COMPLETED' then
    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method)
    values (request_record.id, request_record.institution_id, auth.uid(), 'PIN_REUSE_ATTEMPT', normalized_actor, 'FAILURE', 'PIN');
    return query select p_request_id, 'PICKUP_PIN_BLOCKED'::text; return;
  end if;
  if request_record.status not in ('PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') then
    return query select p_request_id, 'PICKUP_NOT_ALLOWED'::text; return;
  end if;
  if request_record.expires_at <= now() then
    update public.guardian_pickup_requests set status = 'EXPIRED' where id = request_record.id;
    update public.guardian_pickup_pins p set invalidated_at = now() where p.request_id = request_record.id and p.invalidated_at is null;
    insert into public.guardian_pickup_audit_events (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method)
    values (request_record.id, request_record.institution_id, auth.uid(), 'EXPIRED_PIN_ATTEMPT', normalized_actor, 'FAILURE', 'PIN');
    return query select p_request_id, 'PICKUP_PIN_EXPIRED'::text; return;
  end if;

  select p.* into pin_record from public.guardian_pickup_pins p
  where p.request_id = request_record.id and p.actor_type = normalized_actor for update;
  if pin_record.invalidated_at is not null or pin_record.used_at is not null or pin_record.failed_attempts >= pin_record.max_attempts then
    return query select p_request_id, 'PICKUP_PIN_BLOCKED'::text; return;
  end if;
  if pin_record.validated_at is not null then return query select p_request_id, 'PICKUP_ACTOR_ALREADY_VALIDATED'::text; return; end if;

  if crypt(p_pin, pin_record.pin_hash) <> pin_record.pin_hash then
    new_attempts := pin_record.failed_attempts + 1;
    update public.guardian_pickup_pins set failed_attempts = new_attempts where id = pin_record.id;
    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method, metadata)
    values (request_record.id, request_record.institution_id, auth.uid(), 'PIN_VALIDATION', normalized_actor, 'FAILURE', 'PIN', jsonb_build_object('failed_attempts', new_attempts));
    if new_attempts >= pin_record.max_attempts then
      update public.guardian_pickup_requests set status = 'BLOCKED_BY_ATTEMPTS' where id = request_record.id;
      update public.guardian_pickup_pins p set invalidated_at = now() where p.request_id = request_record.id and p.invalidated_at is null;
      return query select p_request_id, 'PICKUP_BLOCKED_BY_ATTEMPTS'::text; return;
    end if;
    return query select p_request_id, 'PICKUP_INVALID_PIN'::text; return;
  end if;

  update public.guardian_pickup_pins set validated_at = now() where id = pin_record.id;
  if normalized_actor = 'GUARDIAN' then
    update public.guardian_pickup_requests set guardian_validation_method = 'PIN', guardian_validated_at = now(), guardian_validated_by = auth.uid()
    where id = request_record.id;
  else
    update public.guardian_pickup_requests set student_validation_method = 'PIN', student_validated_at = now(), student_validated_by = auth.uid()
    where id = request_record.id;
  end if;
  update public.guardian_pickup_requests set status = 'BOTH_VALIDATED'
  where id = request_record.id and guardian_validation_method is not null and student_validation_method is not null;
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method)
  values (request_record.id, request_record.institution_id, auth.uid(), 'PIN_VALIDATION', normalized_actor, 'SUCCESS', 'PIN');
  return query select p_request_id, 'PICKUP_PIN_VALIDATED'::text;
end;
$$;

create or replace function public.manually_validate_guardian_pickup_actor(
  p_request_id uuid, p_actor_type text, p_reason text, p_note text
)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare request_record public.guardian_pickup_requests%rowtype; normalized_actor text := upper(trim(p_actor_type));
begin
  if auth.uid() is null or public.current_user_role() not in ('ADMIN', 'PORTERIA') then
    return query select p_request_id, 'PICKUP_FORBIDDEN'::text; return;
  end if;
  if normalized_actor not in ('GUARDIAN', 'STUDENT') or nullif(trim(p_reason), '') is null or nullif(trim(p_note), '') is null then
    return query select p_request_id, 'PICKUP_CONTINGENCY_DETAILS_REQUIRED'::text; return;
  end if;
  select r.* into request_record from public.guardian_pickup_requests r
  where r.id = p_request_id and r.institution_id = public.current_user_institution_id() for update;
  if not found or request_record.status <> 'PENDING_GUARD_VALIDATION' or request_record.expires_at <= now() then
    return query select p_request_id, 'PICKUP_NOT_ALLOWED'::text; return;
  end if;
  if not exists (select 1 from public.students s where s.id = request_record.student_id and s.is_in_institution)
    or not exists (select 1 from public.guardian_students gs where gs.student_id = request_record.student_id
      and gs.guardian_profile_id = request_record.guardian_profile_id
      and gs.relation_type in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO')) then
    return query select p_request_id, 'PICKUP_NOT_AUTHORIZED'::text; return;
  end if;
  if normalized_actor = 'GUARDIAN' then
    update public.guardian_pickup_requests set guardian_validation_method = 'MANUAL', guardian_validated_at = now(), guardian_validated_by = auth.uid()
    where id = request_record.id and guardian_validation_method is null;
  else
    update public.guardian_pickup_requests set student_validation_method = 'MANUAL', student_validated_at = now(), student_validated_by = auth.uid()
    where id = request_record.id and student_validation_method is null;
  end if;
  update public.guardian_pickup_pins p set invalidated_at = now()
  where p.request_id = request_record.id and p.actor_type = normalized_actor and p.invalidated_at is null;
  update public.guardian_pickup_requests set status = 'BOTH_VALIDATED'
  where id = request_record.id and guardian_validation_method is not null and student_validation_method is not null;
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method, reason, metadata)
  values (request_record.id, request_record.institution_id, auth.uid(), 'MANUAL_VALIDATION', normalized_actor, 'SUCCESS', 'MANUAL', trim(p_reason), jsonb_build_object('note', trim(p_note)));
  return query select p_request_id, 'PICKUP_MANUAL_VALIDATED'::text;
end;
$$;

create or replace function public.confirm_guardian_pickup(p_request_id uuid)
returns table (request_id uuid, event_id bigint, message_code text)
language plpgsql security definer set search_path = public as $$
declare request_record public.guardian_pickup_requests%rowtype; event_identifier bigint;
begin
  if auth.uid() is null or public.current_user_role() not in ('ADMIN', 'PORTERIA') then
    return query select p_request_id, null::bigint, 'PICKUP_FORBIDDEN'::text; return;
  end if;
  select r.* into request_record from public.guardian_pickup_requests r
  where r.id = p_request_id and r.institution_id = public.current_user_institution_id() for update;
  if not found or request_record.status <> 'BOTH_VALIDATED' or request_record.guardian_validation_method is null or request_record.student_validation_method is null then
    return query select p_request_id, null::bigint, 'PICKUP_NOT_READY'::text; return;
  end if;
  if request_record.expires_at <= now() then
    update public.guardian_pickup_requests set status = 'EXPIRED' where id = request_record.id;
    update public.guardian_pickup_pins p set invalidated_at = now() where p.request_id = request_record.id and p.invalidated_at is null;
    return query select p_request_id, null::bigint, 'PICKUP_PIN_EXPIRED'::text; return;
  end if;
  if not exists (select 1 from public.students s where s.id = request_record.student_id and s.is_in_institution) then
    return query select p_request_id, null::bigint, 'PICKUP_STUDENT_NOT_INSIDE'::text; return;
  end if;
  if not exists (select 1 from public.guardian_students gs where gs.student_id = request_record.student_id
    and gs.guardian_profile_id = request_record.guardian_profile_id
    and gs.relation_type in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO')) then
    return query select p_request_id, null::bigint, 'PICKUP_NOT_AUTHORIZED'::text; return;
  end if;
  insert into public.access_events (student_id, actor_profile_id, recorded_by_profile_id, event_type, exit_kind,
    validation_kind, result, notes, authenticator_required, authenticator_presented, policy_snapshot)
  values (request_record.student_id, request_record.guardian_profile_id, auth.uid(), 'SALIDA', 'RETIRO_AUTORIZADO',
    case when request_record.guardian_validation_method = 'PIN' and request_record.student_validation_method = 'PIN' then 'PIN'::public.validation_method else 'MANUAL'::public.validation_method end,
    'APROBADO', 'Retiro confirmado por portería con validación dual.', true,
    request_record.guardian_validation_method = 'PIN' or request_record.student_validation_method = 'PIN',
    jsonb_build_object('pickup_request_id', request_record.id, 'guardian_method', request_record.guardian_validation_method,
      'student_method', request_record.student_validation_method)) returning id into event_identifier;
  update public.guardian_pickup_pins p set used_at = now(), invalidated_at = coalesce(p.invalidated_at, now())
  where p.request_id = request_record.id;
  update public.guardian_pickup_requests set status = 'COMPLETED', completed_at = now(), completed_by = auth.uid()
  where id = request_record.id;
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method, metadata)
  values (request_record.id, request_record.institution_id, request_record.guardian_profile_id, auth.uid(), 'PICKUP_COMPLETED', 'SUCCESS', 'SYSTEM', jsonb_build_object('access_event_id', event_identifier));
  return query select p_request_id, event_identifier, 'PICKUP_COMPLETED'::text;
end;
$$;

create or replace function public.cancel_guardian_pickup_request(p_request_id uuid)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare request_record public.guardian_pickup_requests%rowtype;
begin
  select r.* into request_record from public.guardian_pickup_requests r
  where r.id = p_request_id and r.guardian_profile_id = auth.uid() for update;
  if not found or request_record.status not in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') then
    return query select p_request_id, 'PICKUP_NOT_ALLOWED'::text; return;
  end if;
  update public.guardian_pickup_requests set status = 'CANCELLED_BY_GUARDIAN', cancelled_at = now(),
    terminal_note = 'Cancelado por el apoderado desde el dashboard'
  where id = request_record.id;
  update public.guardian_pickup_pins p set invalidated_at = now() where p.request_id = request_record.id and p.invalidated_at is null;
  insert into public.internal_notifications (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
  select sp.profile_id, request_record.institution_id, 'PICKUP_CANCELLED', 'Retiro cancelado',
    'El apoderado canceló la solicitud de retiro.', 'GUARDIAN_PICKUP_REQUEST', request_record.id
  from public.student_profiles sp where sp.student_id = request_record.student_id;
  insert into public.guardian_pickup_audit_events (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method, reason)
  values (request_record.id, request_record.institution_id, auth.uid(), auth.uid(), 'REQUEST_CANCELLED', 'SUCCESS', 'SYSTEM', 'Cancelado por el apoderado desde el dashboard');
  return query select p_request_id, 'PICKUP_CANCELLED'::text;
end;
$$;

create or replace function public.reject_guardian_pickup_at_gate(p_request_id uuid, p_reason text, p_note text)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare request_record public.guardian_pickup_requests%rowtype;
begin
  if public.current_user_role() not in ('ADMIN', 'PORTERIA') or nullif(trim(p_reason), '') is null or nullif(trim(p_note), '') is null then
    return query select p_request_id, 'PICKUP_REJECTION_DETAILS_REQUIRED'::text; return;
  end if;
  select r.* into request_record from public.guardian_pickup_requests r where r.id = p_request_id
    and r.institution_id = public.current_user_institution_id() and r.status in ('PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') for update;
  if not found then return query select p_request_id, 'PICKUP_NOT_ALLOWED'::text; return; end if;
  update public.guardian_pickup_requests set status = 'REJECTED_AT_GATE', rejection_reason = trim(p_reason), terminal_note = trim(p_note)
  where id = request_record.id;
  update public.guardian_pickup_pins p set invalidated_at = now() where p.request_id = request_record.id and p.invalidated_at is null;
  insert into public.internal_notifications (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
  select recipient_id, request_record.institution_id, 'PICKUP_REJECTED_AT_GATE', 'Retiro rechazado en portería',
    'Portería rechazó el retiro. Motivo: ' || trim(p_reason), 'GUARDIAN_PICKUP_REQUEST', request_record.id
  from (
    select request_record.guardian_profile_id as recipient_id
    union
    select sp.profile_id from public.student_profiles sp where sp.student_id = request_record.student_id
  ) recipients;
  insert into public.guardian_pickup_audit_events (request_id, institution_id, performed_by_profile_id, event_type, result, method, reason, metadata)
  values (request_record.id, request_record.institution_id, auth.uid(), 'REJECTED_AT_GATE', 'FAILURE', 'SYSTEM', trim(p_reason), jsonb_build_object('note', trim(p_note)));
  return query select p_request_id, 'PICKUP_REJECTED_AT_GATE'::text;
end;
$$;

create or replace function public.list_guardian_pickup_requests()
returns table (
  request_id uuid, institution_id bigint, student_id bigint, student_name text, guardian_name text,
  status text, created_at timestamptz, updated_at timestamptz, student_responded_at timestamptz, expires_at timestamptz,
  guardian_validation_method text, student_validation_method text, guardian_failed_attempts smallint,
  student_failed_attempts smallint, max_attempts smallint, notification_message text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.institution_id, r.student_id, trim(concat_ws(' ', s.first_name, s.last_name)),
    trim(concat_ws(' ', gp.first_name, gp.last_name)), r.status, r.created_at, r.updated_at, r.student_responded_at, r.expires_at,
    r.guardian_validation_method, r.student_validation_method,
    coalesce(gp_pin.failed_attempts, 0), coalesce(sp_pin.failed_attempts, 0),
    coalesce(gp_pin.max_attempts, sp_pin.max_attempts, settings.max_pin_attempts),
    coalesce((select n.body from public.internal_notifications n where n.entity_id = r.id
      and n.notification_type = 'GUARDIAN_PICKUP_REQUEST' order by n.created_at desc limit 1),
      replace(settings.student_notification_message, '{guardian_name}', trim(concat_ws(' ', gp.first_name, gp.last_name))))
  from public.guardian_pickup_requests r
  join public.students s on s.id = r.student_id
  join public.profiles gp on gp.id = r.guardian_profile_id
  join public.institution_pickup_settings settings on settings.institution_id = r.institution_id
  left join public.guardian_pickup_pins gp_pin on gp_pin.request_id = r.id and gp_pin.actor_type = 'GUARDIAN'
  left join public.guardian_pickup_pins sp_pin on sp_pin.request_id = r.id and sp_pin.actor_type = 'STUDENT'
  where r.guardian_profile_id = auth.uid()
    or exists (select 1 from public.student_profiles profile_link where profile_link.profile_id = auth.uid() and profile_link.student_id = r.student_id)
    or (r.institution_id = public.current_user_institution_id() and public.current_user_role() in ('ADMIN', 'PORTERIA'))
  order by case when r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') then 0 else 1 end,
    r.created_at desc;
$$;

grant execute on function public.create_guardian_pickup_request(bigint) to authenticated;
grant execute on function public.respond_guardian_pickup_request(uuid, boolean) to authenticated;
grant execute on function public.get_my_guardian_pickup_pin(uuid) to authenticated;
grant execute on function public.validate_guardian_pickup_pin(uuid, text, text) to authenticated;
grant execute on function public.manually_validate_guardian_pickup_actor(uuid, text, text, text) to authenticated;
grant execute on function public.confirm_guardian_pickup(uuid) to authenticated;
grant execute on function public.cancel_guardian_pickup_request(uuid) to authenticated;
grant execute on function public.reject_guardian_pickup_at_gate(uuid, text, text) to authenticated;
grant execute on function public.list_guardian_pickup_requests() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guardian_pickup_requests') then
      alter publication supabase_realtime add table public.guardian_pickup_requests;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_notifications') then
      alter publication supabase_realtime add table public.internal_notifications;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
