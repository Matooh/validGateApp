export const AUTHORIZATION_MESSAGE_TEXT = {
  AUTH_REQUEST_CREATED: 'Solicitud enviada al Apoderado Primario.',
  AUTH_REQUEST_NOT_ALLOWED: 'No puedes solicitar esta autorización.',
  AUTH_REQUEST_NO_GUARDIAN: 'No hay Apoderados Primarios vinculados para recibir la solicitud.',
  AUTH_REQUEST_STUDENT_NOT_INSIDE: 'Solo puedes solicitar salida si figuras dentro de la institución.',
  AUTH_REQUEST_PENDING: 'La solicitud está pendiente de respuesta.',
  AUTH_REQUEST_APPROVED: 'Solicitud aprobada por el Apoderado Primario.',
  AUTH_REQUEST_APPROVED_PICKUP_PENDING:
    'Solicitud aprobada. Presenten ambos PIN en portería para validar el retiro.',
  AUTH_REQUEST_REJECTED: 'Solicitud rechazada por el Apoderado Primario.',
  AUTH_REQUEST_EXPIRED: 'La solicitud expiro. Debe generarse una nueva.',
  AUTH_REQUEST_FORBIDDEN: 'No tienes permisos para gestionar esta solicitud.',
  AUTH_REQUEST_FAILED: 'No se pudo procesar la solicitud.',
  EXIT_AUTHORIZATION_CREATED: 'Autorización temporal creada correctamente.',
  EXIT_AUTHORIZATION_REQUIRED: 'Se requiere autorización vigente del Apoderado Primario.',
  EXIT_AUTHORIZATION_VALID: 'Existe una autorización vigente para salida.',
  EXIT_AUTHORIZATION_NOT_FOUND: 'No hay una autorización vigente para salida.',
  EXIT_REGISTERED: 'Salida registrada correctamente.',
  STUDENT_PROFILE_NOT_LINKED:
    'No se encontró un perfil de estudiante asociado a tu cuenta. Contacta a administración.',
  STUDENT_EXIT_QR_REQUIRED: 'Debes generar una credencial QR vigente antes de registrar tu salida.',
  STUDENT_EXIT_NOT_INSIDE: 'Solo puedes registrar salida si figuras dentro de la institución.',
  STUDENT_EXIT_NOT_ALLOWED_ALONE:
    'No estás autorizado para registrar salida directa. Solicita autorización del Apoderado Primario.',
  STUDENT_EXIT_ALREADY_USED: 'La credencial QR vigente ya fue utilizada. Genera una nueva credencial.',
  STUDENT_EXIT_UNAVAILABLE:
    'No pudimos registrar tu salida en este momento. Avisa a portería para que te ayuden.',
} as const;

export type AuthorizationMessageCode = keyof typeof AUTHORIZATION_MESSAGE_TEXT;

export function getAuthorizationMessage(code: AuthorizationMessageCode): string {
  return AUTHORIZATION_MESSAGE_TEXT[code] ?? AUTHORIZATION_MESSAGE_TEXT.AUTH_REQUEST_FAILED;
}
