'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { recordAccessEventAction } from '@/app/actions/access';
import type { AccessPolicy } from '@/lib/types';
import { SearchableCombobox } from '@/components/searchable-combobox';

type StudentOption = {
  id: number;
  first_name: string;
  last_name: string;
  is_in_institution: boolean;
  can_leave_alone: boolean;
  course_id: number | null;
};

type CourseOption = {
  id: number;
  name: string;
};

type SearchMode = 'student' | 'course';
type ContingencyMode = 'NORMAL' | 'CONTINGENCIA_SIN_DISPOSITIVO';
type ContingencyReason =
  | 'SIN_DISPOSITIVO'
  | 'NO_CELULAR'
  | 'SIN_BATERIA'
  | 'QR_NO_DISPONIBLE'
  | 'CAMARA_NO_DISPONIBLE'
  | 'JARDIN_INFANTIL'
  | 'OTRO';

const CONTINGENCY_REASON_OPTIONS: Array<{ value: ContingencyReason; label: string }> = [
  { value: 'SIN_DISPOSITIVO', label: 'Sin dispositivo propio' },
  { value: 'NO_CELULAR', label: 'Sin celular' },
  { value: 'SIN_BATERIA', label: 'Celular sin batería' },
  { value: 'QR_NO_DISPONIBLE', label: 'QR no disponible' },
  { value: 'CAMARA_NO_DISPONIBLE', label: 'Cámara no disponible' },
  { value: 'JARDIN_INFANTIL', label: 'Estudiante de jardín infantil' },
  { value: 'OTRO', label: 'Otro motivo' },
];

const EVENT_OPTIONS = {
  INGRESO: { value: 'INGRESO', label: 'Entrada' },
  SALIDA: { value: 'SALIDA', label: 'Salida' },
} as const;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? 'Registrando evento...' : 'Registrar evento'}
    </button>
  );
}

function RequiredMark() {
  return (
    <span className="ml-1 text-red-600" style={{ color: '#dc2626' }} aria-hidden="true">
      *
    </span>
  );
}

function fieldLabelClass(hasError: boolean) {
  return `mb-2 block text-sm font-medium ${hasError ? 'text-red-700' : 'text-slate-700'}`;
}

function fieldClass(hasError: boolean) {
  return `w-full rounded-xl border px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100 ${
    hasError ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
  }`;
}

export function RecordAccessForm({
  students,
  courses,
  accessPolicy,
}: {
  students: StudentOption[];
  courses: CourseOption[];
  accessPolicy: AccessPolicy;
}) {
  const [searchMode, setSearchMode] = useState<SearchMode>('student');

  const [studentQuery, setStudentQuery] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courseQuery, setCourseQuery] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseStudentIds, setSelectedCourseStudentIds] = useState<string[]>([]);

  const [eventType, setEventType] = useState('');
  const [validationKind, setValidationKind] = useState('');
  const [contingencyMode, setContingencyMode] = useState<ContingencyMode>('NORMAL');
  const [contingencyReason, setContingencyReason] = useState<ContingencyReason | ''>('');
  const [result, setResult] = useState('');
  const [exitKind, setExitKind] = useState('');
  const [notes, setNotes] = useState('');

  const [warnings, setWarnings] = useState<string[]>([]);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  const hasStudents = students.length > 0;

  const normalizedStudentQuery = studentQuery.trim().toLowerCase();
  const normalizedCourseQuery = courseQuery.trim().toLowerCase();

  const helperText = useMemo(() => {
    if (eventType === 'INGRESO') {
      return 'Para ingresos no se requiere tipo de salida. Se registrará automáticamente como no aplica.';
    }

    if (eventType === 'SALIDA') {
      return 'Selecciona el tipo de salida que corresponda al evento registrado.';
    }

    return 'Selecciona primero el tipo de evento.';
  }, [eventType]);

  const handleFormKeyDown = (
    event: React.KeyboardEvent<HTMLFormElement>,
  ) => {
    if (event.key !== 'Enter') return;

    const target = event.target as HTMLElement;
    const tag = target.tagName.toLowerCase();

    if (tag === 'textarea') {
      return;
    }

    event.preventDefault();
    validateForm();
  };  

  const visibleStudents = useMemo(() => {
    return students.filter((student) => {
      if (courseId && String(student.course_id ?? '') !== courseId) return false;
      if (!normalizedStudentQuery) return true;
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      return fullName.includes(normalizedStudentQuery);

    });
  }, [students, normalizedStudentQuery, courseId]);

  const studentSuggestions = useMemo(() => {
    if (!normalizedStudentQuery) return [];
    return students
      .filter((student) => {
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      return (!courseId || String(student.course_id ?? '') === courseId) && fullName.includes(normalizedStudentQuery);
      })
      .slice(0, 8);
  }, [students, normalizedStudentQuery, courseId]);

  const courseStudents = useMemo(() => {
    return students.filter((student) => {
      if (!courseId) return false;
      if (String(student.course_id ?? '') !== courseId) return false;

      if (!normalizedCourseQuery) return true;

      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      return fullName.includes(normalizedCourseQuery);
    });
  }, [students, courseId, normalizedCourseQuery]);

  const selectedCourseName = useMemo(
    () => courses.find((course) => String(course.id) === courseId)?.name ?? '',
    [courseId, courses],
  );

  const selectedCount =
    searchMode === 'student'
      ? selectedStudentId
        ? 1
        : 0
      : selectedCourseStudentIds.length;

  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );

  const selectedCourseStudents = useMemo(
    () =>
      students.filter((student) => selectedCourseStudentIds.includes(String(student.id))),
    [selectedCourseStudentIds, students],
  );

  const selectedStudentsForRules =
    searchMode === 'student'
      ? selectedStudent
        ? [selectedStudent]
        : []
      : selectedCourseStudents;

  const hasSelection = selectedStudentsForRules.length > 0;
  const selectedStudentsInsideCount = selectedStudentsForRules.filter(
    (student) => student.is_in_institution,
  ).length;
  const selectedStudentsOutsideCount =
    selectedStudentsForRules.length - selectedStudentsInsideCount;
  const hasOnlyInsideStudents = hasSelection && selectedStudentsOutsideCount === 0;
  const hasOnlyOutsideStudents = hasSelection && selectedStudentsInsideCount === 0;

  const availableEventOptions = useMemo(() => {
    if (!hasSelection) return [];
    if (hasOnlyInsideStudents) return [EVENT_OPTIONS.SALIDA];
    if (hasOnlyOutsideStudents) return [EVENT_OPTIONS.INGRESO];
    return [EVENT_OPTIONS.INGRESO, EVENT_OPTIONS.SALIDA];
  }, [hasOnlyInsideStudents, hasOnlyOutsideStudents, hasSelection]);

  const authenticatorPresented = validationKind === 'QR' || validationKind === 'PIN';
  const usingContingency = contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO';
  const currentEventPolicy = eventType === 'INGRESO'
    ? {
        requiresAuthenticator: accessPolicy.entry_requires_authenticator,
        authenticatorIsExclusive: accessPolicy.entry_authenticator_is_exclusive,
      }
    : {
        requiresAuthenticator: accessPolicy.exit_requires_authenticator,
        authenticatorIsExclusive: accessPolicy.exit_authenticator_is_exclusive,
      };

  useEffect(() => {
    if (searchMode !== 'student') return;

    if (!normalizedStudentQuery) {
      setSelectedStudentId('');
      return;
    }

    const exactMatch = students.find((student) => {
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      return fullName === normalizedStudentQuery;
    });

    if (exactMatch) {
      setSelectedStudentId(String(exactMatch.id));
      return;
    }

    if (studentSuggestions.length === 1) {
      setSelectedStudentId(String(studentSuggestions[0].id));
      return;
    }

    setSelectedStudentId('');
  }, [normalizedStudentQuery, studentSuggestions, students, searchMode]);

  useEffect(() => {
    if (searchMode === 'student') {
      setCourseId('');
      setCourseQuery('');
      setSelectedCourseStudentIds([]);
      return;
    }

    setSelectedStudentId('');
    setStudentQuery('');
    setShowStudentSuggestions(false);
  }, [searchMode]);

  useEffect(() => {
    setSelectedCourseStudentIds((current) =>
      current.filter((id) => courseStudents.some((student) => String(student.id) === id)),
    );
  }, [courseStudents]);

  useEffect(() => {
    if (eventType !== 'SALIDA') {
      setExitKind('');
    }
  }, [eventType]);

  useEffect(() => {
    if (!hasSelection) {
      setEventType('');
      setValidationKind('');
      setContingencyMode('NORMAL');
      setContingencyReason('');
      setResult('');
      setExitKind('');
      return;
    }

    if (availableEventOptions.length === 1) {
      const nextEventType = availableEventOptions[0].value;
      if (eventType !== nextEventType) {
        setEventType(nextEventType);
      }
      return;
    }

    if (
      eventType &&
      !availableEventOptions.some((option) => option.value === eventType)
    ) {
      setEventType('');
    }
  }, [availableEventOptions, eventType, hasSelection]);

  useEffect(() => {
    if (validationKind === 'MANUAL') {
      setContingencyMode('CONTINGENCIA_SIN_DISPOSITIVO');
      return;
    }

    if (validationKind !== 'MANUAL') {
      setContingencyMode('NORMAL');
      setContingencyReason('');
    }
  }, [validationKind]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!suggestionsRef.current) return;
      if (!suggestionsRef.current.contains(event.target as Node)) {
        setShowStudentSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleCourseStudent = (studentId: string) => {
    setSelectedCourseStudentIds((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId);
      }
      return [...current, studentId];
    });
  };

  const validateForm = () => {
    const nextWarnings: string[] = [];

    if (searchMode === 'student' && !selectedStudentId) {
      nextWarnings.push('Debes seleccionar un estudiante.');
    }

    if (searchMode === 'course') {
      if (!courseId) {
        nextWarnings.push('Debes seleccionar un curso.');
      }
      if (selectedCourseStudentIds.length === 0) {
        nextWarnings.push('Debes seleccionar al menos un estudiante del curso.');
      }
    }

    if (!eventType) {
      nextWarnings.push('Debes seleccionar un evento.');
    }

    if (!validationKind) {
      nextWarnings.push('Debes seleccionar un método de validación.');
    }

    if (contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO' && validationKind !== 'MANUAL') {
      nextWarnings.push('La contingencia sin dispositivo solo se usa con validación manual.');
    }

    if (contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO' && !contingencyReason) {
      nextWarnings.push('Debes seleccionar un motivo de contingencia.');
    }

    if (contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO' && !notes.trim()) {
      nextWarnings.push('Debes registrar una observación para la contingencia.');
    }

    if (!result) {
      nextWarnings.push('Debes seleccionar un resultado.');
    }

    if (eventType === 'SALIDA' && !exitKind) {
      nextWarnings.push('Debes seleccionar un tipo de salida.');
    }

    if (
      eventType &&
      exitKind !== 'EXCEPCIONAL' &&
      (eventType !== 'SALIDA' || selectedStudentsForRules.every((student) => student.can_leave_alone)) &&
      !(
        eventType === 'SALIDA' &&
        exitKind === 'SOLO' &&
        validationKind === 'MANUAL' &&
        usingContingency &&
        selectedStudentsForRules.length > 0 &&
        selectedStudentsForRules.every((student) => student.can_leave_alone)
      ) &&
      currentEventPolicy.requiresAuthenticator &&
      currentEventPolicy.authenticatorIsExclusive &&
      !authenticatorPresented
    ) {
      nextWarnings.push('La configuración exige QR o PIN para este evento.');
    }

    if (
      eventType === 'SALIDA' &&
      exitKind !== 'EXCEPCIONAL' &&
      selectedStudentsForRules.some((student) => !student.can_leave_alone)
    ) {
      nextWarnings.push(
        'El estudiante no puede salir solo. El retiro exige validar el PIN del estudiante y el PIN de su responsable.',
      );
    }

    if (
      eventType === 'SALIDA' &&
      exitKind !== 'EXCEPCIONAL' &&
      accessPolicy.exit_requires_authenticator &&
      accessPolicy.exit_requires_observation_without_authenticator &&
      !authenticatorPresented &&
      !notes.trim()
    ) {
      nextWarnings.push('Agrega una observación para justificar una salida sin QR o PIN.');
    }

    if (eventType === 'SALIDA' && exitKind === 'EXCEPCIONAL' && !notes.trim()) {
      nextWarnings.push('Debes registrar una observación para la salida excepcional.');
    }

    const studentsToCheck = selectedStudentsForRules;

    if (eventType === 'INGRESO' && studentsToCheck.some((student) => student.is_in_institution)) {
      nextWarnings.push('Hay estudiante(s) que ya figuran dentro de la institución.');
    }

    if (eventType === 'SALIDA') {
      if (studentsToCheck.some((student) => !student.is_in_institution)) {
        nextWarnings.push('Hay estudiante(s) sin ingreso activo para registrar salida.');
      }

      if (exitKind === 'SOLO' && studentsToCheck.some((student) => !student.can_leave_alone)) {
        nextWarnings.push('Hay estudiante(s) que no están autorizados para salir solos.');
      }
    }

    setWarnings(nextWarnings);
    return nextWarnings.length === 0;
  };

  const handleBlockedEnter = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    if (event.key !== 'Enter') return;

    const target = event.target as HTMLElement;
    const tag = target.tagName.toLowerCase();

    if (tag === 'textarea') {
      return;
    }

    event.preventDefault();
    validateForm();
  };

  const selectedStudentNames = selectedStudentsForRules.map(
    (student) => `${student.first_name} ${student.last_name}`,
  );

  const selectedStudentSummary =
    selectedStudentNames.length === 1
      ? selectedStudentNames[0]
      : selectedStudentNames.length > 1
        ? `${selectedStudentNames.length} estudiantes seleccionados`
        : '';

  const resultSummary = result === 'APROBADO'
    ? 'APRUEBA'
    : result === 'RECHAZADO'
      ? 'RECHAZA'
      : '';

  const eventSummary = eventType === 'INGRESO'
    ? 'ENTRADA'
    : eventType === 'SALIDA'
      ? 'SALIDA'
      : '';

  const validationSummary = validationKind === 'MANUAL'
    ? 'REGISTRO MANUAL'
    : validationKind;

  const summaryHasRequiredFields =
    hasSelection &&
    Boolean(resultSummary) &&
    Boolean(eventSummary) &&
    Boolean(validationSummary) &&
    (eventType !== 'SALIDA' || Boolean(exitKind)) &&
    (contingencyMode !== 'CONTINGENCIA_SIN_DISPOSITIVO' ||
      Boolean(contingencyReason)) &&
    (contingencyMode !== 'CONTINGENCIA_SIN_DISPOSITIVO' || Boolean(notes.trim())) &&
    (exitKind !== 'EXCEPCIONAL' || Boolean(notes.trim()));

  const requiresGuardianContingencyApproval =
    eventType === 'SALIDA' &&
    exitKind === 'SOLO' &&
    validationKind === 'MANUAL' &&
    usingContingency &&
    accessPolicy.exit_requires_authenticator &&
    accessPolicy.exit_authenticator_is_exclusive &&
    selectedStudentsForRules.length > 0 &&
    selectedStudentsForRules.every((student) => student.can_leave_alone);

  const summaryItems = summaryHasRequiredFields
    ? [
        requiresGuardianContingencyApproval
          ? `Se SOLICITA AUTORIZACIÓN DE SALIDA para ${selectedStudentSummary} mediante aprobación del Apoderado Primario.`
          : `Se ${resultSummary} ${eventSummary} para ${selectedStudentSummary} mediante ${validationSummary}.`,
        contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO' ? 'Contingencia: Dispositivo.' : '',
      ].filter(Boolean)
    : [
        searchMode === 'student'
          ? selectedStudentId
            ? 'Completa la información obligatoria para generar el resumen de selección.'
            : 'Debes seleccionar un estudiante.'
          : selectedCount > 0
            ? 'Completa la información obligatoria para generar el resumen de selección.'
            : 'Debes seleccionar al menos un estudiante del curso.',
      ];

  const summaryIsWarning =
    !summaryHasRequiredFields;

  const studentIsMissing = searchMode === 'student' ? !selectedStudentId : selectedCourseStudentIds.length === 0;
  const courseIsMissing = searchMode === 'course' && !courseId;
  const eventIsMissing = !eventType;
  const exitKindIsMissing = eventType !== 'INGRESO' && !exitKind;
  const validationKindIsMissing = !validationKind;
  const contingencyModeIsMissing = validationKind === 'MANUAL' && contingencyMode !== 'CONTINGENCIA_SIN_DISPOSITIVO';
  const contingencyReasonIsMissing = contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO' && !contingencyReason;
  const resultIsMissing = !result;
  const notesAreRequired = usingContingency || exitKind === 'EXCEPCIONAL';
  const notesAreMissing = notesAreRequired && !notes.trim();

  const requiredFieldsAreComplete =
    !studentIsMissing &&
    !courseIsMissing &&
    !eventIsMissing &&
    !exitKindIsMissing &&
    !validationKindIsMissing &&
    !contingencyModeIsMissing &&
    !contingencyReasonIsMissing &&
    !resultIsMissing;

  const entryPolicySummary = accessPolicy.entry_requires_authenticator
    ? accessPolicy.entry_authenticator_is_exclusive
      ? 'QR/PIN obligatorio.'
      : 'QR/PIN recomendado; registro manual permitido.'
    : 'Autónomo; registro manual permitido.';

  const exitPolicySummary = exitKind === 'EXCEPCIONAL'
    ? 'Excepcional: omite QR/PIN y aprobación; observación obligatoria.'
    : selectedStudentsForRules.some((student) => !student.can_leave_alone)
      ? 'PIN dual obligatorio y excluyente: deben validarse el PIN del estudiante y el de su responsable; el QR individual no autoriza la salida.'
      : accessPolicy.exit_requires_authenticator
        ? accessPolicy.exit_authenticator_is_exclusive
          ? 'QR obligatorio para salida autónoma; ante contingencia sin dispositivo, aprobación del Apoderado Primario obligatoria.'
          : 'QR requerido para salida autónoma; las excepciones deben quedar documentadas.'
        : 'Registro manual permitido.';

  const hasPendingFormInput = Boolean(
    studentQuery ||
    courseId ||
    courseQuery ||
    selectedStudentId ||
    selectedCourseStudentIds.length > 0 ||
    eventType ||
    validationKind ||
    contingencyReason ||
    result ||
    exitKind ||
    notes,
  );

  return (
    <form
      action={recordAccessEventAction}
      data-auto-refresh-blocker={hasPendingFormInput ? 'true' : undefined}
      onKeyDown={handleFormKeyDown}
      onSubmit={(event) => {
        if (!validateForm()) {
          event.preventDefault();
        }
      }}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h2 className="text-xl font-semibold text-slate-900">Registro manual de ingreso y salida</h2>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona estudiantes y registra el evento con su validación y trazabilidad correspondiente.
        </p>
      </div>

      <div className="md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Búsqueda de estudiantes</p>
            <p className="text-xs text-slate-500">
              Selecciona el modo de búsqueda para registrar el evento.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setSearchMode('student');
                setWarnings([]);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                searchMode === 'student' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Buscar por estudiante
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchMode('course');
                setWarnings([]);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                searchMode === 'course' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Buscar por curso
            </button>
          </div>
        </div>
      </div>

      {searchMode === 'student' ? (
        <>
          <div className="md:col-span-2">
            <label htmlFor="guard-course-filter" className="mb-2 block text-sm font-medium text-slate-700">Curso</label>
            <SearchableCombobox id="guard-course-filter" name="guard_course_filter" value={courseId} disabled={Boolean(selectedStudentId)} onChange={(value) => { setCourseId(value); setSelectedStudentId(''); setStudentQuery(''); setWarnings([]); }} placeholder="Selecciona un curso" options={courses.map((course) => ({ value: String(course.id), label: course.name }))} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="guard-student-picker" className="mb-2 block text-sm font-medium text-slate-700">Nombre Estudiante</label>
            <SearchableCombobox id="guard-student-picker" name="student_picker" value={selectedStudentId} onChange={(value) => { const selected = students.find((student) => String(student.id) === value); setSelectedStudentId(value); setStudentQuery(selected ? `${selected.first_name} ${selected.last_name}` : ''); if (selected) setCourseId(String(selected.course_id ?? '')); setWarnings([]); }} placeholder="Selecciona un estudiante" options={visibleStudents.map((student) => ({ value: String(student.id), label: `${student.first_name} ${student.last_name} · ${student.is_in_institution ? 'En institución' : 'Fuera'}` }))} required />
          </div>
          <div className="md:col-span-2 hidden" ref={suggestionsRef}>
            <label htmlFor="student_search" className="mb-2 block text-sm font-medium text-slate-700">
              Buscador de estudiante
            </label>
            <input
              id="student_search"
              role="combobox"
              aria-expanded={showStudentSuggestions}
              aria-controls="student-search-options"
              type="text"
              value={studentQuery}
              onChange={(event) => {
                setStudentQuery(event.target.value);
                setShowStudentSuggestions(true);
              }}
              onFocus={() => setShowStudentSuggestions(true)}
              onKeyDown={handleBlockedEnter}
              placeholder="Buscar por nombre o apellido"
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              autoComplete="off"
            />

            {showStudentSuggestions && normalizedStudentQuery ? (
              <div id="student-search-options" role="listbox" className="mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                {studentSuggestions.length > 0 ? (
                  <ul className="space-y-1">
                    {studentSuggestions.map((student) => (
                      <li key={student.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
                          onClick={() => {
                            setStudentQuery(`${student.first_name} ${student.last_name}`);
                            setSelectedStudentId(String(student.id));
                            setCourseId(String(student.course_id ?? ''));
                            setShowStudentSuggestions(false);
                            setWarnings([]);
                          }}
                        >
                          {student.first_name} {student.last_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    No hay coincidencias para la búsqueda.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="student_id" className={`${fieldLabelClass(studentIsMissing)} sr-only`}>
              Estudiante
              <RequiredMark />
            </label>
            <select
              id="student_id"
              name="student_id"
              value={selectedStudentId}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                setWarnings([]);
              }}
              onKeyDown={handleBlockedEnter}
              disabled={!hasStudents}
              className={`${fieldClass(studentIsMissing)} hidden`}
            >
              <option value="">Selecciona un estudiante</option>
              {visibleStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ·{' '}
                  {student.is_in_institution ? 'En institución' : 'Fuera'}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-slate-500">
              {visibleStudents.length} estudiante(s) coinciden con la búsqueda.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="course_id" className={fieldLabelClass(courseIsMissing)}>
              Cursos
              <RequiredMark />
            </label>
            <select
              id="course_id"
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setSelectedCourseStudentIds([]);
                setWarnings([]);
              }}
              onKeyDown={handleBlockedEnter}
              className={fieldClass(courseIsMissing)}
            >
              <option value="">Selecciona un curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="course_search" className="mb-2 block text-sm font-medium text-slate-700">
              Buscador
            </label>
            <input
              id="course_search"
              type="text"
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              onKeyDown={handleBlockedEnter}
              placeholder="Filtrar estudiantes del curso"
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              autoComplete="off"
            />
          </div>

          <div
            className={`md:col-span-2 rounded-2xl border bg-slate-50 p-4 ${
              studentIsMissing ? 'border-red-500' : 'border-slate-200'
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">Listado de estudiantes del curso</p>
                <p className="text-sm text-slate-500">
                  {selectedCourseName
                    ? `${selectedCourseName} · ${courseStudents.length} estudiante(s)`
                    : 'Selecciona un curso para ver sus estudiantes.'}
                </p>
              </div>

              {selectedCourseStudentIds.length > 0 ? (
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {selectedCourseStudentIds.length} seleccionado(s)
                </span>
              ) : null}
            </div>

            {courseId ? (
              courseStudents.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {courseStudents.map((student) => {
                    const id = String(student.id);
                    const checked = selectedCourseStudentIds.includes(id);

                    return (
                      <label
                        key={student.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              toggleCourseStudent(id);
                              setWarnings([]);
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <p className="font-medium text-slate-900">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Estado: {student.is_in_institution ? 'En institución' : 'Fuera'}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No hay estudiantes para mostrar con los filtros actuales.
                </p>
              )
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Debes seleccionar un curso para habilitar el listado de estudiantes.
              </div>
            )}
          </div>
        </>
      )}

      {searchMode === 'course'
        ? selectedCourseStudentIds.map((studentId) => (
            <input key={studentId} type="hidden" name="student_ids" value={studentId} />
          ))
        : null}

      <input type="hidden" name="selection_mode" value={searchMode} />

      <div>
        <label htmlFor="event_type" className={fieldLabelClass(eventIsMissing)}>
          Evento
          <RequiredMark />
        </label>
        <select
          id="event_type"
          name="event_type"
          value={eventType}
          onChange={(event) => {
            setEventType(event.target.value);
            setWarnings([]);
          }}
          onKeyDown={handleBlockedEnter}
          disabled={!hasSelection}
          className={fieldClass(eventIsMissing)}
        >
          {!hasSelection || availableEventOptions.length !== 1 ? (
            <option value="">
              {hasSelection ? 'Selecciona un evento' : 'Selecciona un estudiante primero'}
            </option>
          ) : null}
          {availableEventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {eventType !== 'INGRESO' ? (
        <div>
          <label htmlFor="exit_kind" className={fieldLabelClass(exitKindIsMissing)}>
            Tipo salida
            <RequiredMark />
          </label>

          {!hasSelection ? (
            <select
              id="exit_kind"
              name="exit_kind"
              defaultValue=""
              disabled
              className={fieldClass(exitKindIsMissing)}
            >
              <option value="">Selecciona un estudiante primero</option>
            </select>
          ) : eventType === 'SALIDA' ? (
            <select
              id="exit_kind"
              name="exit_kind"
              value={exitKind}
              onChange={(event) => {
                setExitKind(event.target.value);
                setWarnings([]);
              }}
              onKeyDown={handleBlockedEnter}
              disabled={!hasSelection}
              className={fieldClass(exitKindIsMissing)}
            >
              <option value="">Selecciona un tipo de salida</option>
              <option value="REGULAR">Regular</option>
              <option value="RETIRO_AUTORIZADO">Retiro autorizado</option>
              <option value="SOLO">Salida por voluntad del estudiante</option>
              <option value="EXCEPCIONAL">Excepcional</option>
            </select>
          ) : (
            <>
              <input type="hidden" name="exit_kind" value="" />
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Selecciona un estudiante para habilitar este campo.
              </div>
            </>
          )}

          <p className="mt-2 text-xs text-slate-500">{helperText}</p>
        </div>
      ) : (
        <input type="hidden" name="exit_kind" value="" />
      )}

      <div>
        <label htmlFor="validation_kind" className={fieldLabelClass(validationKindIsMissing)}>
          Método de validación
          <RequiredMark />
        </label>
        <select
          id="validation_kind"
          name="validation_kind"
          value={validationKind}
          onChange={(event) => {
            setValidationKind(event.target.value);
            setWarnings([]);
          }}
          onKeyDown={handleBlockedEnter}
          disabled={!hasSelection}
          className={fieldClass(validationKindIsMissing)}
        >
          <option value="">Selecciona un método</option>
          <option value="MANUAL">Manual</option>
          <option value="QR">QR</option>
          <option value="PIN">PIN</option>
        </select>
      </div>

      {validationKind === 'MANUAL' ? (
        <div>
          <label htmlFor="contingency_mode" className={fieldLabelClass(contingencyModeIsMissing)}>
            Tipo de contingencia
            <RequiredMark />
          </label>
          <select
            id="contingency_mode"
            name="contingency_mode"
            value={contingencyMode}
            onChange={(event) => {
              const nextMode = event.target.value as ContingencyMode;
              setContingencyMode(nextMode);
              if (nextMode !== 'CONTINGENCIA_SIN_DISPOSITIVO') {
                setContingencyReason('');
              }
              setWarnings([]);
            }}
            onKeyDown={handleBlockedEnter}
            disabled={!hasSelection}
            className={fieldClass(contingencyModeIsMissing)}
          >
            <option value="CONTINGENCIA_SIN_DISPOSITIVO">Dispositivo</option>
          </select>

          <p className="mt-2 text-xs text-slate-500">
            Solo se habilita cuando la validación es manual. Reutiliza la búsqueda por curso o por estudiante.
          </p>
        </div>
      ) : (
        <input type="hidden" name="contingency_mode" value="NORMAL" />
      )}

      {usingContingency ? (
        <div>
          <label htmlFor="contingency_reason" className={fieldLabelClass(contingencyReasonIsMissing)}>
            Motivo de contingencia
            <RequiredMark />
          </label>
          <select
            id="contingency_reason"
            name="contingency_reason"
            value={contingencyReason}
            onChange={(event) => {
              setContingencyReason(event.target.value as ContingencyReason);
              setWarnings([]);
            }}
            onKeyDown={handleBlockedEnter}
            className={fieldClass(contingencyReasonIsMissing)}
          >
            <option value="">Selecciona un motivo</option>
            {CONTINGENCY_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-slate-500">
            Esta selección se aplica a todos los estudiantes del registro en curso y deja trazabilidad operativa.
          </p>
        </div>
      ) : (
        <input type="hidden" name="contingency_reason" value="" />
      )}

      <div>
        <label htmlFor="result" className={fieldLabelClass(resultIsMissing)}>
          Resultado
          <RequiredMark />
        </label>
        <select
          id="result"
          name="result"
          value={result}
          onChange={(event) => {
            setResult(event.target.value);
            setWarnings([]);
          }}
          onKeyDown={handleBlockedEnter}
          disabled={!hasSelection}
          className={fieldClass(resultIsMissing)}
        >
          <option value="">Selecciona un resultado</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="notes" className={fieldLabelClass(notesAreMissing)}>
          Descripción del evento
          {notesAreRequired ? <RequiredMark /> : null}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setWarnings([]);
          }}
          onKeyDown={handleBlockedEnter}
          aria-invalid={notesAreMissing}
          aria-describedby={notesAreMissing ? 'notes-error' : 'notes-help'}
          placeholder="Ejemplo: retiro anticipado por cita médica, ingreso con justificación, observaciones relevantes..."
          className={fieldClass(notesAreMissing)}
        />
        <p
          id={notesAreMissing ? 'notes-error' : 'notes-help'}
          className={`mt-2 text-xs ${notesAreMissing ? 'font-medium text-red-700' : 'text-slate-500'}`}
        >
          {notesAreMissing
            ? exitKind === 'EXCEPCIONAL'
              ? 'Describe el motivo que justifica la salida excepcional.'
              : 'Describe la contingencia antes de registrar el evento.'
            : 'La descripción permite justificar y auditar decisiones excepcionales o de contingencia.'}
        </p>
      </div>

      <div
        className={`md:col-span-2 rounded-2xl px-4 py-3 ${
          summaryIsWarning
            ? 'border border-amber-200 bg-amber-50'
            : 'border border-slate-200 bg-slate-50'
        }`}
      >
        <p
          className={`text-sm font-medium ${
            summaryIsWarning ? 'text-amber-900' : 'text-slate-800'
          }`}
        >
          Resumen de selección
        </p>
        <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${summaryIsWarning ? 'text-amber-800' : 'text-slate-600'}`}>
          {summaryItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>

      <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
        <p className="text-sm font-semibold text-sky-950">Política aplicada</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sky-900">
          <li><span className="font-medium">Ingreso:</span> {entryPolicySummary}</li>
          <li><span className="font-medium">Salida:</span> {exitPolicySummary}</li>
        </ul>
      </div>

      {warnings.length > 0 ? (
        <div role="alert" className="md:col-span-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="text-sm font-semibold">Revisa la información antes de continuar</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="md:col-span-2">
        <SubmitButton disabled={!hasStudents || !requiredFieldsAreComplete} />
      </div>
    </form>
  );
}
