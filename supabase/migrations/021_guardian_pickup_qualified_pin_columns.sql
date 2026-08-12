-- Recompila las funciones ya desplegadas por 017 calificando las columnas de
-- guardian_pickup_pins. Varias funciones retornan una columna request_id y
-- PL/pgSQL considera ambiguo un WHERE request_id sin alias de tabla.

do $migration$
declare
  function_signature regprocedure;
  original_definition text;
  repaired_definition text;
begin
  foreach function_signature in array array[
    'public.validate_guardian_pickup_pin(uuid,text,text)'::regprocedure,
    'public.manually_validate_guardian_pickup_actor(uuid,text,text,text)'::regprocedure,
    'public.confirm_guardian_pickup(uuid)'::regprocedure,
    'public.cancel_guardian_pickup_request(uuid)'::regprocedure,
    'public.reject_guardian_pickup_at_gate(uuid,text,text)'::regprocedure
  ] loop
    original_definition := pg_get_functiondef(function_signature::oid);
    repaired_definition := replace(
      original_definition,
      'update public.guardian_pickup_pins set',
      'update public.guardian_pickup_pins p set'
    );
    repaired_definition := replace(
      repaired_definition,
      'where request_id = request_record.id',
      'where p.request_id = request_record.id'
    );
    repaired_definition := replace(
      repaired_definition,
      ' and actor_type = normalized_actor and invalidated_at is null',
      ' and p.actor_type = normalized_actor and p.invalidated_at is null'
    );
    repaired_definition := replace(
      repaired_definition,
      ' and invalidated_at is null',
      ' and p.invalidated_at is null'
    );
    repaired_definition := replace(
      repaired_definition,
      'coalesce(invalidated_at, now())',
      'coalesce(p.invalidated_at, now())'
    );

    if repaired_definition = original_definition then
      raise exception 'No se encontró el patrón esperado en %', function_signature;
    end if;

    execute repaired_definition;
  end loop;
end
$migration$;

notify pgrst, 'reload schema';
