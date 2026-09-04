-- Un apoderado secundario ve todos los vínculos del estudiante autorizado,
-- aunque solo pueda administrar/revocar sus propias autorizaciones.
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
language sql stable security definer set search_path = public as $$
  select gs.id, s.id, trim(concat_ws(' ', s.first_name, s.last_name)), i.name,
    p.id, coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
    gs.relation_type, gs.valid_from, gs.valid_until, gs.revoked_at,
    public.guardian_student_link_is_active(gs),
    gs.relation_type = 'RETIRADOR_AUTORIZADO'
      and gs.revoked_at is null
      and (gs.authorized_by_profile_id = auth.uid() or public.current_user_role() = 'ADMIN')
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
            and public.guardian_student_link_is_active(own_link)
        )
      )
      or (
        public.current_user_role() = 'RETIRADOR_AUTORIZADO'
        and exists (
          select 1 from public.guardian_students own_link
          where own_link.student_id = s.id
            and own_link.guardian_profile_id = auth.uid()
            and public.guardian_student_link_is_active(own_link)
        )
      )
      or exists (
        select 1 from public.student_profiles sp
        where sp.profile_id = auth.uid() and sp.student_id = s.id
      )
    )
  order by s.first_name, s.last_name, gs.relation_type, p.first_name, p.last_name;
$$;

revoke all on function public.list_visible_student_links() from public, anon;
grant execute on function public.list_visible_student_links() to authenticated;
notify pgrst, 'reload schema';
