-- Los seeds 002 y 003 usan IDs explicitos. Sin esta sincronizacion, la
-- siguiente insercion automatica puede intentar reutilizar un ID existente.

select setval(
  pg_get_serial_sequence('public.institutions', 'id'),
  coalesce(max(id), 1),
  max(id) is not null
)
from public.institutions;

select setval(
  pg_get_serial_sequence('public.courses', 'id'),
  coalesce(max(id), 1),
  max(id) is not null
)
from public.courses;

select setval(
  pg_get_serial_sequence('public.students', 'id'),
  coalesce(max(id), 1),
  max(id) is not null
)
from public.students;
