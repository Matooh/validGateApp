-- Corrección: la conversión directa de un texto hexadecimal a bit(60) no es
-- portable en PostgreSQL y provocaba "Database error saving new user".
create or replace function public.synthetic_rut(p_seed uuid)
returns text
language plpgsql
immutable
as $$
declare
  digits text := regexp_replace(md5(p_seed::text), '[^0-9]', '', 'g') || '1234567';
  body_text text := '1' || substr(digits, 1, 7);
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
