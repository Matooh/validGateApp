-- Permite cargar el combo público de instituciones sin exponer perfiles ni otros datos.
create or replace function public.list_registration_institutions()
returns table (id bigint, name text)
language sql
security definer
set search_path = public
as $$
  select i.id, i.name
  from public.institutions i
  order by i.name;
$$;

revoke all on function public.list_registration_institutions() from public;
grant execute on function public.list_registration_institutions() to anon, authenticated;
