-- Vincula cada retiro con la autorización exacta que lo habilitó y consume los PIN
-- en su primera validación exitosa.

alter table public.guardian_pickup_requests
  add column if not exists authorization_link_id bigint
  references public.guardian_students(id) on delete restrict;

create index if not exists guardian_pickup_requests_authorization_link_idx
on public.guardian_pickup_requests(authorization_link_id)
where authorization_link_id is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role public.app_role := 'APODERADO';
begin
  if new.raw_user_meta_data ->> 'validgate_role' = 'RETIRADOR_AUTORIZADO' then
    requested_role := 'RETIRADOR_AUTORIZADO';
  end if;
  insert into public.profiles (id, email, first_name, last_name, rut, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'validgate_rut')), ''), requested_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.profiles drop constraint if exists profiles_retirador_rut_required_chk;
alter table public.profiles add constraint profiles_retirador_rut_required_chk
check (role <> 'RETIRADOR_AUTORIZADO' or rut is not null) not valid;

alter table public.guardian_pickup_requests
  drop constraint if exists guardian_pickup_requests_status_check;
alter table public.guardian_pickup_requests
  add constraint guardian_pickup_requests_status_check check (status in (
    'PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED',
    'COMPLETED', 'REJECTED_BY_STUDENT', 'CANCELLED_BY_GUARDIAN',
    'CANCELLED_AUTHORIZATION_REVOKED', 'EXPIRED', 'BLOCKED_BY_ATTEMPTS',
    'REJECTED_AT_GATE'
  ));

create or replace function public.enforce_active_pickup_relationship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in (
    'EXPIRED', 'CANCELLED_BY_GUARDIAN', 'CANCELLED_AUTHORIZATION_REVOKED',
    'REJECTED_BY_STUDENT', 'REJECTED_AT_GATE', 'BLOCKED_BY_ATTEMPTS', 'COMPLETED'
  ) then return new; end if;

  if new.authorization_link_id is not null and exists (
    select 1 from public.guardian_students gs
    where gs.id = new.authorization_link_id
      and gs.guardian_profile_id = new.guardian_profile_id
      and gs.student_id = new.student_id
      and public.guardian_student_link_is_active(gs)
  ) then return new; end if;

  if new.authorization_link_id is null and exists (
    select 1 from public.guardian_students gs
    where gs.guardian_profile_id = new.guardian_profile_id
      and gs.student_id = new.student_id
      and public.guardian_student_link_is_active(gs)
  ) then return new; end if;

  raise exception 'Pickup relationship is not active' using errcode = '42501';
end;
$$;

create or replace function public.create_guardian_pickup_request(p_student_id bigint)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare
  student_record public.students%rowtype;
  settings_record public.institution_pickup_settings%rowtype;
  guardian_name text;
  active_link_id bigint;
begin
  if auth.uid() is null or public.current_user_role() not in ('APODERADO', 'RETIRADOR_AUTORIZADO') then
    return query select null::uuid, 'PICKUP_FORBIDDEN'::text; return;
  end if;

  select gs.id into active_link_id
  from public.guardian_students gs
  where gs.student_id = p_student_id and gs.guardian_profile_id = auth.uid()
    and public.guardian_student_link_is_active(gs)
  order by case when gs.relation_type = 'APODERADO' then 0 else 1 end
  limit 1;

  if active_link_id is null then return query select null::uuid, 'PICKUP_NOT_AUTHORIZED'::text; return; end if;
  select * into student_record from public.students where id = p_student_id for update;
  if not found then return query select null::uuid, 'PICKUP_NOT_AUTHORIZED'::text; return; end if;
  if not student_record.is_in_institution then return query select null::uuid, 'PICKUP_STUDENT_NOT_INSIDE'::text; return; end if;

  select r.id into request_id from public.guardian_pickup_requests r
  where r.student_id = p_student_id
    and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') limit 1;
  if request_id is not null then return query select request_id, 'PICKUP_ALREADY_ACTIVE'::text; return; end if;

  insert into public.institution_pickup_settings (institution_id) values (student_record.institution_id)
  on conflict (institution_id) do nothing;
  select * into settings_record from public.institution_pickup_settings
  where institution_id = student_record.institution_id;

  insert into public.guardian_pickup_requests
    (institution_id, student_id, guardian_profile_id, authorization_link_id)
  values (student_record.institution_id, student_record.id, auth.uid(), active_link_id)
  returning id into request_id;

  select trim(concat_ws(' ', first_name, last_name)) into guardian_name
  from public.profiles where id = auth.uid();
  insert into public.internal_notifications
    (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
  select sp.profile_id, student_record.institution_id, 'GUARDIAN_PICKUP_REQUEST', 'Solicitud de retiro',
    replace(settings_record.student_notification_message, '{guardian_name}', coalesce(nullif(guardian_name, ''), 'La persona autorizada')),
    'GUARDIAN_PICKUP_REQUEST', request_id
  from public.student_profiles sp where sp.student_id = student_record.id;

  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method, metadata)
  values (request_id, student_record.institution_id, auth.uid(), auth.uid(), 'REQUEST_CREATED', 'SUCCESS', 'SYSTEM',
    jsonb_build_object('authorization_link_id', active_link_id));
  return query select request_id, 'PICKUP_REQUEST_CREATED'::text;
exception when unique_violation then
  select r.id into request_id from public.guardian_pickup_requests r
  where r.student_id = p_student_id
    and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') limit 1;
  return query select request_id, 'PICKUP_ALREADY_ACTIVE'::text;
end;
$$;

create or replace function public.revoke_authorized_retirador_link(p_relation_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare changed_id bigint; affected_request uuid;
begin
  update public.guardian_students gs set revoked_at = now(), revoked_by_profile_id = auth.uid()
  from public.students s
  where gs.id = p_relation_id and gs.student_id = s.id
    and gs.relation_type = 'RETIRADOR_AUTORIZADO' and gs.revoked_at is null
    and (gs.authorized_by_profile_id = auth.uid()
      or (public.current_user_role() = 'ADMIN' and s.institution_id = public.current_user_institution_id()))
  returning gs.id into changed_id;
  if changed_id is null then return jsonb_build_object('status', 'not_found'); end if;

  for affected_request in
    update public.guardian_pickup_requests
    set status = 'CANCELLED_AUTHORIZATION_REVOKED', cancelled_at = now(),
      terminal_note = 'Autorización temporal revocada'
    where authorization_link_id = changed_id
      and status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
    returning id
  loop
    update public.guardian_pickup_pins set invalidated_at = coalesce(invalidated_at, now())
    where request_id = affected_request;
    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, performed_by_profile_id, event_type, result, method, reason)
    select affected_request, institution_id, auth.uid(), 'AUTHORIZATION_REVOKED', 'FAILURE', 'SYSTEM',
      'Autorización temporal revocada'
    from public.guardian_pickup_requests where id = affected_request;
    insert into public.internal_notifications
      (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
    select recipient_id, r.institution_id, 'PICKUP_AUTHORIZATION_REVOKED',
      'Retiro cancelado', 'La autorización temporal fue revocada y los PIN quedaron invalidados.',
      'GUARDIAN_PICKUP_REQUEST', r.id
    from public.guardian_pickup_requests r
    cross join lateral (
      select r.guardian_profile_id as recipient_id
      union
      select sp.profile_id from public.student_profiles sp where sp.student_id = r.student_id
    ) recipients
    where r.id = affected_request;
  end loop;
  return jsonb_build_object('status', 'revoked');
end;
$$;

create or replace function public.get_my_guardian_pickup_pin(p_request_id uuid)
returns table (request_id uuid, actor_type text, pin text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare encryption_key text;
begin
  select s.encryption_key into encryption_key from public.guardian_pickup_secrets s where singleton;
  return query select r.id, p.actor_type, pgp_sym_decrypt(p.pin_ciphertext, encryption_key), p.expires_at
  from public.guardian_pickup_requests r join public.guardian_pickup_pins p on p.request_id = r.id
  where r.id = p_request_id and p.invalidated_at is null and p.used_at is null
    and p.validated_at is null and p.expires_at > now()
    and ((p.actor_type = 'GUARDIAN' and r.guardian_profile_id = auth.uid())
      or (p.actor_type = 'STUDENT' and exists (
        select 1 from public.student_profiles sp where sp.profile_id = auth.uid() and sp.student_id = r.student_id)));
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
  if request_record.authorization_link_id is not null and not exists (
    select 1 from public.guardian_students gs where gs.id = request_record.authorization_link_id
      and public.guardian_student_link_is_active(gs)
  ) then
    update public.guardian_pickup_requests set status = 'CANCELLED_AUTHORIZATION_REVOKED',
      cancelled_at = now(), terminal_note = 'Autorización temporal no vigente'
    where id = request_record.id;
    update public.guardian_pickup_pins set invalidated_at = coalesce(invalidated_at, now())
    where request_id = request_record.id;
    return query select p_request_id, 'PICKUP_NOT_AUTHORIZED'::text; return;
  end if;
  if request_record.expires_at <= now() then
    update public.guardian_pickup_requests set status = 'EXPIRED' where id = request_record.id;
    update public.guardian_pickup_pins as pickup_pin
    set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
    where pickup_pin.request_id = request_record.id;
    return query select p_request_id, 'PICKUP_PIN_EXPIRED'::text; return;
  end if;

  select p.* into pin_record from public.guardian_pickup_pins p
  where p.request_id = request_record.id and p.actor_type = normalized_actor for update;
  if not found then return query select p_request_id, 'PICKUP_PIN_BLOCKED'::text; return; end if;
  if pin_record.invalidated_at is not null or pin_record.used_at is not null or pin_record.validated_at is not null then
    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method)
    values (request_record.id, request_record.institution_id, auth.uid(), 'PIN_REUSE_ATTEMPT', normalized_actor, 'FAILURE', 'PIN');
    return query select p_request_id, 'PICKUP_PIN_BLOCKED'::text; return;
  end if;
  if pin_record.failed_attempts >= pin_record.max_attempts then
    return query select p_request_id, 'PICKUP_PIN_BLOCKED'::text; return;
  end if;
  if crypt(p_pin, pin_record.pin_hash) <> pin_record.pin_hash then
    new_attempts := pin_record.failed_attempts + 1;
    update public.guardian_pickup_pins set failed_attempts = new_attempts where id = pin_record.id;
    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method, metadata)
    values (request_record.id, request_record.institution_id, auth.uid(), 'PIN_VALIDATION', normalized_actor, 'FAILURE', 'PIN',
      jsonb_build_object('failed_attempts', new_attempts));
    if new_attempts >= pin_record.max_attempts then
      update public.guardian_pickup_requests set status = 'BLOCKED_BY_ATTEMPTS' where id = request_record.id;
      update public.guardian_pickup_pins set invalidated_at = coalesce(invalidated_at, now()) where request_id = request_record.id;
      return query select p_request_id, 'PICKUP_BLOCKED_BY_ATTEMPTS'::text; return;
    end if;
    return query select p_request_id, 'PICKUP_INVALID_PIN'::text; return;
  end if;

  update public.guardian_pickup_pins set validated_at = now(), used_at = now() where id = pin_record.id;
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
  if not found or request_record.status <> 'BOTH_VALIDATED'
    or request_record.guardian_validation_method is null or request_record.student_validation_method is null then
    return query select p_request_id, null::bigint, 'PICKUP_NOT_READY'::text; return;
  end if;
  if request_record.authorization_link_id is not null and not exists (
    select 1 from public.guardian_students gs where gs.id = request_record.authorization_link_id
      and public.guardian_student_link_is_active(gs)
  ) then
    update public.guardian_pickup_requests set status = 'CANCELLED_AUTHORIZATION_REVOKED',
      cancelled_at = now(), terminal_note = 'Autorización temporal no vigente' where id = request_record.id;
    update public.guardian_pickup_pins as pickup_pin
    set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
    where pickup_pin.request_id = request_record.id;
    return query select p_request_id, null::bigint, 'PICKUP_NOT_AUTHORIZED'::text; return;
  end if;
  if request_record.expires_at <= now() then
    update public.guardian_pickup_requests set status = 'EXPIRED' where id = request_record.id;
    update public.guardian_pickup_pins as pickup_pin
    set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
    where pickup_pin.request_id = request_record.id;
    return query select p_request_id, null::bigint, 'PICKUP_PIN_EXPIRED'::text; return;
  end if;
  if not exists (select 1 from public.students where id = request_record.student_id and is_in_institution) then
    return query select p_request_id, null::bigint, 'PICKUP_STUDENT_NOT_INSIDE'::text; return;
  end if;
  insert into public.access_events (student_id, actor_profile_id, recorded_by_profile_id, event_type, exit_kind,
    validation_kind, result, notes, authenticator_required, authenticator_presented, policy_snapshot)
  values (request_record.student_id, request_record.guardian_profile_id, auth.uid(), 'SALIDA', 'RETIRO_AUTORIZADO',
    'PIN', 'APROBADO', 'Retiro confirmado por portería con validación dual.', true, true,
    jsonb_build_object('pickup_request_id', request_record.id, 'authorization_link_id', request_record.authorization_link_id,
      'guardian_method', request_record.guardian_validation_method, 'student_method', request_record.student_validation_method))
  returning id into event_identifier;
  update public.guardian_pickup_pins as pickup_pin
  set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
  where pickup_pin.request_id = request_record.id;
  update public.guardian_pickup_requests set status = 'COMPLETED', completed_at = now(), completed_by = auth.uid()
  where id = request_record.id;
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method, metadata)
  values (request_record.id, request_record.institution_id, request_record.guardian_profile_id, auth.uid(),
    'PICKUP_COMPLETED', 'SUCCESS', 'SYSTEM', jsonb_build_object('access_event_id', event_identifier));
  return query select p_request_id, event_identifier, 'PICKUP_COMPLETED'::text;
end;
$$;

-- Una autorización temporal nunca admite sustitución manual de sus PIN.
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
  if exists (
    select 1 from public.guardian_pickup_requests r
    join public.guardian_students gs on gs.id = r.authorization_link_id
    where r.id = p_request_id and gs.relation_type = 'RETIRADOR_AUTORIZADO'
  ) then return query select p_request_id, 'PICKUP_PIN_REQUIRED'::text; return; end if;
  if normalized_actor not in ('GUARDIAN', 'STUDENT') or nullif(trim(p_reason), '') is null or nullif(trim(p_note), '') is null then
    return query select p_request_id, 'PICKUP_CONTINGENCY_DETAILS_REQUIRED'::text; return;
  end if;
  select r.* into request_record from public.guardian_pickup_requests r
  where r.id = p_request_id and r.institution_id = public.current_user_institution_id() for update;
  if not found or request_record.status <> 'PENDING_GUARD_VALIDATION' or request_record.expires_at <= now() then
    return query select p_request_id, 'PICKUP_NOT_ALLOWED'::text; return;
  end if;
  if normalized_actor = 'GUARDIAN' then
    update public.guardian_pickup_requests set guardian_validation_method = 'MANUAL', guardian_validated_at = now(), guardian_validated_by = auth.uid()
    where id = request_record.id and guardian_validation_method is null;
  else
    update public.guardian_pickup_requests set student_validation_method = 'MANUAL', student_validated_at = now(), student_validated_by = auth.uid()
    where id = request_record.id and student_validation_method is null;
  end if;
  update public.guardian_pickup_pins set invalidated_at = coalesce(invalidated_at, now())
  where request_id = request_record.id and actor_type = normalized_actor;
  update public.guardian_pickup_requests set status = 'BOTH_VALIDATED'
  where id = request_record.id and guardian_validation_method is not null and student_validation_method is not null;
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, performed_by_profile_id, event_type, actor_type, result, method, reason, metadata)
  values (request_record.id, request_record.institution_id, auth.uid(), 'MANUAL_VALIDATION', normalized_actor,
    'SUCCESS', 'MANUAL', trim(p_reason), jsonb_build_object('note', trim(p_note)));
  return query select p_request_id, 'PICKUP_MANUAL_VALIDATED'::text;
end;
$$;

create or replace function public.list_guardian_pickup_requests_v2()
returns table (
  request_id uuid, institution_id bigint, student_id bigint, student_name text, guardian_name text,
  status text, created_at timestamptz, updated_at timestamptz, student_responded_at timestamptz, expires_at timestamptz,
  guardian_validation_method text, student_validation_method text, guardian_failed_attempts smallint,
  student_failed_attempts smallint, max_attempts smallint, notification_message text, pin_only boolean
)
language sql stable security definer set search_path = public as $$
  select r.id, r.institution_id, r.student_id, trim(concat_ws(' ', s.first_name, s.last_name)),
    trim(concat_ws(' ', gp.first_name, gp.last_name)), r.status, r.created_at, r.updated_at, r.student_responded_at, r.expires_at,
    r.guardian_validation_method, r.student_validation_method,
    coalesce(gp_pin.failed_attempts, 0), coalesce(sp_pin.failed_attempts, 0),
    coalesce(gp_pin.max_attempts, sp_pin.max_attempts, settings.max_pin_attempts),
    coalesce((select n.body from public.internal_notifications n where n.entity_id = r.id
      and n.notification_type = 'GUARDIAN_PICKUP_REQUEST' order by n.created_at desc limit 1),
      replace(settings.student_notification_message, '{guardian_name}', trim(concat_ws(' ', gp.first_name, gp.last_name)))),
    coalesce(link.relation_type = 'RETIRADOR_AUTORIZADO', false)
  from public.guardian_pickup_requests r
  join public.students s on s.id = r.student_id
  join public.profiles gp on gp.id = r.guardian_profile_id
  join public.institution_pickup_settings settings on settings.institution_id = r.institution_id
  left join public.guardian_students link on link.id = r.authorization_link_id
  left join public.guardian_pickup_pins gp_pin on gp_pin.request_id = r.id and gp_pin.actor_type = 'GUARDIAN'
  left join public.guardian_pickup_pins sp_pin on sp_pin.request_id = r.id and sp_pin.actor_type = 'STUDENT'
  where r.guardian_profile_id = auth.uid()
    or exists (select 1 from public.student_profiles profile_link where profile_link.profile_id = auth.uid() and profile_link.student_id = r.student_id)
    or (r.institution_id = public.current_user_institution_id() and public.current_user_role() in ('ADMIN', 'PORTERIA'))
  order by case when r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') then 0 else 1 end,
    r.created_at desc;
$$;

revoke all on function public.list_guardian_pickup_requests_v2() from public, anon;
grant execute on function public.list_guardian_pickup_requests_v2() to authenticated;

notify pgrst, 'reload schema';
