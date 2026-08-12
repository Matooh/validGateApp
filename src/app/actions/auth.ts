'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { normalizeChileMobilePhone } from '@/lib/chile/phone';
import { normalizeRut } from '@/lib/chile/rut';
import { APP_MESSAGES } from '@/lib/messages';
import { validatePassword } from '@/lib/password';
import type { FormState } from '@/lib/types';

const SESSION_PERSISTENCE_COOKIE = 'validgate-session-persistence';

export async function signInAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const rememberMe = formData.get('remember_me') === 'on';

  if (!email || !password) {
    return { success: false, message: APP_MESSAGES.auth.loginRequired };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, message: APP_MESSAGES.auth.genericLoginError };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_PERSISTENCE_COOKIE,
    rememberMe ? 'persistent' : 'session',
    {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      ...(rememberMe ? { maxAge: 400 * 24 * 60 * 60 } : {}),
    },
  );

  if (!rememberMe) {
    cookieStore
      .getAll()
      .filter(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))
      .forEach(({ name, value }) => {
        cookieStore.set(name, value, {
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      });
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
  const { error } = await supabase.auth.signOut({ scope: 'global' });

  if (error) {
    const cookieStore = await cookies();

    cookieStore
      .getAll()
      .filter(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))
      .forEach(({ name }) => cookieStore.delete(name));
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_PERSISTENCE_COOKIE);

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

export type PasswordChangeState = {
  success: boolean;
  message: string;
  fieldErrors: Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>;
};

export async function updatePasswordAction(
  _: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const currentPassword = String(formData.get('current_password') ?? '');
  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');
  const fieldErrors: PasswordChangeState['fieldErrors'] = {};

  if (!currentPassword) fieldErrors.currentPassword = 'La contraseña actual es obligatoria.';
  const passwordError = validatePassword(newPassword);
  if (passwordError) fieldErrors.newPassword = passwordError;
  if (!confirmPassword) fieldErrors.confirmPassword = 'Debes repetir la nueva contraseña.';
  else if (newPassword !== confirmPassword) fieldErrors.confirmPassword = 'Las contraseñas nuevas no coinciden.';
  if (currentPassword && newPassword && currentPassword === newPassword) {
    fieldErrors.newPassword = 'La nueva contraseña debe ser diferente de la actual.';
  }
  if (Object.keys(fieldErrors).length) {
    return { success: false, message: 'Revisa los campos indicados.', fieldErrors };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (userError || !email) {
    return { success: false, message: 'Tu sesión no es válida. Vuelve a iniciar sesión.', fieldErrors: {} };
  }

  const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthenticationError) {
    return {
      success: false,
      message: 'No fue posible validar la contraseña actual.',
      fieldErrors: { currentPassword: 'La contraseña actual no es correcta.' },
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return {
      success: false,
      message: 'No fue posible cambiar la contraseña. Inténtalo nuevamente.',
      fieldErrors: {},
    };
  }

  return { success: true, message: 'Contraseña actualizada correctamente.', fieldErrors: {} };
}

export async function updatePickupSettingsAction(formData: FormData) {
  const { profile } = await requireUser();
  if (profile?.role !== 'ADMIN' || !profile.institution_id) {
    redirect('/settings?message=No+tienes+permisos+para+modificar+esta+configuraci%C3%B3n');
  }

  const pinTtlMinutes = Number(formData.get('pin_ttl_minutes'));
  const maxPinAttempts = Number(formData.get('max_pin_attempts'));
  const studentNotificationMessage = String(formData.get('student_notification_message') ?? '').trim();

  if (!Number.isInteger(pinTtlMinutes) || pinTtlMinutes < 1 || pinTtlMinutes > 60) {
    redirect('/settings?message=La+vigencia+del+PIN+debe+estar+entre+1+y+60+minutos');
  }
  if (!Number.isInteger(maxPinAttempts) || maxPinAttempts < 1 || maxPinAttempts > 10) {
    redirect('/settings?message=Los+intentos+deben+estar+entre+1+y+10');
  }
  if (!studentNotificationMessage) {
    redirect('/settings?message=El+mensaje+para+el+estudiante+es+obligatorio');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('institution_pickup_settings').upsert({
    institution_id: profile.institution_id,
    pin_ttl_minutes: pinTtlMinutes,
    max_pin_attempts: maxPinAttempts,
    student_notification_message: studentNotificationMessage,
  }, { onConflict: 'institution_id' });

  if (error) {
    redirect('/settings?message=No+se+pudo+actualizar+la+configuraci%C3%B3n+de+retiro');
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?message=Configuraci%C3%B3n+de+retiro+actualizada');
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
