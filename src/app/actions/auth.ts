'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { normalizeChileMobilePhone } from '@/lib/chile/phone';
import { normalizeRut } from '@/lib/chile/rut';
import { APP_MESSAGES } from '@/lib/messages';
import type { FormState } from '@/lib/types';

export async function signInAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();

  if (!email || !password) {
    return { success: false, message: APP_MESSAGES.auth.loginRequired };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, message: APP_MESSAGES.auth.genericLoginError };
  }

  redirect('/dashboard?toast=LOGIN_SUCCESS');
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
  redirect('/?toast=LOGOUT_SUCCESS');
}

export async function updateProfileAction(formData: FormData) {
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const rutValue = String(formData.get('rut') ?? '').trim();
  const phoneValue = String(formData.get('phone') ?? '').trim();
  const rut = rutValue ? normalizeRut(rutValue) : null;
  const phone = phoneValue ? normalizeChileMobilePhone(phoneValue) : null;

  if (rutValue && !rut) {
    redirect('/settings?message=El+RUT+ingresado+no+es+válido');
  }

  if (phoneValue && !phone) {
    redirect('/settings?message=El+teléfono+debe+usar+formato+%2B56979999999');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName, rut, phone })
    .eq('id', user.id);

  if (error) {
    redirect('/settings?message=No+se+pudo+actualizar+el+perfil');
  }

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  redirect('/settings?message=Actualizacion+éxitosa');
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

export async function updateAccessPolicyAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'ADMIN' || !profile.institution_id) {
    redirect('/settings?message=No+tienes+permisos+para+modificar+está+configuración');
  }

  const entryRequiresAuthenticator = formData.get('entry_requires_authenticator') === 'on';
  const exitRequiresAuthenticator = formData.get('exit_requires_authenticator') === 'on';

  const payload = {
    institution_id: profile.institution_id,
    entry_requires_authenticator: entryRequiresAuthenticator,
    entry_authenticator_is_exclusive:
      entryRequiresAuthenticator && formData.get('entry_authenticator_is_exclusive') === 'on',
    exit_requires_authenticator: exitRequiresAuthenticator,
    exit_authenticator_is_exclusive:
      exitRequiresAuthenticator && formData.get('exit_authenticator_is_exclusive') === 'on',
    exit_requires_observation_without_authenticator:
      formData.get('exit_requires_observation_without_authenticator') === 'on',
  };

  const { error } = await supabase
    .from('institution_access_policies')
    .upsert(payload, { onConflict: 'institution_id' });

  if (error) {
    redirect('/settings?message=No+se+pudo+actualizar+la+política+de+acceso');
  }

  revalidatePath('/guard');
  revalidatePath('/settings');
  redirect('/settings?message=Política+de+acceso+actualizada');
}
