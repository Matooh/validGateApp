insert into public.institutions (id, name, institution_type)
overriding system value
values (1, 'Instituto Demo ValidGate', 'COLEGIO')
on conflict (id) do nothing;

insert into public.courses (id, institution_id, name)
overriding system value
values (1, 1, 'Primero Basico A')
on conflict (id) do nothing;

insert into public.students (id, institution_id, course_id, first_name, last_name, can_leave_alone, is_in_institution, link_code)
overriding system value
values
  (1, 1, 1, 'Lucas', 'Perez', false, true, 'VG-LUCAS'),
  (2, 1, 1, 'Sofia', 'Mora', true, false, 'VG-SOFIA')
on conflict (id) do nothing;

insert into public.schedule_blocks (course_id, day_of_week, start_time, end_time, block_kind, block_name, location, exit_allowed)
values
  (1, 1, '08:00', '08:45', 'ASIGNATURA', 'Lenguaje', 'Sala 1', false),
  (1, 1, '09:00', '09:45', 'ASIGNATURA', 'Matematicas', 'Sala 1', false),
  (1, 1, '10:00', '10:15', 'RECREO', 'Recreo', 'Patio', true),
  (1, 1, '10:20', '11:05', 'TALLER', 'Arte', 'Sala de Arte', false)
on conflict do nothing;

insert into public.attendance_blocks (student_id, schedule_block_id, attendance_date, status, note)
select 1, id, current_date,
  case row_number() over(order by id)
    when 1 then 'PRESENTE'::public.attendance_status
    when 2 then 'TARDANZA'::public.attendance_status
    when 3 then 'PRESENTE'::public.attendance_status
    else 'AUSENTE'::public.attendance_status
  end,
  'Seed demo'
from public.schedule_blocks
where course_id = 1
on conflict (student_id, schedule_block_id, attendance_date) do nothing;
