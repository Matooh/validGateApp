-- Supabase instala pgcrypto en el esquema extensions. Estas funciones usan
-- gen_random_bytes, crypt, gen_salt y cifrado PGP, por lo que deben incluirlo
-- en su search_path aun cuando ya hayan sido creadas por la migracion 017.

alter function public.generate_secure_five_digit_pin()
  set search_path = public, extensions;

alter function public.respond_guardian_pickup_request(uuid, boolean)
  set search_path = public, extensions;

alter function public.get_my_guardian_pickup_pin(uuid)
  set search_path = public, extensions;

alter function public.validate_guardian_pickup_pin(uuid, text, text)
  set search_path = public, extensions;

notify pgrst, 'reload schema';
