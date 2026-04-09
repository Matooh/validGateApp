import { linkStudentByCodeAction } from '@/app/actions/students';

export function LinkStudentForm() {
  return (
    <form action={linkStudentByCodeAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="code" className="mb-2 block text-sm font-medium text-slate-700">
          Codigo de vinculacion
        </label>
        <input
          id="code"
          name="code"
          required
          placeholder="VG-LUCAS"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase"
        />
      </div>
      <button type="submit" className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800">
        Vincular estudiante
      </button>
    </form>
  );
}
