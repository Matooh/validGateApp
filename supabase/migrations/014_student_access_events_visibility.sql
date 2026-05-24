create policy "students can view own access events"
  on public.access_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_profiles sp
      where sp.student_id = access_events.student_id
        and sp.profile_id = auth.uid()
    )
  );
