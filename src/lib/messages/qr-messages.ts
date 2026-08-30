export const QR_MESSAGE_TEXT = {
  STUDENT_PROFILE_NOT_LINKED:
    'No se encontró un perfil de estudiante asociado a tu cuenta. Contacta a administración.',
  QR_CREATED: 'Credencial QR generada correctamente.',
  QR_VALID: 'Credencial QR válida.',
  QR_NOT_AVAILABLE: 'QR no disponible.',
  QR_NOT_FOUND: 'No encontramos una credencial QR activa.',
  QR_EXPIRED: 'La credencial QR expiro. Solicita una nueva credencial.',
  QR_ALREADY_USED: 'Esta credencial QR ya fue utilizada.',
  QR_REVOKED: 'Esta credencial QR fue revocada.',
  QR_INVALID_FORMAT: 'El código escaneado no corresponde a una credencial ValidGate.',
  QR_INVALID_EVENT: 'El tipo de evento solicitado no es válido.',
  QR_FORBIDDEN: 'No tienes permisos para usar esta credencial QR.',
  QR_NOT_ACTIVE: 'La credencial QR no está activa.',
  QR_ENTRY_ALREADY_ACTIVE: 'El estudiante ya registra un ingreso activo.',
  QR_STUDENT_NOT_INSIDE: 'El estudiante ya se encuentra fuera del recinto.',
  QR_EXIT_NOT_ALLOWED_ALONE:
    'El estudiante no está autorizado para salir solo. Solicita autorización del Apoderado Primario.',
  EXIT_AUTHORIZATION_REQUIRED: 'Se requiere autorización vigente del Apoderado Primario para confirmar la salida.',
  EXIT_AUTHORIZATION_VALID: 'Existe una autorización vigente del Apoderado Primario.',
  EXIT_AUTHORIZATION_NOT_FOUND: 'No encontramos una autorización vigente para salida.',
  QR_EVENT_REGISTERED: 'Evento registrado correctamente mediante QR.',
  ACCESS_EXIT_REGISTERED: 'Salida registrada correctamente.',
  QR_EXIT_REGISTERED: 'Salida registrada correctamente.',
  ACCESS_EXIT_FAILED: 'No se pudo registrar la salida.',
  QR_EVENT_FAILED: 'No se pudo registrar el evento mediante QR.',
} as const;

export type QrMessageCode = keyof typeof QR_MESSAGE_TEXT;

export function getQrMessage(code: QrMessageCode): string {
  return QR_MESSAGE_TEXT[code] ?? QR_MESSAGE_TEXT.QR_EVENT_FAILED;
}
