-- Vínculos centrados en el estudiante y acceso temporal para retiradores autenticados.

update public.guardian_students
set relation_type = 'APODERADO'
where relation_type = 'APODERADO_PRINCIPAL';

drop index if exists public.guardian_students_one_primary_per_student;

alter table public.guardian_students
  drop constraint if exists guardian_students_guardian_profile_id_student_id_key;

create unique index if not exists guardian_students_one_guardian_relation
on public.guardian_students (guardian_profile_id, student_id)
where relation_type = 'APODERADO';

alter table public.guardian_students
  drop constraint if exists guardian_students_relation_type_chk;

alter table public.guardian_students
  add constraint guardian_students_relation_type_chk
  check (relation_type in ('APODERADO', 'RETIRADOR_AUTORIZADO'));

alter table public.guardian_students
  add column if not exists authorized_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by_profile_id uuid references public.profiles(id) on delete set null;

-- Los retiradores históricos no tenían vigencia. Se conservan como historial revocado
-- y deben ser autorizados nuevamente con un período explícito.
update public.guardian_students
set authorized_by_profile_id = coalesce(authorized_by_profile_id, guardian_profile_id),
    valid_from = coalesce(valid_from, created_at),
    valid_until = coalesce(valid_until, greatest(created_at + interval '1 second', now())),
    revoked_at = coalesce(revoked_at, now()),
    revoked_by_profile_id = coalesce(revoked_by_profile_id, guardian_profile_id)
where relation_type = 'RETIRADOR_AUTORIZADO';

alter table public.guardian_students
  drop constraint if exists guardian_students_validity_chk;

alter table public.guardian_students
  add constraint guardian_students_validity_chk check (
    relation_type = 'APODERADO'
    or (
      relation_type = 'RETIRADOR_AUTORIZADO'
      and authorized_by_profile_id is not null
      and valid_from is not null
      and valid_until is not null
      and valid_until > valid_from
    )
  );

create index if not exists guardian_students_active_retirador_idx
on public.guardian_students (guardian_profile_id, student_id, valid_from, valid_until)
where relation_type = 'RETIRADOR_AUTORIZADO' and revoked_at is null;

create or replace function public.guardian_student_link_is_active(p_link public.guardian_students)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_link.relation_type = 'APODERADO'
    or (
      p_link.relation_type = 'RETIRADOR_AUTORIZADO'
      and p_link.revoked_at is null
      and p_link.valid_from <= now()
      and p_link.valid_until > now()
    );
$$;

create or replace function public.enforce_active_pickup_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.guardian_students gs
    where gs.guardian_profile_id = new.guardian_profile_id
      and gs.student_id = new.student_id
      and public.guardian_student_link_is_active(gs)
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status in (
    'EXPIRED', 'CANCELLED_BY_GUARDIAN', 'REJECTED_BY_STUDENT',
    'REJECTED_AT_GATE', 'BLOCKED_BY_ATTEMPTS'
  ) then
    return new;
  end if;

  raise exception 'Pickup relationship is not active' using errcode = '42501';
end;
$$;

drop trigger if exists guardian_pickup_active_relationship on public.guardian_pickup_requests;
create trigger guardian_pickup_active_relationship
before insert or update on public.guardian_pickup_requests
for each row execute function public.enforce_active_pickup_relationship();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role := 'APODERADO';
begin
  if new.raw_user_meta_data ->> 'validgate_role' = 'RETIRADOR_AUTORIZADO' then
    requested_role := 'RETIRADOR_AUTORIZADO';
  end if;

  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_access_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.institution_id is distinct from old.institution_id
  ) then
    raise exception 'Profile access scope cannot be changed by the account owner' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_access_scope on public.profiles;
create trigger profiles_protect_access_scope
before update on public.profiles
for each row execute function public.protect_profile_access_scope();

drop policy if exists "guardians can see own links" on public.guardian_students;
create policy "users can see own active links"
on public.guardian_students for select to authenticated
using (
  guardian_profile_id = auth.uid()
  and public.guardian_student_link_is_active(guardian_students)
);

drop policy if exists "guardians can create own links" on public.guardian_students;
drop policy if exists "guardians can delete own links" on public.guardian_students;
create policy "apoderados can delete own permanent links"
on public.guardian_students for delete to authenticated
using (
  guardian_profile_id = auth.uid()
  and relation_type = 'APODERADO'
  and public.current_user_role() = 'APODERADO'
);

drop policy if exists "guardians can see linked students" on public.students;
create policy "linked users can see permitted students"
on public.students for select to authenticated
using (
  exists (
    select 1 from public.guardian_students gs
    where gs.student_id = students.id
      and gs.guardian_profile_id = auth.uid()
      and public.guardian_student_link_is_active(gs)
  )
);

drop policy if exists "students can read own guardian links" on public.guardian_students;
create policy "students can read own active guardian links"
on public.guardian_students for select to authenticated
using (
  public.guardian_student_link_is_active(guardian_students)
  and exists (
    select 1 from public.student_profiles sp
    where sp.profile_id = auth.uid() and sp.student_id = guardian_students.student_id
  )
);

drop policy if exists "guardians can view schedule blocks from linked students" on public.schedule_blocks;
create policy "apoderados can view linked schedule blocks"
on public.schedule_blocks for select to authenticated
using (
  public.current_user_role() = 'APODERADO'
  and exists (
    select 1 from public.students s
    join public.guardian_students gs on gs.student_id = s.id
    where s.course_id = schedule_blocks.course_id
      and gs.guardian_profile_id = auth.uid()
      and gs.relation_type = 'APODERADO'
  )
  or (
    public.current_user_role() in ('ADMIN', 'PORTERIA', 'DOCENTE')
    and exists (
      select 1 from public.courses c where c.id = schedule_blocks.course_id
        and c.institution_id = public.current_user_institution_id()
    )
  )
);

drop policy if exists "guardians can view linked attendance" on public.attendance_blocks;
create policy "apoderados can view linked attendance"
on public.attendance_blocks for select to authenticated
using (
  (
    public.current_user_role() = 'APODERADO'
    and exists (
      select 1 from public.guardian_students gs
      where gs.student_id = attendance_blocks.student_id
        and gs.guardian_profile_id = auth.uid() and gs.relation_type = 'APODERADO'
    )
  )
  or exists (
    select 1 from public.students s where s.id = attendance_blocks.student_id
      and s.institution_id = public.current_user_institution_id()
      and public.current_user_role() in ('ADMIN', 'PORTERIA', 'DOCENTE')
  )
);

drop policy if exists "guardians can read linked student qr credentials" on public.student_qr_credentials;
create policy "apoderados can read linked student qr credentials"
on public.student_qr_credentials for select to authenticated
using (
  created_by = auth.uid() and public.current_user_role() = 'APODERADO'
  and exists (
    select 1 from public.guardian_students gs
    where gs.student_id = student_qr_credentials.student_id
      and gs.guardian_profile_id = auth.uid() and gs.relation_type = 'APODERADO'
  )
);

drop policy if exists "guardians can create linked student qr credentials" on public.student_qr_credentials;
create policy "apoderados can create linked student qr credentials"
on public.student_qr_credentials for insert to authenticated
with check (
  created_by = auth.uid() and public.current_user_role() = 'APODERADO'
  and exists (
    select 1 from public.students s
    join public.guardian_students gs on gs.student_id = s.id
    where s.id = student_qr_credentials.student_id
      and s.institution_id = student_qr_credentials.institution_id
      and gs.guardian_profile_id = auth.uid() and gs.relation_type = 'APODERADO'
  )
);

drop policy if exists "guardians can read linked authorization requests" on public.authorization_requests;
create policy "apoderados can read linked authorization requests"
on public.authorization_requests for select to authenticated
using (
  guardian_profile_id = auth.uid() and public.current_user_role() = 'APODERADO'
  and exists (
    select 1 from public.guardian_students gs
    where gs.student_id = authorization_requests.student_id
      and gs.guardian_profile_id = auth.uid() and gs.relation_type = 'APODERADO'
  )
);

drop policy if exists "guardians can respond linked authorization requests" on public.authorization_requests;
create policy "apoderados can respond linked authorization requests"
on public.authorization_requests for update to authenticated
using (
  guardian_profile_id = auth.uid() and public.current_user_role() = 'APODERADO'
  and exists (
    select 1 from public.guardian_students gs
    where gs.student_id = authorization_requests.student_id
      and gs.guardian_profile_id = auth.uid() and gs.relation_type = 'APODERADO'
  )
)
with check (
  guardian_profile_id = auth.uid() and public.current_user_role() = 'APODERADO'
);

drop policy if exists "authenticated users can see authorized people in their institution" on public.authorized_people;
create policy "participants can see associated authorized people"
on public.authorized_people for select to authenticated
using (
  (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  )
  or exists (
    select 1 from public.authorizations a
    where a.authorized_person_id = authorized_people.id
      and (
        a.guardian_profile_id = auth.uid()
        or exists (
          select 1 from public.student_profiles sp
          where sp.profile_id = auth.uid() and sp.student_id = a.student_id
        )
      )
  )
);

drop policy if exists "guardians can view linked access events" on public.access_events;
create policy "linked users can view permitted access events"
on public.access_events for select to authenticated
using (
  exists (
    select 1 from public.guardian_students gs
    where gs.student_id = access_events.student_id
      and gs.guardian_profile_id = auth.uid()
      and public.guardian_student_link_is_active(gs)
  )
  or exists (
    select 1 from public.students s
    where s.id = access_events.student_id
      and s.institution_id = public.current_user_institution_id()
      and public.current_user_role() in ('ADMIN', 'PORTERIA', 'DOCENTE')
  )
);

create or replace function public.list_visible_student_links()
returns table (
  relation_id bigint,
  student_id bigint,
  student_name text,
  institution_name text,
  person_profile_id uuid,
  person_name text,
  relation_type text,
  valid_from timestamptz,
  valid_until timestamptz,
  revoked_at timestamptz,
  is_active boolean,
  can_revoke boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    gs.id,
    s.id,
    trim(concat_ws(' ', s.first_name, s.last_name)),
    i.name,
    p.id,
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
    gs.relation_type,
    gs.valid_from,
    gs.valid_until,
    gs.revoked_at,
    public.guardian_student_link_is_active(gs),
    gs.relation_type = 'RETIRADOR_AUTORIZADO'
      and gs.revoked_at is null
      and (
        gs.authorized_by_profile_id = auth.uid()
        or public.current_user_role() = 'ADMIN'
      )
  from public.guardian_students gs
  join public.students s on s.id = gs.student_id
  join public.institutions i on i.id = s.institution_id
  join public.profiles p on p.id = gs.guardian_profile_id
  where auth.uid() is not null
    and (
      (public.current_user_role() = 'ADMIN' and s.institution_id = public.current_user_institution_id())
      or (
        public.current_user_role() = 'APODERADO'
        and exists (
          select 1 from public.guardian_students own_link
          where own_link.student_id = s.id
            and own_link.guardian_profile_id = auth.uid()
            and own_link.relation_type = 'APODERADO'
        )
      )
      or (
        public.current_user_role() = 'RETIRADOR_AUTORIZADO'
        and gs.guardian_profile_id = auth.uid()
        and public.guardian_student_link_is_active(gs)
      )
      or (
        public.guardian_student_link_is_active(gs)
        and exists (
        select 1 from public.student_profiles sp
        where sp.profile_id = auth.uid() and sp.student_id = s.id
        )
      )
    )
  order by s.first_name, s.last_name, gs.relation_type, p.first_name, p.last_name;
$$;

create or replace function public.list_students_available_for_retirador_authorization()
returns table (student_id bigint, student_name text, institution_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.id, trim(concat_ws(' ', s.first_name, s.last_name)), i.name
  from public.students s
  join public.institutions i on i.id = s.institution_id
  where auth.uid() is not null and (
    (public.current_user_role() = 'ADMIN' and s.institution_id = public.current_user_institution_id())
    or (
      public.current_user_role() = 'APODERADO'
      and exists (
        select 1 from public.guardian_students gs
        where gs.student_id = s.id
          and gs.guardian_profile_id = auth.uid()
          and gs.relation_type = 'APODERADO'
      )
    )
  )
  order by 2;
$$;

create or replace function public.create_authorized_retirador_link(
  p_retirador_profile_id uuid,
  p_student_id bigint,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  student_institution_id bigint;
begin
  if auth.uid() is null or p_valid_from is null or p_valid_until is null or p_valid_until <= p_valid_from then
    return jsonb_build_object('status', 'invalid');
  end if;

  select institution_id into student_institution_id from public.students where id = p_student_id;
  if student_institution_id is null then return jsonb_build_object('status', 'not_found'); end if;

  if not (
    (public.current_user_role() = 'ADMIN' and student_institution_id = public.current_user_institution_id())
    or (
      public.current_user_role() = 'APODERADO'
      and exists (
        select 1 from public.guardian_students gs
        where gs.student_id = p_student_id
          and gs.guardian_profile_id = auth.uid()
          and gs.relation_type = 'APODERADO'
      )
    )
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_retirador_profile_id
      and p.role in ('RETIRADOR_AUTORIZADO', 'APODERADO')
  ) then
    return jsonb_build_object('status', 'invalid_profile');
  end if;

  perform pg_advisory_xact_lock(p_student_id);

  if exists (
    select 1 from public.guardian_students gs
    where gs.guardian_profile_id = p_retirador_profile_id
      and gs.student_id = p_student_id
      and gs.relation_type = 'APODERADO'
  ) then
    return jsonb_build_object('status', 'already_guardian');
  end if;

  if exists (
    select 1 from public.guardian_students gs
    where gs.guardian_profile_id = p_retirador_profile_id
      and gs.student_id = p_student_id
      and gs.relation_type = 'RETIRADOR_AUTORIZADO'
      and gs.revoked_at is null
      and gs.valid_until > now()
  ) then
    return jsonb_build_object('status', 'authorization_exists');
  end if;

  insert into public.guardian_students (
    guardian_profile_id, student_id, relation_type, authorized_by_profile_id,
    valid_from, valid_until, revoked_at, revoked_by_profile_id
  ) values (
    p_retirador_profile_id, p_student_id, 'RETIRADOR_AUTORIZADO', auth.uid(),
    p_valid_from, p_valid_until, null, null
  );

  return jsonb_build_object('status', 'created');
end;
$$;

create or replace function public.link_student_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  student_record public.students%rowtype;
begin
  if auth.uid() is null or public.current_user_role() <> 'APODERADO' then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select s.* into student_record from public.students s
  where upper(trim(s.link_code)) = upper(trim(p_code)) limit 1;
  if not found then return jsonb_build_object('status', 'invalid_code'); end if;

  if exists (
    select 1 from public.guardian_students gs
    where gs.guardian_profile_id = auth.uid() and gs.student_id = student_record.id
      and gs.relation_type = 'APODERADO'
  ) then
    return jsonb_build_object('status', 'already_linked');
  end if;

  insert into public.guardian_students (guardian_profile_id, student_id, relation_type)
  values (auth.uid(), student_record.id, 'APODERADO');
  return jsonb_build_object('status', 'linked');
end;
$$;

create or replace function public.admin_link_guardian_to_student(
  p_guardian_profile_id uuid,
  p_student_id bigint,
  p_relation_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_institution_id bigint := public.current_user_institution_id();
begin
  if auth.uid() is null or public.current_user_role() <> 'ADMIN' or admin_institution_id is null then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if upper(trim(coalesce(p_relation_type, ''))) <> 'APODERADO' then
    return jsonb_build_object('status', 'invalid_relation_type');
  end if;
  if not exists (select 1 from public.students s where s.id = p_student_id and s.institution_id = admin_institution_id) then
    return jsonb_build_object('status', 'student_not_found');
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_guardian_profile_id and p.role = 'APODERADO'
      and (
        p.institution_id = admin_institution_id
        or exists (
          select 1 from public.guardian_students existing_link
          join public.students linked_student on linked_student.id = existing_link.student_id
          where existing_link.guardian_profile_id = p.id
            and linked_student.institution_id = admin_institution_id
        )
      )
  ) then
    return jsonb_build_object('status', 'guardian_not_found');
  end if;

  insert into public.guardian_students (
    guardian_profile_id, student_id, relation_type, authorized_by_profile_id,
    valid_from, valid_until, revoked_at, revoked_by_profile_id
  ) values (p_guardian_profile_id, p_student_id, 'APODERADO', null, null, null, null, null)
  on conflict (guardian_profile_id, student_id) where relation_type = 'APODERADO'
  do nothing;
  return jsonb_build_object('status', 'linked');
end;
$$;

create or replace function public.admin_unlink_guardian_from_student(p_relation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare deleted_id bigint;
begin
  if auth.uid() is null or public.current_user_role() <> 'ADMIN' then
    return jsonb_build_object('status', 'forbidden');
  end if;
  delete from public.guardian_students gs using public.students s
  where gs.id = p_relation_id and s.id = gs.student_id
    and gs.relation_type = 'APODERADO'
    and s.institution_id = public.current_user_institution_id()
  returning gs.id into deleted_id;
  return jsonb_build_object('status', case when deleted_id is null then 'not_found' else 'unlinked' end);
end;
$$;

create or replace function public.revoke_authorized_retirador_link(p_relation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_id bigint;
begin
  update public.guardian_students gs
  set revoked_at = now(), revoked_by_profile_id = auth.uid()
  from public.students s
  where gs.id = p_relation_id
    and gs.student_id = s.id
    and gs.relation_type = 'RETIRADOR_AUTORIZADO'
    and gs.revoked_at is null
    and (
      gs.authorized_by_profile_id = auth.uid()
      or (public.current_user_role() = 'ADMIN' and s.institution_id = public.current_user_institution_id())
    )
  returning gs.id into changed_id;

  return jsonb_build_object('status', case when changed_id is null then 'not_found' else 'revoked' end);
end;
$$;

create or replace function public.get_student_guardian_links(p_student_ids bigint[] default null)
returns table (
  student_id bigint, student_name text, institution_name text, guardian_profile_id uuid,
  guardian_name text, guardian_email text, relation_type text, linked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, concat_ws(' ', s.first_name, s.last_name), i.name, p.id,
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, gs.relation_type, gs.created_at
  from public.students s
  join public.institutions i on i.id = s.institution_id
  join public.guardian_students gs on gs.student_id = s.id
  join public.profiles p on p.id = gs.guardian_profile_id
  where auth.uid() is not null
    and (p_student_ids is null or s.id = any(p_student_ids))
    and public.guardian_student_link_is_active(gs)
    and (
      (public.current_user_role() = 'ADMIN' and s.institution_id = public.current_user_institution_id())
      or gs.guardian_profile_id = auth.uid()
      or exists (select 1 from public.student_profiles sp where sp.student_id = s.id and sp.profile_id = auth.uid())
    )
  order by s.first_name, s.last_name, gs.created_at desc;
$$;

-- Permite al retirador autenticado iniciar el mismo flujo de retiro que un apoderado,
-- únicamente mientras su vínculo temporal está activo.
create or replace function public.create_guardian_pickup_request(p_student_id bigint)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public as $$
declare
  student_record public.students%rowtype;
  settings_record public.institution_pickup_settings%rowtype;
  guardian_name text;
begin
  if auth.uid() is null or public.current_user_role() not in ('APODERADO', 'RETIRADOR_AUTORIZADO') then
    return query select null::uuid, 'PICKUP_FORBIDDEN'::text; return;
  end if;

  select s.* into student_record from public.students s
  join public.guardian_students gs on gs.student_id = s.id
  where s.id = p_student_id and gs.guardian_profile_id = auth.uid()
    and public.guardian_student_link_is_active(gs)
  for update of s;

  if not found then return query select null::uuid, 'PICKUP_NOT_AUTHORIZED'::text; return; end if;
  if not student_record.is_in_institution then return query select null::uuid, 'PICKUP_STUDENT_NOT_INSIDE'::text; return; end if;

  with expired as (
    update public.guardian_pickup_requests set status = 'EXPIRED'
    where student_id = p_student_id
      and status in ('PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') and expires_at <= now()
    returning id, institution_id
  )
  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, performed_by_profile_id, event_type, result, method)
  select id, institution_id, auth.uid(), 'REQUEST_EXPIRED', 'INFO', 'SYSTEM' from expired;

  update public.guardian_pickup_pins p set invalidated_at = now()
  where p.request_id in (
    select r.id from public.guardian_pickup_requests r
    where r.student_id = p_student_id and r.status = 'EXPIRED'
  ) and p.invalidated_at is null;

  select r.id into request_id from public.guardian_pickup_requests r
  where r.student_id = p_student_id
    and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') limit 1;
  if request_id is not null then return query select request_id, 'PICKUP_ALREADY_ACTIVE'::text; return; end if;

  insert into public.institution_pickup_settings (institution_id) values (student_record.institution_id)
  on conflict (institution_id) do nothing;
  select * into settings_record from public.institution_pickup_settings where institution_id = student_record.institution_id;

  insert into public.guardian_pickup_requests (institution_id, student_id, guardian_profile_id)
  values (student_record.institution_id, student_record.id, auth.uid()) returning id into request_id;

  select trim(concat_ws(' ', first_name, last_name)) into guardian_name from public.profiles where id = auth.uid();
  insert into public.internal_notifications (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
  select sp.profile_id, student_record.institution_id, 'GUARDIAN_PICKUP_REQUEST', 'Solicitud de retiro',
    replace(settings_record.student_notification_message, '{guardian_name}', coalesce(nullif(guardian_name, ''), 'La persona autorizada')),
    'GUARDIAN_PICKUP_REQUEST', request_id
  from public.student_profiles sp where sp.student_id = student_record.id;

  insert into public.guardian_pickup_audit_events
    (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method)
  values (request_id, student_record.institution_id, auth.uid(), auth.uid(), 'REQUEST_CREATED', 'SUCCESS', 'SYSTEM');

  return query select request_id, 'PICKUP_REQUEST_CREATED'::text;
exception when unique_violation then
  select r.id into request_id from public.guardian_pickup_requests r
  where r.student_id = p_student_id
    and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED') limit 1;
  return query select request_id, 'PICKUP_ALREADY_ACTIVE'::text;
end;
$$;

revoke all on function public.list_visible_student_links() from public, anon;
revoke all on function public.list_students_available_for_retirador_authorization() from public, anon;
revoke all on function public.create_authorized_retirador_link(uuid, bigint, timestamptz, timestamptz) from public, anon;
revoke all on function public.revoke_authorized_retirador_link(bigint) from public, anon;
grant execute on function public.list_visible_student_links() to authenticated;
grant execute on function public.list_students_available_for_retirador_authorization() to authenticated;
grant execute on function public.create_authorized_retirador_link(uuid, bigint, timestamptz, timestamptz) to authenticated;
grant execute on function public.revoke_authorized_retirador_link(bigint) to authenticated;

comment on table public.guardian_students is
  'Vínculos autenticados estudiante-persona. Los RETIRADOR_AUTORIZADO requieren vigencia y pueden revocarse.';

notify pgrst, 'reload schema';
