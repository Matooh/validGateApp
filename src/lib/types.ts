export type FormState = {
  success: boolean;
  message: string;
  formValues?: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    rut: string;
    institution_id: string;
  }>;
};

export const INITIAL_FORM_STATE: FormState = {
  success: false,
  message: '',
};

export type AppRole =
  | 'ADMIN'
  | 'PENDIENTE'
  | 'APODERADO'
  | 'RETIRADOR_AUTORIZADO'
  | 'PORTERIA'
  | 'DOCENTE'
  | 'ESTUDIANTE';

export type AccessPolicy = {
  entry_requires_authenticator: boolean;
  entry_authenticator_is_exclusive: boolean;
  exit_requires_authenticator: boolean;
  exit_authenticator_is_exclusive: boolean;
  exit_requires_observation_without_authenticator: boolean;
};

export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  entry_requires_authenticator: false,
  entry_authenticator_is_exclusive: false,
  exit_requires_authenticator: true,
  exit_authenticator_is_exclusive: true,
  exit_requires_observation_without_authenticator: true,
};

export type AccessPolicyFailure =
  | 'AUTHENTICATOR_REQUIRED'
  | 'ENTRY_ALREADY_ACTIVE'
  | 'EXIT_WITHOUT_ACTIVE_ENTRY'
  | 'EXIT_NOT_ALLOWED_ALONE'
  | 'EXIT_OBSERVATION_REQUIRED'
  | 'VALIDATION_ERROR';

export type QrAccessEventType = 'INGRESO' | 'SALIDA' | 'RETIRO';

export type StudentQrValidationResult = {
  credentialId: string | null;
  studentId: number | null;
  firstName: string | null;
  lastName: string | null;
  courseName: string | null;
  canLeaveAlone: boolean | null;
  hasValidExitAuthorization: boolean | null;
  exitAuthorizationValidUntil: string | null;
  isInInstitution: boolean | null;
  institutionId: number | null;
  validationStatus: 'VALID' | 'INVALID';
  messageCode:
    | 'STUDENT_PROFILE_NOT_LINKED'
    | 'QR_CREATED'
    | 'QR_VALID'
    | 'QR_NOT_AVAILABLE'
    | 'QR_NOT_FOUND'
    | 'QR_EXPIRED'
    | 'QR_ALREADY_USED'
    | 'QR_REVOKED'
    | 'QR_INVALID_FORMAT'
    | 'QR_INVALID_EVENT'
    | 'QR_FORBIDDEN'
    | 'QR_NOT_ACTIVE'
    | 'QR_ENTRY_ALREADY_ACTIVE'
    | 'QR_STUDENT_NOT_INSIDE'
    | 'QR_EXIT_NOT_ALLOWED_ALONE'
    | 'EXIT_AUTHORIZATION_REQUIRED'
    | 'EXIT_AUTHORIZATION_VALID'
    | 'EXIT_AUTHORIZATION_NOT_FOUND'
    | 'QR_EVENT_REGISTERED'
    | 'ACCESS_EXIT_REGISTERED'
    | 'QR_EXIT_REGISTERED'
    | 'ACCESS_EXIT_FAILED'
    | 'QR_EVENT_FAILED';
};
