create or replace function public.get_student_guardian_links(p_student_ids bigint[] default null)
returns table (
  student_id bigint,
  student_name text,
  institution_name text,
  guardian_profile_id uuid,
  guardian_name text,
  guardian_email text,
  relation_type text,
  linked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    s.id as student_id,
    concat_ws(' ', s.first_name, s.last_name) as student_name,
    i.name as institution_name,
    p.id as guardian_profile_id,
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') as guardian_name,
    p.email as guardian_email,
    gs.relation_type,
    gs.created_at as linked_at
  from public.students s
  join public.institutions i on i.id = s.institution_id
  join public.guardian_students gs on gs.student_id = s.id
  join public.profiles p on p.id = gs.guardian_profile_id
  where
    (p_student_ids is null or s.id = any(p_student_ids))
    and (
      (
        public.current_user_role() in ('ADMIN', 'PORTERIA', 'DOCENTE')
        and s.institution_id = public.current_user_institution_id()
      )
      or gs.guardian_profile_id = auth.uid()
    )
  order by s.first_name, s.last_name, gs.created_at desc;
end;
$$;

grant execute on function public.get_student_guardian_links(bigint[]) to authenticated;
