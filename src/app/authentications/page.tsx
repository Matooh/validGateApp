import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  listGuardianPickupRequests,
  listMyPickupPins,
} from '@/app/actions/guardian-pickups';
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

  const pickupRequests = ['APODERADO', 'RETIRADOR_AUTORIZADO', 'ESTUDIANTE'].includes(
    profile?.role ?? '',
  )
    ? await listGuardianPickupRequests()
    : [];
  const activePickupRequests = pickupRequests.filter((request) =>
    ['PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED'].includes(
      request.status,
    ),
  );
  const pickupPins = await listMyPickupPins(
    activePickupRequests
      .filter((request) => request.status !== 'PENDING_STUDENT_RESPONSE')
      .map((request) => request.requestId),
  );
  const pickupPinByRequestId = new Map(
    pickupPins.map((pin) => [pin.requestId, pin]),
  );

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

        <section className="grid gap-4 md:grid-cols-2">
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
            <p className="text-sm font-semibold text-slate-900">PIN DUAL</p>
            <p className="mt-2 text-sm text-slate-500">
              Credenciales independientes para el estudiante y su responsable durante un retiro.
            </p>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              pickupPins.length > 0
                ? 'bg-emerald-100 text-emerald-700'
                : activePickupRequests.length > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
            }`}>
              {pickupPins.length > 0
                ? 'PIN vigente'
                : activePickupRequests.length > 0
                  ? 'Retiro pendiente'
                  : 'Sin retiro activo'}
            </span>
          </article>

        </section>

        {['APODERADO', 'RETIRADOR_AUTORIZADO', 'ESTUDIANTE'].includes(profile?.role ?? '') ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Credenciales PIN DUAL</h2>
              <p className="mt-1 text-sm text-slate-500">
                Los PIN se generan cuando el responsable inicia el retiro y el estudiante acepta la solicitud.
              </p>
            </div>

            {activePickupRequests.length > 0 ? (
              <div className="space-y-4">
                {activePickupRequests.map((request) => {
                  const pin = pickupPinByRequestId.get(request.requestId);
                  const actorLabel = profile?.role === 'ESTUDIANTE' ? 'estudiante' : 'responsable';

                  return (
                    <article key={request.requestId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{request.studentName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Retiro solicitado por {request.guardianName}.
                          </p>
                        </div>
                        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          {request.status === 'PENDING_STUDENT_RESPONSE'
                            ? 'Esperando aceptación'
                            : request.status === 'BOTH_VALIDATED'
                              ? 'Identidades validadas'
                              : 'Pendiente en portería'}
                        </span>
                      </div>

                      {pin ? (
                        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                            Tu PIN de {actorLabel}
                          </p>
                          <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-slate-900">
                            {pin.pin}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            Válido hasta {new Date(pin.expiresAt).toLocaleTimeString('es-CL')}. Preséntalo solo en portería.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          {request.status === 'PENDING_STUDENT_RESPONSE'
                            ? profile?.role === 'ESTUDIANTE'
                              ? 'Debes aceptar la solicitud antes de que se genere el PIN DUAL.'
                              : 'El PIN se generará cuando el estudiante acepte la solicitud.'
                            : 'Tu identidad ya fue validada y el PIN dejó de estar disponible.'}
                        </div>
                      )}

                      {request.status === 'PENDING_STUDENT_RESPONSE' && profile?.role === 'ESTUDIANTE' ? (
                        <Link
                          href="/dashboard"
                          className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                        >
                          Revisar y aceptar solicitud
                        </Link>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                {profile?.role === 'ESTUDIANTE' && currentStudent && !currentStudent.canLeaveAlone
                  ? 'No puedes salir sin autorización. Para obtener el PIN DUAL, tu responsable debe iniciar un retiro y tú debes aceptar la solicitud.'
                  : 'No hay un retiro activo con PIN DUAL.'}
              </div>
            )}
          </section>
        ) : null}

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
