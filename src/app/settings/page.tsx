import { AppNav } from '@/components/app-nav';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { requireUser } from '@/lib/auth';
import {
  updateAccessPolicyAction,
  updatePickupSettingsAction,
  updateProfileAction,
} from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ACCESS_POLICY } from '@/lib/types';
import { PasswordChangeForm } from '@/components/password-change-form';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;
  const isAdmin = profile?.role === 'ADMIN';

  const { data: fullProfile } = await supabase
    .from('profiles')
    .select('rut, phone')
    .eq('id', profile?.id)
    .maybeSingle();

  const { data: accessPolicy } = isAdmin && profile?.institution_id
    ? await supabase
        .from('institution_access_policies')
        .select(
          'entry_requires_authenticator, entry_authenticator_is_exclusive, exit_requires_authenticator, exit_authenticator_is_exclusive, exit_requires_observation_without_authenticator',
        )
        .eq('institution_id', profile.institution_id)
        .maybeSingle()
    : { data: null };

  const policy = { ...DEFAULT_ACCESS_POLICY, ...(accessPolicy ?? {}) };
  const { data: pickupSettings } = isAdmin && profile?.institution_id
    ? await supabase
        .from('institution_pickup_settings')
        .select('pin_ttl_minutes, max_pin_attempts, student_notification_message')
        .eq('institution_id', profile.institution_id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav role={profile?.role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configuración de perfil</h1>
          <p className="mt-2 text-slate-600">Actualiza tu información personal y cambia tu password.</p>
        </div>

        {params.message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.message}</p>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <form action={updateProfileAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Datos personales</h2>
            <div>
              <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-slate-700">Nombres</label>
              <input id="first_name" name="first_name" defaultValue={profile?.first_name ?? ''} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <div>
              <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-slate-700">Apellidos</label>
              <input id="last_name" name="last_name" defaultValue={profile?.last_name ?? ''} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <div>
              <label htmlFor="rut" className="mb-2 block text-sm font-medium text-slate-700">RUT</label>
              <input id="rut" name="rut" defaultValue={fullProfile?.rut ?? ''} placeholder="12345678-5" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">Teléfono</label>
              <input id="phone" name="phone" defaultValue={fullProfile?.phone ?? ''} placeholder="+56979999999" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <PendingSubmitButton
              pendingLabel="Guardando..."
              className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              Guardar cambios
            </PendingSubmitButton>
          </form>

          <PasswordChangeForm />
        </div>

        {isAdmin ? (
          <form
            action={updatePickupSettingsAction}
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Retiro con PIN dual</h2>
              <p className="mt-1 text-sm text-slate-500">Configuración institucional aplicada a los PIN del apoderado y del estudiante.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="pin_ttl_minutes" className="mb-2 block text-sm font-medium text-slate-700">Vigencia del PIN (minutos)</label>
                <input id="pin_ttl_minutes" name="pin_ttl_minutes" type="number" min={1} max={60} required defaultValue={pickupSettings?.pin_ttl_minutes ?? 5} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>
              <div>
                <label htmlFor="max_pin_attempts" className="mb-2 block text-sm font-medium text-slate-700">Máximo de intentos por persona</label>
                <input id="max_pin_attempts" name="max_pin_attempts" type="number" min={1} max={10} required defaultValue={pickupSettings?.max_pin_attempts ?? 3} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>
            </div>
            <div>
              <label htmlFor="student_notification_message" className="mb-2 block text-sm font-medium text-slate-700">Mensaje para el estudiante</label>
              <textarea id="student_notification_message" name="student_notification_message" rows={3} required defaultValue={pickupSettings?.student_notification_message ?? '{guardian_name} está esperando por ti'} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <p className="mt-1 text-xs text-slate-500">Usa {'{guardian_name}'} para insertar el nombre del apoderado.</p>
            </div>
            <PendingSubmitButton pendingLabel="Guardando..." className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800">
              Guardar configuración de retiro
            </PendingSubmitButton>
          </form>
        ) : null}

        {isAdmin ? (
          <form
            action={updateAccessPolicyAction}
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Política de ingreso y salida
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Define si portería puede registrar eventos manuales o si debe exigir QR/PIN.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-900">Ingreso</legend>
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    name="entry_requires_authenticator"
                    type="checkbox"
                    defaultChecked={policy.entry_requires_authenticator}
                    className="mt-1 h-4 w-4"
                  />
                  Exigir autenticador QR/PIN para registrar ingreso.
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    name="entry_authenticator_is_exclusive"
                    type="checkbox"
                    defaultChecked={policy.entry_authenticator_is_exclusive}
                    className="mt-1 h-4 w-4"
                  />
                  Hacerlo excluyente: rechazar ingreso manual si no se presenta autenticador.
                </label>
              </fieldset>

              <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-900">Salida</legend>
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    name="exit_requires_authenticator"
                    type="checkbox"
                    defaultChecked={policy.exit_requires_authenticator}
                    className="mt-1 h-4 w-4"
                  />
                  Exigir autenticador QR/PIN para registrar salida.
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    name="exit_authenticator_is_exclusive"
                    type="checkbox"
                    defaultChecked={policy.exit_authenticator_is_exclusive}
                    className="mt-1 h-4 w-4"
                  />
                  Hacerlo excluyente: rechazar salida manual si no se presenta autenticador.
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    name="exit_requires_observation_without_authenticator"
                    type="checkbox"
                    defaultChecked={policy.exit_requires_observation_without_authenticator}
                    className="mt-1 h-4 w-4"
                  />
                  Solicitar observación cuando la salida se registre sin QR/PIN.
                </label>
              </fieldset>
            </div>

            <PendingSubmitButton
              pendingLabel="Guardando..."
              className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Guardar política de acceso
            </PendingSubmitButton>
          </form>
        ) : null}
      </section>
    </main>
  );
}
