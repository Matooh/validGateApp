-- El apoderado primario puede completar/actualizar los datos operativos del
-- estudiante que tiene vinculado.
drop policy if exists "guardians can update linked students" on public.students;
create policy "guardians can update linked students"
on public.students for update to authenticated
using (
  exists (
    select 1 from public.guardian_students gs
    where gs.student_id = students.id
      and gs.guardian_profile_id = auth.uid()
      and gs.relation_type = 'APODERADO'
      and public.guardian_student_link_is_active(gs)
  )
)
with check (
  exists (
    select 1 from public.guardian_students gs
    where gs.student_id = students.id
      and gs.guardian_profile_id = auth.uid()
      and gs.relation_type = 'APODERADO'
      and public.guardian_student_link_is_active(gs)
  )
);

notify pgrst, 'reload schema';
