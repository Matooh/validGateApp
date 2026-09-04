import { redirect } from 'next/navigation';

import { updateUserRoleAction } from '@/app/actions/auth';
import { AppNav } from '@/components/app-nav';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const roleLabels: Record<string, string> = {
  PENDIENTE: 'Sin rol asignado',
  APODERADO: 'Apoderado',
  PORTERIA: 'Portería',
  DOCENTE: 'Docente',
  ESTUDIANTE: 'Estudiante',
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ message?: string; kind?: string }> }) {
  const { profile } = await requireUser();
  if (profile?.role !== 'ADMIN' || !profile.institution_id) redirect('/dashboard?kind=error&message=No+tienes+permisos+para+gestionar+usuarios');
  const admin = createAdminClient();
  if (!admin) redirect('/dashboard?kind=error&message=La+gestión+de+usuarios+no+está+disponible');
  const { data: users } = await admin.from('profiles').select('id, first_name, last_name, email, role').eq('institution_id', profile.institution_id).neq('id', profile.id).order('last_name').order('first_name');
  const params = await searchParams;

  return <main className="min-h-screen bg-slate-50"><AppNav role={profile.role} displayName={[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email} /><section className="mx-auto max-w-5xl space-y-6 px-6 py-8"><div><p className="text-sm uppercase tracking-[0.25em] text-sky-700">Administración</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Usuarios</h1><p className="mt-2 text-slate-600">Asigna el rol que corresponde a cada usuario registrado en tu institución.</p></div>{params.message ? <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${params.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{params.message}</p> : null}<section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold text-slate-900">Usuarios registrados</h2>{users?.length ? users.map((user) => <article key={user.id} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto]"><div><h3 className="font-semibold text-slate-900">{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Usuario sin nombre'}</h3><p className="text-sm text-slate-600">{user.email}</p><p className="mt-1 text-sm text-slate-500">Rol actual: <span className="font-medium text-slate-700">{roleLabels[user.role] ?? user.role}</span></p></div><form action={updateUserRoleAction} className="flex items-end gap-2"><input type="hidden" name="user_id" value={user.id} /><label className="text-sm text-slate-600">Asignar rol<select name="role" defaultValue={user.role} className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="PENDIENTE">Sin rol asignado</option><option value="APODERADO">Apoderado</option><option value="PORTERIA">Portería</option><option value="DOCENTE">Docente</option><option value="ESTUDIANTE">Estudiante</option></select></label><button type="submit" className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800">Guardar rol</button></form></article>) : <p className="text-sm text-slate-600">No hay otros usuarios registrados en tu institución.</p>}</section></section></main>;
}
