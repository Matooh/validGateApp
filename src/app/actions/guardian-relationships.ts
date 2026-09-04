'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type RelationshipResult = {
  status?: string;
};

const ALLOWED_RELATION_TYPES = new Set([
  'APODERADO_PRINCIPAL',
  'APODERADO',
  'RETIRADOR_AUTORIZADO',
]);

function redirectWithMessage(kind: 'success' | 'error' | 'info', message: string): never {
  redirect(`/admin/relationships?kind=${kind}&message=${encodeURIComponent(message)}`);
}

async function requireAdmin() {
  const { profile } = await requireUser();
  if (profile?.role !== 'ADMIN' || !profile.institution_id) {
    redirect('/dashboard?message=No+tienes+permisos+para+gestionar+vinculaciones');
  }
}

export async function saveGuardianRelationshipAction(formData: FormData) {
  await requireAdmin();

  const guardianProfileId = String(formData.get('guardian_profile_id') ?? '').trim();
  const studentId = Number(formData.get('student_id'));
  const relationType = String(formData.get('relation_type') ?? '').trim().toUpperCase();

  if (!guardianProfileId || !Number.isInteger(studentId) || studentId <= 0 || !ALLOWED_RELATION_TYPES.has(relationType)) {
    redirectWithMessage('error', 'Los datos de la vinculación no son válidos.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_link_guardian_to_student', {
    p_guardian_profile_id: guardianProfileId,
    p_student_id: studentId,
    p_relation_type: relationType,
  });

  if (error) {
    redirectWithMessage('error', 'No se pudo guardar la vinculación.');
  }

  const result = data as RelationshipResult | null;
  if (result?.status === 'promoted') {
    revalidatePath('/admin/relationships');
    revalidatePath('/links');
    revalidatePath('/dashboard');
    redirectWithMessage('success', 'La vinculacion secundaria fue promovida a Apoderado Primario.');
  }
  if (result?.status !== 'linked') {
    redirectWithMessage('error', 'La relación no cumple las reglas de la institución.');
  }

  revalidatePath('/admin/relationships');
  revalidatePath('/dashboard');
  redirectWithMessage('success', 'Vinculación guardada correctamente.');
}

export async function removeGuardianRelationshipAction(formData: FormData) {
  await requireAdmin();

  const relationId = Number(formData.get('relation_id'));
  if (!Number.isInteger(relationId) || relationId <= 0) {
    redirectWithMessage('error', 'La vinculación seleccionada no es válida.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_unlink_guardian_from_student', {
    p_relation_id: relationId,
  });

  if (error || (data as RelationshipResult | null)?.status !== 'unlinked') {
    redirectWithMessage('error', 'No se pudo eliminar la vinculación.');
  }

  revalidatePath('/admin/relationships');
  revalidatePath('/dashboard');
  redirectWithMessage('success', 'Vinculación eliminada correctamente.');
}
