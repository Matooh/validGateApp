import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types';

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, institution_id')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

export async function requireStaff() {
  const { user, profile } = await requireUser();

  const allowedRoles: AppRole[] = ['ADMIN', 'PORTERIA', 'DOCENTE'];
  if (!profile || !allowedRoles.includes(profile.role as AppRole)) {
    redirect('/dashboard?message=No+tienes+permisos+para+esta+seccion');
  }

  return { user, profile };
}
