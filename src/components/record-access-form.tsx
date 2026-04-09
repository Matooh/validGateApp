'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { recordAccessEventAction } from '@/app/actions/access';

type StudentOption = {
  id: number;
  first_name: string;
  last_name: string;
  is_in_institution: boolean;
  course_id: number | null;
};

type CourseOption = {
  id: number;
  name: string;
};

type SearchMode = 'student' | 'course';

export function RecordAccessForm({
  students,
  courses,
}: {
  students: StudentOption[];
  courses: CourseOption[];
}) {
  const [searchMode, setSearchMode] = useState<SearchMode>('student');

  const [studentQuery, setStudentQuery] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courseQuery, setCourseQuery] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseStudentIds, setSelectedCourseStudentIds] = useState<string[]>([]);

  const [eventType, setEventType] = useState('');
  const [validationKind, setValidationKind] = useState('');
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
      return 'Para ingresos no se requiere tipo de salida. Se registrara automaticamente como no aplica.';
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
      if (!normalizedStudentQuery) return true;
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      return fullName.includes(normalizedStudentQuery);
    });
  }, [students, normalizedStudentQuery]);

  const studentSuggestions = useMemo(() => {
    if (!normalizedStudentQuery) return [];
    return students
      .filter((student) => {
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        return fullName.includes(normalizedStudentQuery);
      })
      .slice(0, 8);
  }, [students, normalizedStudentQuery]);

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
      nextWarnings.push('Debes seleccionar un metodo de validacion.');
    }

    if (!result) {
      nextWarnings.push('Debes seleccionar un resultado.');
    }

    if (eventType === 'SALIDA' && !exitKind) {
      nextWarnings.push('Debes seleccionar un tipo de salida.');
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

  const summaryMessage =
    searchMode === 'student'
      ? selectedStudentId
        ? 'Se registrara el evento para 1 estudiante.'
        : 'Debes seleccionar un estudiante.'
      : selectedCount > 0
        ? `Se registrara el evento para ${selectedCount} estudiante(s) del curso.`
        : 'Debes seleccionar al menos un estudiante del curso.';

  const summaryIsWarning =
    (searchMode === 'student' && !selectedStudentId) ||
    (searchMode === 'course' && selectedCount === 0);

  return (
    <form
  action={recordAccessEventAction}
  onKeyDown={handleFormKeyDown}
  onSubmit={(event) => {
    if (!validateForm()) {
      event.preventDefault();
    }
  }}
  className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
>
      <div className="md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Busqueda de estudiantes</p>
            <p className="text-xs text-slate-500">
              Selecciona el modo de busqueda para registrar el evento.
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

      {warnings.length > 0 ? (
        <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Atencion</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {searchMode === 'student' ? (
        <>
          <div className="md:col-span-2" ref={suggestionsRef}>
            <label htmlFor="student_search" className="mb-2 block text-sm font-medium text-slate-700">
              Buscador de estudiante
            </label>
            <input
              id="student_search"
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
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
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
                    No hay coincidencias para la busqueda.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="student_id" className="mb-2 block text-sm font-medium text-slate-700">
              Estudiante
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Selecciona un estudiante</option>
              {visibleStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ·{' '}
                  {student.is_in_institution ? 'En institucion' : 'Fuera'}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-slate-500">
              {visibleStudents.length} estudiante(s) coinciden con la busqueda.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="course_id" className="mb-2 block text-sm font-medium text-slate-700">
              Cursos
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
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

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                              Estado: {student.is_in_institution ? 'En institucion' : 'Fuera'}
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
        <label htmlFor="event_type" className="mb-2 block text-sm font-medium text-slate-700">
          Evento
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
          className="w-full rounded-xl border border-slate-300 px-4 py-3"
        >
          <option value="">Selecciona un evento</option>
          <option value="INGRESO">Ingreso</option>
          <option value="SALIDA">Salida</option>
        </select>
      </div>

      <div>
        <label htmlFor="exit_kind" className="mb-2 block text-sm font-medium text-slate-700">
          Tipo salida
        </label>

        {eventType === 'SALIDA' ? (
          <select
            id="exit_kind"
            name="exit_kind"
            value={exitKind}
            onChange={(event) => {
              setExitKind(event.target.value);
              setWarnings([]);
            }}
            onKeyDown={handleBlockedEnter}
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="">Selecciona un tipo de salida</option>
            <option value="REGULAR">Regular</option>
            <option value="RETIRO_AUTORIZADO">Retiro autorizado</option>
            <option value="SOLO">Salida por voluntad del estudiante</option>
          </select>
        ) : (
          <>
            <input type="hidden" name="exit_kind" value="" />
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No aplica para eventos de ingreso.
            </div>
          </>
        )}

        <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      </div>

      <div>
        <label htmlFor="validation_kind" className="mb-2 block text-sm font-medium text-slate-700">
          Metodo validacion
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
          className="w-full rounded-xl border border-slate-300 px-4 py-3"
        >
          <option value="">Selecciona un metodo</option>
          <option value="MANUAL">Manual</option>
          <option value="QR">QR</option>
          <option value="PIN">PIN</option>
          <option value="FACIAL">Facial</option>
        </select>
      </div>

      <div>
        <label htmlFor="result" className="mb-2 block text-sm font-medium text-slate-700">
          Resultado
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
          className="w-full rounded-xl border border-slate-300 px-4 py-3"
        >
          <option value="">Selecciona un resultado</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
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
          Resumen de seleccion
        </p>
        <p className={`mt-1 text-sm ${summaryIsWarning ? 'text-amber-800' : 'text-slate-600'}`}>
          {summaryMessage}
        </p>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="notes" className="mb-2 block text-sm font-medium text-slate-700">
          Descripcion del evento
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onKeyDown={handleBlockedEnter}
          placeholder="Ejemplo: retiro anticipado por cita medica, ingreso con justificacion, observaciones relevantes..."
          className="w-full rounded-xl border border-slate-300 px-4 py-3"
        />
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={!hasStudents}
          className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Registrar evento
        </button>
      </div>
    </form>
  );
}