insert into public.institutions (id, name, institution_type)
overriding system value
values (2, 'Colegio Valle Norte', 'COLEGIO')
on conflict (id) do nothing;

insert into public.courses (id, institution_id, name)
overriding system value
values (2, 2, 'Segundo Basico B')
on conflict (id) do nothing;

insert into public.students (id, institution_id, course_id, first_name, last_name, can_leave_alone, is_in_institution, link_code)
overriding system value
values
  (3, 2, 2, 'Martina', 'Diaz', false, false, 'VG-MARTINA')
on conflict (id) do nothing;

insert into public.schedule_blocks (course_id, day_of_week, start_time, end_time, block_kind, block_name, location, exit_allowed)
values
  (2, 1, '08:00', '08:45', 'ASIGNATURA', 'Historia', 'Sala 5', false),
  (2, 1, '09:00', '09:45', 'ASIGNATURA', 'Ciencias', 'Sala 5', false),
  (2, 1, '10:00', '10:15', 'RECREO', 'Recreo', 'Patio Norte', true)
on conflict do nothing;
