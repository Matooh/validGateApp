import { redirect } from 'next/navigation';

import { AuthenticationQrCard } from '@/components/authentication-qr-card';
import { AppNav } from '@/components/app-nav';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getCurrentStudentForAuthenticatedUser } from '@/lib/students/get-current-student';
import { createClient } from '@/lib/supabase/server';

type LinkedStudent = {
  id: number;
  relation_type: string | null;
  students:
    | {
        id: number;
        first_name: string;
        last_name: string;
        is_in_institution: boolean;
      }
    | {
        id: number;
        first_name: string;
        last_name: string;
        is_in_institution: boolean;
      }[]
    | null;
};

type ActiveQrCredential = {
  student_id: number;
  id: string;
  expires_at: string;
};

function getStudentFromLink(link: LinkedStudent) {
  return Array.isArray(link.students) ? link.students[0] : link.students;
}

export default async function AuthenticationsPage() {
  const { user, profile } = await requireUser();
  const supabase = await createClient();

  if (!hasPermission(profile?.role ?? null, 'view_authentications')) {
    redirect('/dashboard');
  }

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email;

  const { data: linkedStudents } =
    profile?.role === 'APODERADO'
      ? await supabase
          .from('guardian_students')
          .select('id, relation_type, students(id, first_name, last_name, is_in_institution)')
          .eq('guardian_profile_id', user.id)
          .order('id', { ascending: true })
      : { data: [] };

  const currentStudent =
    profile?.role === 'ESTUDIANTE'
      ? await getCurrentStudentForAuthenticatedUser()
      : null;

  const students = ((linkedStudents ?? []) as LinkedStudent[])
    .map(getStudentFromLink)
    .filter((student): student is NonNullable<ReturnType<typeof getStudentFromLink>> =>
      Boolean(student),
    );
  const credentialStudentIds =
    profile?.role === 'ESTUDIANTE' && currentStudent
      ? [currentStudent.studentId]
      : students.map((student) => student.id);

  const { data: activeQrCredentials } =
    credentialStudentIds.length > 0
      ? await supabase
          .from('student_qr_credentials')
          .select('student_id, id, expires_at')
          .in('student_id', credentialStudentIds)
          .eq('created_by', user.id)
          .is('used_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
      : { data: [] };

  const activeQrByStudentId = new Map<number, ActiveQrCredential>();
  ((activeQrCredentials ?? []) as ActiveQrCredential[]).forEach((credential) => {
    if (!activeQrByStudentId.has(credential.student_id)) {
      activeQrByStudentId.set(credential.student_id, credential);
    }
  });

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <AppNav role={profile?.role} displayName={displayName} />

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg sm:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-200">
            Credenciales
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            Autenticaciones ValidGate
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
            Métodos disponibles para validar ingreso, salida y retiro de estudiantes.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">QR dinámico</p>
            <p className="mt-2 text-sm text-slate-500">
              Credencial temporal para presentar en portería.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Preparado
            </span>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">PIN temporal</p>
            <p className="mt-2 text-sm text-slate-500">
              Método de contingencia con vencimiento y límite de intentos.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Siguiente fase
            </span>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">MFA</p>
            <p className="mt-2 text-sm text-slate-500">
              Segundo factor para perfiles sensibles como administración y portería.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              Supabase Auth
            </span>
          </article>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Credenciales QR</h2>
            <p className="mt-1 text-sm text-slate-500">
              Los códigos mostrados son opacos y se renovarán cuando se implemente el ciclo
              completo de expiración y uso único.
            </p>
          </div>

          {profile?.role === 'APODERADO' ? (
            students.length > 0 ? (
              <div className="space-y-4">
                {students.map((student) => (
                  (() => {
                    const activeQr = activeQrByStudentId.get(student.id);

                    return (
                      <AuthenticationQrCard
                        key={student.id}
                        title={`${student.first_name} ${student.last_name}`}
                        subtitle={student.is_in_institution ? 'Dentro de la institución' : 'Fuera de la institución'}
                        studentId={student.id}
                        initialCredentialId={activeQr?.id}
                        initialExpiresAt={activeQr?.expires_at}
                      />
                    );
                  })()
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No tienes estudiantes vinculados para mostrar credenciales.
              </div>
            )
          ) : profile?.role === 'ESTUDIANTE' ? (
            (() => {
              const activeQr = currentStudent
                ? activeQrByStudentId.get(currentStudent.studentId)
                : null;

              return (
                <AuthenticationQrCard
                  title={
                    currentStudent
                      ? `${currentStudent.firstName} ${currentStudent.lastName}`
                      : 'Credencial estudiante'
                  }
                  subtitle={
                    currentStudent
                      ? currentStudent.isInInstitution
                        ? 'Dentro de la institución'
                        : 'Fuera de la institución'
                      : 'QR personal para validación en portería'
                  }
                  studentId={currentStudent?.studentId}
                  initialCredentialId={activeQr?.id}
                  initialExpiresAt={activeQr?.expires_at}
                />
              );
            })()
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No hay credenciales disponibles para este rol.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
