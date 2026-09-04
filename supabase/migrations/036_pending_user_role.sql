-- Las cuentas nuevas quedan sin permisos hasta que un administrador les asigne
-- un rol funcional. Este cambio debe quedar en una migración separada porque
-- PostgreSQL no permite usar un valor enum recién agregado en la misma
-- transacción.
alter type public.app_role add value if not exists 'PENDIENTE';
