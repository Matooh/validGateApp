'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { normalizeChileMobilePhone } from '@/lib/chile/phone';
import { normalizeRut } from '@/lib/chile/rut';

export async function createStudentAction(formData: FormData) {
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const courseId = Number(formData.get('course_id'));
  const canLeaveAlone = formData.get('can_leave_alone') === 'on';
  const createAccess = formData.get('create_access') === 'on';
  const accessEmail = String(formData.get('access_email') ?? '').trim().toLowerCase();
  const accessPassword = String(formData.get('access_password') ?? '');
  const { profile } = await requireUser();

  if (profile?.role !== 'ADMIN' || !profile.institution_id) {
    redirect('/dashboard?kind=error&message=No+tienes+permisos+para+crear+estudiantes');
  }
  if (!firstName || !lastName || !Number.isInteger(courseId) || courseId <= 0) {
    redirect('/admin/students?kind=error&message=Completa+los+datos+obligatorios');
  }
  if (createAccess && (!accessEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accessEmail) || accessPassword.length < 6)) {
    redirect('/admin/students?kind=error&message=Ingresa+un+correo+valido+y+una+contrase%C3%B1a+de+al+menos+6+caracteres');
  }

  const admin = createAdminClient();
  if (!admin) {
    redirect('/admin/students?kind=error&message=El+registro+de+estudiantes+no+est%C3%A1+disponible');
  }

  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('institution_id', profile.institution_id)
    .maybeSingle();

  if (!course) {
    redirect('/admin/students?kind=error&message=El+curso+no+pertenece+a+tu+instituci%C3%B3n');
  }

  const { data: student, error } = await admin
    .from('students')
    .insert({
      institution_id: profile.institution_id,
      course_id: courseId,
      first_name: firstName,
      last_name: lastName,
      can_leave_alone: canLeaveAlone,
    })
    .select('id, link_code')
    .single();

  if (error || !student) {
    console.error('create_student_error', { code: error?.code, message: error?.message });
    redirect('/admin/students?kind=error&message=No+se+pudo+crear+el+estudiante');
  }

  if (createAccess) {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: accessEmail,
      password: accessPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError || !authData.user) {
      await admin.from('students').delete().eq('id', student.id);
      const message = authError?.message.toLowerCase().includes('already')
        ? 'Ya existe una cuenta con ese correo'
        : 'No se pudo crear el acceso del estudiante';
      redirect(`/admin/students?kind=error&message=${encodeURIComponent(message)}`);
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: authData.user.id,
      email: accessEmail,
      first_name: firstName,
      last_name: lastName,
      role: 'ESTUDIANTE',
      institution_id: profile.institution_id,
    }, { onConflict: 'id' });

    const { error: linkError } = profileError
      ? { error: profileError }
      : await admin.from('student_profiles').insert({
          profile_id: authData.user.id,
          student_id: student.id,
          institution_id: profile.institution_id,
        });

    if (profileError || linkError) {
      console.error('create_student_access_error', {
        profileCode: profileError?.code,
        profileMessage: profileError?.message,
        linkCode: linkError?.code,
        linkMessage: linkError?.message,
      });
      await admin.from('students').delete().eq('id', student.id);
      await admin.auth.admin.deleteUser(authData.user.id);
      redirect('/admin/students?kind=error&message=No+se+pudo+asociar+el+acceso+al+estudiante');
    }
  }

  revalidatePath('/admin/students');
  revalidatePath('/admin/relationships');
  const accessMessage = createAccess ? `+Acceso+creado%3A+${encodeURIComponent(accessEmail)}.` : '';
  redirect(`/admin/students?kind=success&message=Estudiante+creado.+C%C3%B3digo+de+vinculaci%C3%B3n%3A+${encodeURIComponent(student.link_code)}.${accessMessage}`);
}

export async function linkStudentByCodeAction(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();

  if (!code) {
    redirect('/students/link?kind=error&message=Ingresa+un+código+de+vinculación');
  }

  const { profile } = await requireUser();
  if (profile?.role !== 'APODERADO') {
    redirect('/dashboard?kind=error&message=Solo+los+Apoderados+Primarios+pueden+vincularse+mediante+c%C3%B3digo');
  }
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
    redirect('/students/link?kind=error&message=Código+de+vinculación+no+válido');
  }

  if (status === 'already_linked') {
    redirect('/students/link?kind=info&message=Este+estudiante+ya+está+vinculado+a+tu+cuenta');
  }

  if (status === 'forbidden') {
    redirect('/dashboard?message=No+tienes+permisos+para+vincular+un+estudiante');
  }

  if (status === 'linked') {
    revalidatePath('/dashboard');
    redirect('/dashboard?message=Vinculación+exitosa');
  }

  redirect('/students/link?kind=error&message=Respuesta+inesperada+del+servidor');
}

export async function unlinkStudentAction(formData: FormData) {
  const relationId = Number(formData.get('relation_id'));
  const { user, profile } = await requireUser();
  if (profile?.role !== 'APODERADO') {
    redirect('/dashboard?message=No+tienes+permisos+para+desvincular+estudiantes');
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from('guardian_students')
    .delete()
    .eq('id', relationId)
    .eq('guardian_profile_id', user.id)
    .eq('relation_type', 'APODERADO');

  if (error) {
    redirect('/dashboard?message=No+se+pudo+desvincular+el+estudiante');
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?message=Desvinculación+éxitosa');
}

export async function updateStudentAction(formData: FormData) {
  const id = Number(formData.get('student_id'));
  const canLeaveAlone = formData.get('can_leave_alone') === 'on';
  const rutValue = String(formData.get('rut') ?? '').trim();
  const phoneCountryCode = String(formData.get('phone_country_code') ?? '').trim();
  const phoneInput = String(formData.get('phone') ?? '').trim();
  const phoneValue = phoneInput.startsWith('+') ? phoneInput : `${phoneCountryCode}${phoneInput}`;
  const rut = rutValue ? normalizeRut(rutValue) : null;
  const phone = phoneValue ? normalizeChileMobilePhone(phoneValue) : null;
  const { profile } = await requireUser();
  if (!profile || !['ADMIN', 'APODERADO', 'PORTERIA', 'DOCENTE'].includes(profile.role)) {
    redirect(`/students/${id}?message=No+tienes+permisos+para+actualizar`);
  }

  if (rutValue && !rut) {
    redirect(`/students/${id}?message=El+RUT+ingresado+no+es+válido`);
  }

  if (phoneValue && !phone) {
    redirect(`/students/${id}?message=El+teléfono+debe+usar+formato+%2B56979999999`);
  }

  const supabase = await createClient();
  const { data: updatedStudent, error } = await supabase
    .from('students')
    .update({ can_leave_alone: canLeaveAlone, rut, phone })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error || !updatedStudent) {
    redirect(`/students/${id}?message=No+se+pudo+actualizar+el+estudiante`);
  }

  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?message=${encodeURIComponent('Actualización exitosa')}`);
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
