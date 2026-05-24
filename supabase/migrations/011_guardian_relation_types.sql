update public.guardian_students
set relation_type = case
  when upper(trim(coalesce(relation_type, ''))) in ('MADRE', 'PADRE', 'TUTOR', 'APODERADO PRINCIPAL', 'APODERADO_PRINCIPAL')
    then 'APODERADO_PRINCIPAL'
  when upper(trim(coalesce(relation_type, ''))) in ('RETIRADOR', 'RETIRADOR AUTORIZADO', 'RETIRADOR_AUTORIZADO', 'APODERADO ALTERNATIVO', 'APODERADO_ALTERNATIVO')
    then 'RETIRADOR_AUTORIZADO'
  else 'APODERADO'
end
where relation_type is null
   or upper(trim(relation_type)) not in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guardian_students_relation_type_chk'
      and conrelid = 'public.guardian_students'::regclass
  ) then
    alter table public.guardian_students
      add constraint guardian_students_relation_type_chk
      check (
        relation_type in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO')
      );
  end if;
end $$;

comment on column public.guardian_students.relation_type is
  'Tipo de vinculo: APODERADO_PRINCIPAL, APODERADO o RETIRADOR_AUTORIZADO.';
