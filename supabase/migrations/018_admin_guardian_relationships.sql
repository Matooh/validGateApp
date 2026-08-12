-- Autoservicio del apoderado y administracion institucional de vinculaciones.

create or replace function public.link_student_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  student_record public.students%rowtype;
  relation_kind text;
begin
  if auth.uid() is null or public.current_user_role() <> 'APODERADO' then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select s.*
  into student_record
  from public.students s
  where upper(trim(s.link_code)) = upper(trim(p_code))
  limit 1;

  if not found then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  if exists (
    select 1
    from public.guardian_students gs
    where gs.guardian_profile_id = auth.uid()
      and gs.student_id = student_record.id
  ) then
    return jsonb_build_object('status', 'already_linked');
  end if;

  relation_kind := case
    when exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = student_record.id
        and gs.relation_type = 'APODERADO_PRINCIPAL'
    ) then 'APODERADO'
    else 'APODERADO_PRINCIPAL'
  end;

  insert into public.guardian_students (guardian_profile_id, student_id, relation_type)
  values (auth.uid(), student_record.id, relation_kind);

  return jsonb_build_object('status', 'linked');
end;
$$;

revoke all on function public.link_student_by_code(text) from public, anon;
grant execute on function public.link_student_by_code(text) to authenticated;

-- Normaliza datos historicos antes de garantizar un unico apoderado principal.
with ranked_principals as (
  select
    id,
    row_number() over (partition by student_id order by created_at, id) as position
  from public.guardian_students
  where relation_type = 'APODERADO_PRINCIPAL'
)
update public.guardian_students gs
set relation_type = 'APODERADO'
from ranked_principals ranked
where gs.id = ranked.id
  and ranked.position > 1;

create unique index if not exists guardian_students_one_primary_per_student
on public.guardian_students (student_id)
where relation_type = 'APODERADO_PRINCIPAL';

create or replace function public.admin_list_guardian_candidates()
returns table (
  profile_id uuid,
  guardian_name text,
  guardian_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
    p.email
  from public.profiles p
  where auth.uid() is not null
    and public.current_user_role() = 'ADMIN'
    and p.role = 'APODERADO'
    and (
      p.institution_id = public.current_user_institution_id()
      or exists (
        select 1
        from public.guardian_students gs
        join public.students s on s.id = gs.student_id
        where gs.guardian_profile_id = p.id
          and s.institution_id = public.current_user_institution_id()
      )
    )
  order by
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
    p.email;
$$;

create or replace function public.admin_list_students_for_guardian_links()
returns table (
  student_id bigint,
  student_name text,
  course_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    trim(concat_ws(' ', s.first_name, s.last_name)),
    c.name
  from public.students s
  left join public.courses c on c.id = s.course_id
  where auth.uid() is not null
    and public.current_user_role() = 'ADMIN'
    and s.institution_id = public.current_user_institution_id()
  order by s.first_name, s.last_name, s.id;
$$;

create or replace function public.admin_list_guardian_student_links()
returns table (
  relation_id bigint,
  student_id bigint,
  student_name text,
  guardian_profile_id uuid,
  guardian_name text,
  guardian_email text,
  relation_type text,
  linked_at timestamptz
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
    p.id,
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
    p.email,
    gs.relation_type,
    gs.created_at
  from public.guardian_students gs
  join public.students s on s.id = gs.student_id
  join public.profiles p on p.id = gs.guardian_profile_id
  where auth.uid() is not null
    and public.current_user_role() = 'ADMIN'
    and s.institution_id = public.current_user_institution_id()
  order by s.first_name, s.last_name, gs.created_at, gs.id;
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
  normalized_relation text := upper(trim(coalesce(p_relation_type, '')));
  admin_institution_id bigint := public.current_user_institution_id();
begin
  if auth.uid() is null or public.current_user_role() <> 'ADMIN' or admin_institution_id is null then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if normalized_relation not in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO') then
    return jsonb_build_object('status', 'invalid_relation_type');
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.institution_id = admin_institution_id
  ) then
    return jsonb_build_object('status', 'student_not_found');
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_guardian_profile_id
      and p.role = 'APODERADO'
      and (
        p.institution_id = admin_institution_id
        or exists (
          select 1
          from public.guardian_students existing_link
          join public.students linked_student on linked_student.id = existing_link.student_id
          where existing_link.guardian_profile_id = p.id
            and linked_student.institution_id = admin_institution_id
        )
      )
  ) then
    return jsonb_build_object('status', 'guardian_not_found');
  end if;

  if normalized_relation = 'APODERADO_PRINCIPAL' and exists (
    select 1
    from public.guardian_students gs
    where gs.student_id = p_student_id
      and gs.relation_type = 'APODERADO_PRINCIPAL'
      and gs.guardian_profile_id <> p_guardian_profile_id
  ) then
    return jsonb_build_object('status', 'primary_exists');
  end if;

  insert into public.guardian_students (guardian_profile_id, student_id, relation_type)
  values (p_guardian_profile_id, p_student_id, normalized_relation)
  on conflict (guardian_profile_id, student_id)
  do update set relation_type = excluded.relation_type;

  return jsonb_build_object('status', 'linked');
end;
$$;

create or replace function public.admin_unlink_guardian_from_student(p_relation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id bigint;
begin
  if auth.uid() is null or public.current_user_role() <> 'ADMIN' then
    return jsonb_build_object('status', 'forbidden');
  end if;

  delete from public.guardian_students gs
  using public.students s
  where gs.id = p_relation_id
    and s.id = gs.student_id
    and s.institution_id = public.current_user_institution_id()
  returning gs.id into deleted_id;

  if deleted_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'unlinked');
end;
$$;

revoke all on function public.admin_list_guardian_candidates() from public, anon;
revoke all on function public.admin_list_students_for_guardian_links() from public, anon;
revoke all on function public.admin_list_guardian_student_links() from public, anon;
revoke all on function public.admin_link_guardian_to_student(uuid, bigint, text) from public, anon;
revoke all on function public.admin_unlink_guardian_from_student(bigint) from public, anon;

grant execute on function public.admin_list_guardian_candidates() to authenticated;
grant execute on function public.admin_list_students_for_guardian_links() to authenticated;
grant execute on function public.admin_list_guardian_student_links() to authenticated;
grant execute on function public.admin_link_guardian_to_student(uuid, bigint, text) to authenticated;
grant execute on function public.admin_unlink_guardian_from_student(bigint) to authenticated;

notify pgrst, 'reload schema';
