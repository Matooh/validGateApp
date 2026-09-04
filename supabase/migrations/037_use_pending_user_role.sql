-- Se ejecuta después del commit de 036, por lo que PENDIENTE ya puede usarse.
alter table public.profiles
  alter column role set default 'PENDIENTE';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role := 'PENDIENTE';
  profile_rut text;
begin
  if new.raw_user_meta_data ->> 'validgate_role' = 'RETIRADOR_AUTORIZADO' then
    requested_role := 'RETIRADOR_AUTORIZADO';
  end if;

  profile_rut := coalesce(
    nullif(upper(trim(new.raw_user_meta_data ->> 'validgate_rut')), ''),
    public.synthetic_rut(new.id)
  );

  insert into public.profiles (id, email, first_name, last_name, rut, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    profile_rut,
    requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
