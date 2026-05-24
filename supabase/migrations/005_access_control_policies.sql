do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'access_policy_failure'
      and n.nspname = 'public'
  ) then
    create type public.access_policy_failure as enum (
      'AUTHENTICATOR_REQUIRED',
      'ENTRY_ALREADY_ACTIVE',
      'EXIT_WITHOUT_ACTIVE_ENTRY',
      'EXIT_NOT_ALLOWED_ALONE',
      'EXIT_OBSERVATION_REQUIRED',
      'VALIDATION_ERROR'
    );
  end if;
end $$;

create table if not exists public.institution_access_policies (
  institution_id bigint primary key references public.institutions(id) on delete cascade,
  entry_requires_authenticator boolean not null default false,
  entry_authenticator_is_exclusive boolean not null default false,
  exit_requires_authenticator boolean not null default true,
  exit_authenticator_is_exclusive boolean not null default true,
  exit_requires_observation_without_authenticator boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    entry_authenticator_is_exclusive = false
    or entry_requires_authenticator = true
  ),
  check (
    exit_authenticator_is_exclusive = false
    or exit_requires_authenticator = true
  )
);

alter table public.institution_access_policies enable row level security;

drop policy if exists "institution staff can view access policy"
  on public.institution_access_policies;

create policy "institution staff can view access policy"
  on public.institution_access_policies for select
  to authenticated
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA', 'DOCENTE')
  );

drop policy if exists "admins can manage access policy"
  on public.institution_access_policies;

create policy "admins can manage access policy"
  on public.institution_access_policies for all
  to authenticated
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() = 'ADMIN'
  )
  with check (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() = 'ADMIN'
  );

drop trigger if exists institution_access_policies_updated_at
  on public.institution_access_policies;

create trigger institution_access_policies_updated_at
before update on public.institution_access_policies
for each row execute procedure public.touch_updated_at();

insert into public.institution_access_policies (institution_id)
select id
from public.institutions
on conflict (institution_id) do nothing;

alter table public.access_events
  add column if not exists policy_failure public.access_policy_failure,
  add column if not exists authenticator_required boolean not null default false,
  add column if not exists authenticator_presented boolean not null default false,
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb;

comment on table public.institution_access_policies is
  'Configura si ingreso y salida requieren autenticador y si ese requisito es excluyente por institucion.';

comment on column public.access_events.authenticator_required is
  'Indica si la politica vigente exigia QR/PIN para el evento.';

comment on column public.access_events.authenticator_presented is
  'Indica si el evento fue validado con un autenticador fuerte del MVP: QR o PIN.';
