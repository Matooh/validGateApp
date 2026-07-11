import { linkStudentByCodeAction } from '@/app/actions/students';
import { PendingSubmitButton } from '@/components/pending-submit-button';

export function LinkStudentForm() {
  return (
    <form action={linkStudentByCodeAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="code" className="mb-2 block text-sm font-medium text-slate-700">
          Código de vinculación
        </label>
        <input
          id="code"
          name="code"
          required
          placeholder="VG-LUCAS"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase"
        />
      </div>
      <PendingSubmitButton
        pendingLabel="Vinculando..."
        className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
      >
        Vincular estudiante
      </PendingSubmitButton>
    </form>
  );
}
