-- La migración 031 amplió quién puede revocar una autorización, pero al
-- reemplazar la función omitió la cancelación del retiro y de sus PIN.
create or replace function public.revoke_authorized_retirador_link(p_relation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_id bigint;
  affected_request uuid;
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
      or (
        public.current_user_role() = 'ADMIN'
        and s.institution_id = public.current_user_institution_id()
      )
      or (
        public.current_user_role() = 'APODERADO'
        and exists (
          select 1
          from public.guardian_students own_link
          where own_link.student_id = s.id
            and own_link.guardian_profile_id = auth.uid()
            and own_link.relation_type = 'APODERADO'
            and public.guardian_student_link_is_active(own_link)
        )
      )
    )
  returning gs.id into changed_id;

  if changed_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  for affected_request in
    update public.guardian_pickup_requests
    set status = 'CANCELLED_AUTHORIZATION_REVOKED',
        cancelled_at = now(),
        terminal_note = 'Autorización temporal revocada'
    where authorization_link_id = changed_id
      and status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
    returning id
  loop
    update public.guardian_pickup_pins
    set invalidated_at = coalesce(invalidated_at, now())
    where request_id = affected_request;

    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, performed_by_profile_id, event_type, result, method, reason)
    select affected_request, institution_id, auth.uid(), 'AUTHORIZATION_REVOKED', 'FAILURE', 'SYSTEM',
      'Autorización temporal revocada'
    from public.guardian_pickup_requests
    where id = affected_request;

    insert into public.internal_notifications
      (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
    select recipient_id, r.institution_id, 'PICKUP_AUTHORIZATION_REVOKED',
      'Retiro cancelado', 'La autorización temporal fue revocada y los PIN quedaron invalidados.',
      'GUARDIAN_PICKUP_REQUEST', r.id
    from public.guardian_pickup_requests r
    cross join lateral (
      select r.guardian_profile_id as recipient_id
      union
      select sp.profile_id
      from public.student_profiles sp
      where sp.student_id = r.student_id
    ) recipients
    where r.id = affected_request;
  end loop;

  return jsonb_build_object('status', 'revoked');
end;
$$;

revoke all on function public.revoke_authorized_retirador_link(bigint) from public, anon;
grant execute on function public.revoke_authorized_retirador_link(bigint) to authenticated;

notify pgrst, 'reload schema';
