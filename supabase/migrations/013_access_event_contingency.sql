do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'access_contingency_reason'
      and n.nspname = 'public'
  ) then
    create type public.access_contingency_reason as enum (
      'SIN_DISPOSITIVO',
      'NO_CELULAR',
      'SIN_BATERIA',
      'QR_NO_DISPONIBLE',
      'CAMARA_NO_DISPONIBLE',
      'JARDIN_INFANTIL',
      'OTRO'
    );
  end if;
end $$;

alter table public.access_events
  add column if not exists access_mode text not null default 'NORMAL'
    check (access_mode in ('NORMAL', 'CONTINGENCIA_SIN_DISPOSITIVO')),
  add column if not exists contingency_reason public.access_contingency_reason,
  add column if not exists contingency_note text;

comment on column public.access_events.access_mode is
  'Indica si el evento fue registrado en flujo normal o como contingencia por ausencia de dispositivo.';

comment on column public.access_events.contingency_reason is
  'Motivo normalizado de la contingencia cuando el estudiante no dispone de dispositivo propio.';

comment on column public.access_events.contingency_note is
  'Detalle libre obligatorio cuando el evento se registra por contingencia sin dispositivo.';