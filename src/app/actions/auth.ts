'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/types';

export async function signInAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();

  if (!email || !password) {
    return { success: false, message: 'Debes ingresar user y password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, message: 'Credenciales incorrectas.' };
  }

  redirect('/dashboard?message=Login+exitoso');
}

export async function signUpAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();

  if (!email || !password) {
    return { success: false, message: 'Debes ingresar user y password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    return { success: false, message: error.message };
  }

  redirect('/?message=Registro+exitoso');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/?message=Logout+exitoso');
}

export async function updateProfileAction(formData: FormData) {
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName })
    .eq('id', user.id);

  if (error) {
    redirect('/settings?message=No+se+pudo+actualizar+el+perfil');
  }

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  redirect('/settings?message=Actualizacion+exitosa');
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get('password') ?? '').trim();

  if (password.length < 6) {
    redirect('/settings?message=La+password+debe+tener+al+menos+6+caracteres');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect('/settings?message=No+se+pudo+cambiar+la+password');
  }

  redirect('/settings?message=Password+actualizada');
}
