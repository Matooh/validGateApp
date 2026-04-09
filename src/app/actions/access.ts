'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function recordAccessEventAction(formData: FormData) {
  const selectionMode = String(formData.get('selection_mode') ?? 'student');
  const studentIdsFromArray = formData
    .getAll('student_ids')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const singleStudentId = Number(formData.get('student_id'));
  const studentIds = selectionMode === 'course'
    ? studentIdsFromArray
    : (Number.isFinite(singleStudentId) && singleStudentId > 0 ? [singleStudentId] : []);

  const eventType = String(formData.get('event_type') ?? 'INGRESO');
  const exitKindValue = String(formData.get('exit_kind') ?? 'REGULAR');
  const validationKind = String(formData.get('validation_kind') ?? 'MANUAL');
  const result = String(formData.get('result') ?? 'APROBADO');
  const notes = String(formData.get('notes') ?? '').trim();

  if (studentIds.length === 0) {
    redirect('/guard?message=Debes+seleccionar+al+menos+un+estudiante');
  }

  const { user } = await requireStaff();
  const supabase = await createClient();

  const payload = studentIds.map((studentId) => ({
    student_id: studentId,
    recorded_by_profile_id: user.id,
    event_type: eventType,
    validation_kind: validationKind,
    result,
    notes,
    ...(eventType === 'SALIDA' ? { exit_kind: exitKindValue } : {}),
  }));

  const { error } = await supabase.from('access_events').insert(payload);

  if (error) {
    redirect('/guard?message=No+se+pudo+registrar+el+evento');
  }

  revalidatePath('/guard');
  revalidatePath('/dashboard');
  const successMessage = studentIds.length === 1
    ? 'Evento+registrado'
    : `Eventos+registrados+para+${studentIds.length}+estudiantes`;
  redirect(`/guard?message=${successMessage}`);
}
