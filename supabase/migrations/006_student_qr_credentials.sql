create table if not exists public.student_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id bigint not null references public.students(id) on delete cascade,
  institution_id bigint null references public.institutions(id),
  purpose text not null default 'ACCESS_VALIDATION',
  expires_at timestamptz not null,
  used_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_student_qr_credentials_student_id
on public.student_qr_credentials(student_id);

create index if not exists idx_student_qr_credentials_expires_at
on public.student_qr_credentials(expires_at);

create index if not exists idx_student_qr_credentials_institution_id
on public.student_qr_credentials(institution_id);

alter table public.student_qr_credentials enable row level security;

drop policy if exists "staff can read qr credentials in institution"
  on public.student_qr_credentials;

create policy "staff can read qr credentials in institution"
  on public.student_qr_credentials for select
  to authenticated
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  );

drop policy if exists "guardians can read linked student qr credentials"
  on public.student_qr_credentials;

create policy "guardians can read linked student qr credentials"
  on public.student_qr_credentials for select
  to authenticated
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = student_qr_credentials.student_id
        and gs.guardian_profile_id = auth.uid()
    )
  );

drop policy if exists "staff can create qr credentials in institution"
  on public.student_qr_credentials;

create policy "staff can create qr credentials in institution"
  on public.student_qr_credentials for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
    and exists (
      select 1
      from public.students s
      where s.id = student_qr_credentials.student_id
        and s.institution_id = student_qr_credentials.institution_id
    )
  );

drop policy if exists "guardians can create linked student qr credentials"
  on public.student_qr_credentials;

create policy "guardians can create linked student qr credentials"
  on public.student_qr_credentials for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.students s
      join public.guardian_students gs on gs.student_id = s.id
      where s.id = student_qr_credentials.student_id
        and s.institution_id = student_qr_credentials.institution_id
        and gs.guardian_profile_id = auth.uid()
    )
  );

drop policy if exists "staff can revoke qr credentials in institution"
  on public.student_qr_credentials;

create policy "staff can revoke qr credentials in institution"
  on public.student_qr_credentials for update
  to authenticated
  using (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  )
  with check (
    institution_id = public.current_user_institution_id()
    and public.current_user_role() in ('ADMIN', 'PORTERIA')
  );

comment on table public.student_qr_credentials is
  'Credenciales QR temporales y opacas para validar eventos de acceso de estudiantes.';

comment on column public.student_qr_credentials.id is
  'Identificador opaco que viaja en el QR como validgate-auth:{uuid}. No contiene datos personales.';

comment on column public.student_qr_credentials.purpose is
  'Proposito funcional de la credencial. MVP: ACCESS_VALIDATION.';
