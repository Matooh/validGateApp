'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type LinkResult = { status?: string };

function redirectWithMessage(kind: 'success' | 'error' | 'info', message: string): never {
  redirect(`/links?kind=${kind}&message=${encodeURIComponent(message)}`);
}

function parseLocalDateTime(value: string, offsetMinutes: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) + offsetMinutes * 60_000);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function inviteAuthorizedRetiradorAction(formData: FormData) {
  const { profile } = await requireUser();
  if (!profile || !['ADMIN', 'APODERADO'].includes(profile.role)) redirectWithMessage('error', 'No tienes permisos para autorizar Apoderados Secundarios.');

  const studentId = Number(formData.get('student_id'));
  const guardianProfileId = String(formData.get('guardian_profile_id') ?? '').trim();
  const timezoneOffset = Number(formData.get('timezone_offset_minutes'));
  const validFromIso = String(formData.get('valid_from_iso') ?? '');
  const validUntilIso = String(formData.get('valid_until_iso') ?? '');
  const validFrom = validFromIso ? new Date(validFromIso) : parseLocalDateTime(String(formData.get('valid_from') ?? ''), timezoneOffset);
  const validUntil = validUntilIso ? new Date(validUntilIso) : parseLocalDateTime(String(formData.get('valid_until') ?? ''), timezoneOffset);
  const authorizationConfirmed = formData.get('confirm_existing_retriever_authorization') === 'on';

  if (!Number.isInteger(studentId) || studentId <= 0 || !guardianProfileId || !validFrom || !validUntil || Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime()) || validUntil <= validFrom || validUntil <= new Date() || !authorizationConfirmed) {
    redirectWithMessage('error', 'Revisa el estudiante, el apoderado y el período de vigencia.');
  }

  const supabase = await createClient();
  const { data: availableStudents, error: studentsError } = await supabase.rpc('list_students_available_for_retirador_authorization');
  if (studentsError) redirectWithMessage('error', 'No fue posible verificar los estudiantes disponibles.');
  if (!(availableStudents ?? []).some((item: { student_id: number | string }) => Number(item.student_id) === studentId)) redirectWithMessage('error', 'No puedes autorizar retiros para ese estudiante.');

  const { data, error } = await supabase.rpc('create_authorized_retirador_link', {
    p_retirador_profile_id: guardianProfileId,
    p_student_id: studentId,
    p_valid_from: validFrom.toISOString(),
    p_valid_until: validUntil.toISOString(),
  });
  const linkStatus = (data as LinkResult | null)?.status;
  if (error || !['created', 'converted'].includes(linkStatus ?? '')) {
    console.error('invite_authorized_retirador_error', {
      code: error?.code,
      message: error?.message,
      status: linkStatus,
      studentId,
      guardianProfileId,
    });
  }
  if (linkStatus === 'already_guardian') redirectWithMessage('info', 'Esa persona ya está vinculada como Apoderado Primario del estudiante.');
  if (linkStatus === 'authorization_exists') redirectWithMessage('info', 'Ya existe una autorización vigente o futura para esa persona y estudiante.');
  if (error || !['created', 'converted'].includes(linkStatus ?? '')) redirectWithMessage('error', 'No se pudo guardar la autorización temporal.');

  revalidatePath('/links');
  revalidatePath('/dashboard');
  redirectWithMessage('success', 'Autorización creada correctamente.');
}

export async function revokeAuthorizedRetiradorAction(formData: FormData) {
  const relationId = Number(formData.get('relation_id'));
  if (!Number.isInteger(relationId) || relationId <= 0) redirectWithMessage('error', 'La autorización seleccionada no es válida.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('revoke_authorized_retirador_link', { p_relation_id: relationId });
  if (error || (data as LinkResult | null)?.status !== 'revoked') redirectWithMessage('error', 'No fue posible revocar la autorización.');
  revalidatePath('/links');
  revalidatePath('/dashboard');
  redirectWithMessage('success', 'Autorización revocada correctamente.');
}
