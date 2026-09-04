-- Garantiza que todo usuario de Auth tenga un RUT en profiles. Si el flujo
-- entrega uno, se conserva; para cuentas creadas por administracion se usa
-- un RUT sintetico, valido y unico por usuario.
create or replace function public.synthetic_rut(p_seed uuid)
returns text
language plpgsql
immutable
as $$
declare
  body_text text := (10000000 + mod(('x' || substr(md5(p_seed::text), 1, 15))::bit(60)::bigint, 90000000))::text;
  total integer := 0;
  multiplier integer := 2;
  digit integer;
  verifier text;
  position integer;
begin
  position := length(body_text);
  while position > 0 loop
    digit := substring(body_text, position, 1)::integer;
    total := total + digit * multiplier;
    multiplier := case when multiplier = 7 then 2 else multiplier + 1 end;
    position := position - 1;
  end loop;

  verifier := case
    when 11 - (total % 11) = 11 then '0'
    when 11 - (total % 11) = 10 then 'K'
    else (11 - (total % 11))::text
  end;
  return body_text || '-' || verifier;
end;
$$;

update public.profiles
set rut = public.synthetic_rut(id)
where rut is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role := 'APODERADO';
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
