-- Permite que un estudiante solicite retiro aunque tenga habilitada la salida autónoma.
-- Cada apoderado recibe una copia de la solicitud; solo una aprobación puede tomarla.
alter table public.authorization_requests
  add column if not exists claim_group_id uuid;

create index if not exists authorization_requests_claim_group_idx
  on public.authorization_requests(claim_group_id, status, expires_at);

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
        and (new.claim_group_id is null or ar.claim_group_id is null or ar.claim_group_id <> new.claim_group_id)
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

create or replace function public.create_student_pickup_request(p_reason text default null)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare
  student_record public.students%rowtype;
  group_identifier uuid := gen_random_uuid();
  first_request uuid;
  guardian_count integer;
begin
  if auth.uid() is null or public.current_user_role() <> 'ESTUDIANTE' then
    return query select null::uuid, 'AUTH_REQUEST_FORBIDDEN'::text; return;
  end if;

  select s.* into student_record
  from public.students s
  join public.student_profiles sp on sp.student_id = s.id
  where sp.profile_id = auth.uid()
  for update of s;
  if not found then return query select null::uuid, 'STUDENT_PROFILE_NOT_LINKED'::text; return; end if;
  if not student_record.is_in_institution then
    return query select null::uuid, 'AUTH_REQUEST_STUDENT_NOT_INSIDE'::text; return;
  end if;

  if exists (
    select 1 from public.guardian_pickup_requests r
    where r.student_id = student_record.id
      and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
  ) or exists (
    select 1 from public.authorization_requests ar
    where ar.student_id = student_record.id and ar.status = 'PENDING' and ar.expires_at > now()
  ) then
    select ar.id into request_id from public.authorization_requests ar
    where ar.student_id = student_record.id and ar.status = 'PENDING' and ar.expires_at > now()
    order by ar.requested_at desc limit 1;
    return query select request_id, 'AUTH_REQUEST_PENDING'::text; return;
  end if;

  insert into public.authorization_requests (
    institution_id, student_id, guardian_profile_id, requested_by_profile_id,
    request_type, reason, expires_at, claim_group_id
  )
  select student_record.institution_id, student_record.id, gs.guardian_profile_id, auth.uid(),
    'EXIT_ALONE', nullif(trim(coalesce(p_reason, '')), ''), now() + interval '15 minutes', group_identifier
  from public.guardian_students gs
  where gs.student_id = student_record.id
    and gs.relation_type in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO')
    and public.guardian_student_link_is_active(gs)
  group by gs.guardian_profile_id;

  get diagnostics guardian_count = row_count;
  if guardian_count = 0 then return query select null::uuid, 'AUTH_REQUEST_NO_GUARDIAN'::text; return; end if;

  select ar.id into first_request from public.authorization_requests ar
  where ar.claim_group_id = group_identifier order by ar.requested_at limit 1;
  insert into public.internal_notifications (
    recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id
  )
  select ar.guardian_profile_id, ar.institution_id, 'STUDENT_EXIT_REQUEST', 'Solicitud de retiro',
    'El estudiante solicita ser retirado. El primer apoderado que acepte tomará el proceso.',
    'AUTHORIZATION_REQUEST', ar.id
  from public.authorization_requests ar where ar.claim_group_id = group_identifier;

  return query select first_request, 'AUTH_REQUEST_CREATED'::text;
exception when unique_violation then
  select ar.id into request_id from public.authorization_requests ar
  where ar.student_id = student_record.id and ar.status = 'PENDING' and ar.expires_at > now()
  order by ar.requested_at desc limit 1;
  return query select request_id, 'AUTH_REQUEST_PENDING'::text;
end;
$$;

create or replace function public.claim_student_pickup_authorization(
  p_request_id uuid, p_note text default null
)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  request_record public.authorization_requests%rowtype;
  response_record record;
begin
  if auth.uid() is null or public.current_user_role() <> 'APODERADO' then
    return query select p_request_id, 'AUTH_REQUEST_FORBIDDEN'::text; return;
  end if;

  select ar.* into request_record
  from public.authorization_requests ar
  where ar.id = p_request_id and ar.guardian_profile_id = auth.uid()
  for update;
  if not found then return query select p_request_id, 'AUTH_REQUEST_FORBIDDEN'::text; return; end if;
  perform pg_advisory_xact_lock(request_record.student_id);

  if request_record.status <> 'PENDING' then
    return query select p_request_id, 'AUTH_REQUEST_NOT_ALLOWED'::text; return;
  end if;
  if request_record.expires_at <= now() then
    update public.authorization_requests set status = 'EXPIRED', responded_at = now() where id = p_request_id;
    return query select p_request_id, 'AUTH_REQUEST_EXPIRED'::text; return;
  end if;

  -- Se reserva el grupo antes de crear el retiro dual. Así el trigger de
  -- exclusión no confunde las copias pendientes con otra solicitud activa.
  update public.authorization_requests
  set status = 'CANCELLED', responded_at = coalesce(responded_at, now()),
      guardian_response_note = 'Otro apoderado tomó la solicitud.'
  where claim_group_id = request_record.claim_group_id
    and id <> p_request_id and status = 'PENDING';

  select * into response_record from public.respond_to_authorization_request(p_request_id, 'APPROVED', p_note);
  if response_record.message_code <> 'AUTH_REQUEST_APPROVED_PICKUP_PENDING' then
    update public.authorization_requests
    set status = 'PENDING', responded_at = null, guardian_response_note = null
    where claim_group_id = request_record.claim_group_id and status = 'CANCELLED'
      and guardian_response_note = 'Otro apoderado tomó la solicitud.';
  end if;
  return query select response_record.request_id, response_record.message_code;
end;
$$;

revoke all on function public.create_student_pickup_request(text) from public, anon;
grant execute on function public.create_student_pickup_request(text) to authenticated;
revoke all on function public.claim_student_pickup_authorization(uuid, text) from public, anon;
grant execute on function public.claim_student_pickup_authorization(uuid, text) to authenticated;

notify pgrst, 'reload schema';
