export type FormState = {
  success: boolean;
  message: string;
};

export const INITIAL_FORM_STATE: FormState = {
  success: false,
  message: '',
};

export type AppRole = 'ADMIN' | 'APODERADO' | 'PORTERIA' | 'DOCENTE' | 'ESTUDIANTE';
