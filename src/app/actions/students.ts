'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export async function linkStudentByCodeAction(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();

  if (!code) {
    redirect('/students/link?kind=error&message=Ingresa+un+codigo+de+vinculacion');
  }

  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('link_student_by_code', {
    p_code: code,
  });

  if (error) {
    console.error('link_student_by_code error:', error);
    redirect('/students/link?kind=error&message=No+se+pudo+vincular+el+estudiante');
  }

  const status = data?.status;

  if (status === 'invalid_code') {
    redirect('/students/link?kind=error&message=Codigo+de+vinculacion+no+valido');
  }

  if (status === 'already_linked') {
    redirect('/students/link?kind=info&message=Este+estudiante+ya+esta+vinculado+a+tu+cuenta');
  }

  if (status === 'linked') {
    revalidatePath('/dashboard');
    redirect('/dashboard?message=Vinculacion+exitosa');
  }

  redirect('/students/link?kind=error&message=Respuesta+inesperada+del+servidor');
}

export async function unlinkStudentAction(formData: FormData) {
  const relationId = Number(formData.get('relation_id'));
  const { user } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('guardian_students')
    .delete()
    .eq('id', relationId)
    .eq('guardian_profile_id', user.id);

  if (error) {
    redirect('/dashboard?message=No+se+pudo+desvincular+el+estudiante');
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?message=Desvinculacion+exitosa');
}

export async function updateStudentAction(formData: FormData) {
  const id = Number(formData.get('student_id'));
  const canLeaveAlone = formData.get('can_leave_alone') === 'on';

  const supabase = await createClient();
  const { error } = await supabase
    .from('students')
    .update({ can_leave_alone: canLeaveAlone })
    .eq('id', id);

  if (error) {
    redirect(`/students/${id}?message=No+se+pudo+actualizar+el+estudiante`);
  }

  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?message=Actualizacion+exitosa`);
}

export async function updateAttendanceStatusAction(formData: FormData) {
  const studentId = Number(formData.get('student_id'));
  const scheduleBlockId = Number(formData.get('schedule_block_id'));
  const status = String(formData.get('status') ?? 'AUSENTE');

  const supabase = await createClient();
  const { error } = await supabase.from('attendance_blocks').upsert(
    {
      student_id: studentId,
      schedule_block_id: scheduleBlockId,
      attendance_date: new Date().toISOString().slice(0, 10),
      status,
      note: 'Actualizado manualmente desde el MVP',
    },
    { onConflict: 'student_id,schedule_block_id,attendance_date' },
  );

  if (error) {
    redirect(`/students/${studentId}?message=No+se+pudo+actualizar+la+asistencia`);
  }

  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}?message=Asistencia+actualizada`);
}
