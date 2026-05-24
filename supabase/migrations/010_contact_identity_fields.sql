alter table public.profiles
  add column if not exists rut text,
  add column if not exists phone text;

alter table public.students
  add column if not exists rut text,
  add column if not exists phone text;

alter table public.authorized_people
  add column if not exists rut text;

update public.authorized_people
set rut = document_identity
where rut is null
  and document_identity ~ '^[0-9]{1,8}-[0-9Kk]$';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_rut_format_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_rut_format_chk
      check (rut is null or rut ~ '^[0-9]{1,8}-[0-9Kk]$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_phone_cl_mobile_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_cl_mobile_chk
      check (phone is null or phone ~ '^\+569[0-9]{8}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'students_rut_format_chk'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_rut_format_chk
      check (rut is null or rut ~ '^[0-9]{1,8}-[0-9Kk]$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'students_phone_cl_mobile_chk'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_phone_cl_mobile_chk
      check (phone is null or phone ~ '^\+569[0-9]{8}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'authorized_people_rut_format_chk'
      and conrelid = 'public.authorized_people'::regclass
  ) then
    alter table public.authorized_people
      add constraint authorized_people_rut_format_chk
      check (rut is null or rut ~ '^[0-9]{1,8}-[0-9Kk]$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'authorized_people_phone_cl_mobile_chk'
      and conrelid = 'public.authorized_people'::regclass
  ) then
    alter table public.authorized_people
      add constraint authorized_people_phone_cl_mobile_chk
      check (phone is null or phone ~ '^\+569[0-9]{8}$');
  end if;
end $$;

create unique index if not exists profiles_rut_unique_idx
on public.profiles (upper(rut))
where rut is not null;

create unique index if not exists students_rut_unique_idx
on public.students (upper(rut))
where rut is not null;

create unique index if not exists authorized_people_rut_unique_idx
on public.authorized_people (upper(rut))
where rut is not null;

comment on column public.profiles.rut is
  'RUT chileno normalizado sin puntos y con guion, por ejemplo 12345678-5.';

comment on column public.profiles.phone is
  'Telefono movil chileno en formato E.164, por ejemplo +56979999999.';

comment on column public.students.rut is
  'RUT chileno opcional del estudiante, normalizado sin puntos y con guion.';

comment on column public.students.phone is
  'Telefono movil chileno opcional del estudiante en formato +569XXXXXXXX.';

comment on column public.authorized_people.rut is
  'RUT chileno opcional del adulto/persona autorizada, normalizado sin puntos y con guion.';
