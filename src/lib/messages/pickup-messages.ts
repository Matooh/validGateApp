export const PICKUP_MESSAGE_TEXT: Record<string, string> = {
  PICKUP_REQUEST_CREATED: 'Solicitud de retiro enviada al estudiante.',
  PICKUP_ALREADY_ACTIVE: 'Ya existe una solicitud de retiro activa para este estudiante.',
  PICKUP_STUDENT_NOT_INSIDE: 'El estudiante debe encontrarse dentro de la institución.',
  PICKUP_NOT_AUTHORIZED: 'El vínculo no está autorizado para realizar este retiro.',
  PICKUP_FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  PICKUP_NOT_ALLOWED: 'La solicitud ya no admite esta acción.',
  PICKUP_ACCEPTED_PINS_CREATED: 'Solicitud aceptada. Los PIN estarán vigentes durante cinco minutos.',
  PICKUP_REJECTED_BY_STUDENT: 'Solicitud de retiro rechazada.',
  PICKUP_INVALID_PIN: 'El PIN ingresado no es válido.',
  PICKUP_PIN_VALIDATED: 'PIN validado correctamente.',
  PICKUP_ACTOR_ALREADY_VALIDATED: 'Esta persona ya fue validada.',
  PICKUP_PIN_BLOCKED: 'El PIN se encuentra bloqueado.',
  PICKUP_BLOCKED_BY_ATTEMPTS: 'Solicitud bloqueada por alcanzar el máximo de intentos.',
  PICKUP_PIN_EXPIRED: 'Los PIN expiraron. Debe generarse una nueva solicitud.',
  PICKUP_CONTINGENCY_DETAILS_REQUIRED: 'Debes indicar un motivo y una observación para la contingencia.',
  PICKUP_PIN_REQUIRED: 'Este retiro requiere validar ambas identidades exclusivamente mediante PIN.',
  PICKUP_MANUAL_VALIDATED: 'Identidad validada mediante contingencia manual.',
  PICKUP_NOT_READY: 'Se deben validar ambas personas antes de confirmar el retiro.',
  PICKUP_COMPLETED: 'Retiro confirmado y salida registrada.',
  PICKUP_CANCELLED: 'Solicitud de retiro cancelada.',
  PICKUP_REJECTION_DETAILS_REQUIRED: 'Debes indicar un motivo y una observación para rechazar el retiro.',
  PICKUP_REJECTED_AT_GATE: 'Solicitud rechazada en portería.',
  PICKUP_FAILED: 'No se pudo procesar la solicitud de retiro.',
};

export function getPickupMessage(code?: string | null) {
  return PICKUP_MESSAGE_TEXT[code ?? ''] ?? PICKUP_MESSAGE_TEXT.PICKUP_FAILED;
}
