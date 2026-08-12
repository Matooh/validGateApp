'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type LinkResult = { status?: string };

function redirectWithMessage(kind: 'success' | 'error' | 'info', message: string): never {
  redirect(`/links?kind=${kind}&message=${encodeURIComponent(message)}`);
}

function parseLocalDateTime(value: string, offsetMinutes: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utcMilliseconds = Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute),
  ) + offsetMinutes * 60_000;
  const parsed = new Date(utcMilliseconds);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function inviteAuthorizedRetiradorAction(formData: FormData) {
  const { profile } = await requireUser();
  if (!profile || !['ADMIN', 'APODERADO'].includes(profile.role)) {
    redirectWithMessage('error', 'No tienes permisos para autorizar retiradores.');
  }

  const studentId = Number(formData.get('student_id'));
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const timezoneOffset = Number(formData.get('timezone_offset_minutes'));
  const validFromIso = String(formData.get('valid_from_iso') ?? '');
  const validUntilIso = String(formData.get('valid_until_iso') ?? '');
  const validFrom = validFromIso ? new Date(validFromIso) : parseLocalDateTime(String(formData.get('valid_from') ?? ''), timezoneOffset);
  const validUntil = validUntilIso ? new Date(validUntilIso) : parseLocalDateTime(String(formData.get('valid_until') ?? ''), timezoneOffset);

  if (
    !Number.isInteger(studentId) || studentId <= 0 || !firstName || !lastName
    || !/^\S+@\S+\.\S+$/.test(email) || !validFrom || !validUntil
    || Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())
    || validUntil <= validFrom || validUntil <= new Date()
  ) {
    redirectWithMessage('error', 'Revisa los datos y el período de vigencia de la autorización.');
  }

  const supabase = await createClient();
  const { data: availableStudents, error: studentsError } = await supabase
    .rpc('list_students_available_for_retirador_authorization');
  if (studentsError || !(availableStudents ?? []).some((item: { student_id: number }) => item.student_id === studentId)) {
    redirectWithMessage('error', 'No puedes autorizar retiros para ese estudiante.');
  }

  const admin = createAdminClient();
  if (!admin) {
    redirectWithMessage('error', 'Las invitaciones por correo todavía no están configuradas en el servidor.');
  }

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, role')
    .ilike('email', email)
    .maybeSingle();

  let retrieverProfileId = existingProfile?.id as string | undefined;
  if (existingProfile && !['APODERADO', 'RETIRADOR_AUTORIZADO'].includes(existingProfile.role)) {
    redirectWithMessage('error', 'Ese correo pertenece a una cuenta con un rol incompatible.');
  }

  if (!retrieverProfileId) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/links`,
      data: { first_name: firstName, last_name: lastName, validgate_role: 'RETIRADOR_AUTORIZADO' },
    });
    if (invitationError || !invitation.user) {
      redirectWithMessage('error', 'No se pudo enviar la invitación. Verifica el correo e inténtalo nuevamente.');
    }
    retrieverProfileId = invitation.user.id;

    const { error: profileError } = await admin.from('profiles').upsert({
      id: retrieverProfileId,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'RETIRADOR_AUTORIZADO',
      institution_id: profile.institution_id,
    }, { onConflict: 'id' });
    if (profileError) {
      redirectWithMessage('error', 'La invitación fue enviada, pero no se pudo completar el perfil de acceso.');
    }
  }

  const { data, error } = await supabase.rpc('create_authorized_retirador_link', {
    p_retirador_profile_id: retrieverProfileId,
    p_student_id: studentId,
    p_valid_from: validFrom.toISOString(),
    p_valid_until: validUntil.toISOString(),
  });
  const linkStatus = (data as LinkResult | null)?.status;
  if (linkStatus === 'already_guardian') {
    redirectWithMessage('info', 'Esa persona ya está vinculada como apoderado del estudiante.');
  }
  if (linkStatus === 'authorization_exists') {
    redirectWithMessage('info', 'Ya existe una autorización vigente o futura para esa persona y estudiante.');
  }
  if (error || linkStatus !== 'created') {
    redirectWithMessage('error', 'No se pudo guardar la autorización temporal.');
  }

  revalidatePath('/links');
  revalidatePath('/dashboard');
  redirectWithMessage('success', existingProfile
    ? 'Autorización creada usando la cuenta existente.'
    : 'Invitación enviada y autorización creada correctamente.');
}

export async function revokeAuthorizedRetiradorAction(formData: FormData) {
  const relationId = Number(formData.get('relation_id'));
  if (!Number.isInteger(relationId) || relationId <= 0) {
    redirectWithMessage('error', 'La autorización seleccionada no es válida.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('revoke_authorized_retirador_link', {
    p_relation_id: relationId,
  });
  if (error || (data as LinkResult | null)?.status !== 'revoked') {
    redirectWithMessage('error', 'No fue posible revocar la autorización.');
  }

  revalidatePath('/links');
  revalidatePath('/dashboard');
  redirectWithMessage('success', 'Autorización revocada correctamente.');
}
