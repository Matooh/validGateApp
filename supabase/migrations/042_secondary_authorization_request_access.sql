-- Las solicitudes dirigidas a un apoderado secundario deben ser visibles y
-- respondibles por ese mismo usuario, no solo por cuentas APODERADO.
drop policy if exists "apoderados can read linked authorization requests"
  on public.authorization_requests;
create policy "guardians can read linked authorization requests"
on public.authorization_requests for select to authenticated
using (
  guardian_profile_id = auth.uid()
  and public.current_user_role() in ('APODERADO', 'RETIRADOR_AUTORIZADO')
  and exists (
    select 1 from public.guardian_students gs
    where gs.student_id = authorization_requests.student_id
      and gs.guardian_profile_id = auth.uid()
      and public.guardian_student_link_is_active(gs)
  )
);

drop policy if exists "apoderados can respond linked authorization requests"
  on public.authorization_requests;
create policy "guardians can respond linked authorization requests"
on public.authorization_requests for update to authenticated
using (
  guardian_profile_id = auth.uid()
  and public.current_user_role() in ('APODERADO', 'RETIRADOR_AUTORIZADO')
  and exists (
    select 1 from public.guardian_students gs
    where gs.student_id = authorization_requests.student_id
      and gs.guardian_profile_id = auth.uid()
      and public.guardian_student_link_is_active(gs)
  )
)
with check (guardian_profile_id = auth.uid());

notify pgrst, 'reload schema';
