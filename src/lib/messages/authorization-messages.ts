export const AUTHORIZATION_MESSAGE_TEXT = {
  AUTH_REQUEST_CREATED: 'Solicitud enviada al apoderado.',
  AUTH_REQUEST_NOT_ALLOWED: 'No puedes solicitar esta autorizacion.',
  AUTH_REQUEST_NO_GUARDIAN: 'No hay apoderados vinculados para recibir la solicitud.',
  AUTH_REQUEST_STUDENT_NOT_INSIDE: 'Solo puedes solicitar salida si figuras dentro de la institucion.',
  AUTH_REQUEST_PENDING: 'La solicitud esta pendiente de respuesta.',
  AUTH_REQUEST_APPROVED: 'Solicitud aprobada por el apoderado.',
  AUTH_REQUEST_REJECTED: 'Solicitud rechazada por el apoderado.',
  AUTH_REQUEST_EXPIRED: 'La solicitud expiro. Debe generarse una nueva.',
  AUTH_REQUEST_FORBIDDEN: 'No tienes permisos para gestionar esta solicitud.',
  AUTH_REQUEST_FAILED: 'No se pudo procesar la solicitud.',
  EXIT_AUTHORIZATION_CREATED: 'Autorizacion temporal creada correctamente.',
  EXIT_AUTHORIZATION_REQUIRED: 'Se requiere autorizacion vigente del apoderado.',
  EXIT_AUTHORIZATION_VALID: 'Existe una autorizacion vigente para salida.',
  EXIT_AUTHORIZATION_NOT_FOUND: 'No hay una autorizacion vigente para salida.',
  EXIT_REGISTERED: 'Salida registrada correctamente.',
  STUDENT_PROFILE_NOT_LINKED:
    'No se encontro un perfil de estudiante asociado a tu cuenta. Contacta a administracion.',
  STUDENT_EXIT_QR_REQUIRED: 'Debes generar una credencial QR vigente antes de registrar tu salida.',
  STUDENT_EXIT_NOT_INSIDE: 'Solo puedes registrar salida si figuras dentro de la institucion.',
  STUDENT_EXIT_NOT_ALLOWED_ALONE:
    'No estas autorizado para registrar salida directa. Solicita autorizacion de apoderado o responsable.',
  STUDENT_EXIT_ALREADY_USED: 'La credencial QR vigente ya fue utilizada. Genera una nueva credencial.',
  STUDENT_EXIT_UNAVAILABLE:
    'No pudimos registrar tu salida en este momento. Avisa a porteria para que te ayuden.',
} as const;

export type AuthorizationMessageCode = keyof typeof AUTHORIZATION_MESSAGE_TEXT;

export function getAuthorizationMessage(code: AuthorizationMessageCode): string {
  return AUTHORIZATION_MESSAGE_TEXT[code] ?? AUTHORIZATION_MESSAGE_TEXT.AUTH_REQUEST_FAILED;
}
