import { describe, expect, it } from 'vitest';

import { getAuthorizationMessage } from '../../src/lib/messages/authorization-messages';
import { getPickupMessage, PICKUP_MESSAGE_TEXT } from '../../src/lib/messages/pickup-messages';
import { getQrMessage, QR_MESSAGE_TEXT } from '../../src/lib/messages/qr-messages';

describe('mensajes de dominio', () => {
  it('resuelve todos los códigos QR conocidos', () => {
    expect(getQrMessage('QR_VALID')).toBe(QR_MESSAGE_TEXT.QR_VALID);
    expect(getQrMessage('QR_EXPIRED')).toBe(QR_MESSAGE_TEXT.QR_EXPIRED);
  });

  it('usa el mensaje fallback para un código de retiro desconocido', () => {
    expect(getPickupMessage()).toBe(PICKUP_MESSAGE_TEXT.PICKUP_FAILED);
    expect(getPickupMessage(null)).toBe(PICKUP_MESSAGE_TEXT.PICKUP_FAILED);
    expect(getPickupMessage('UNKNOWN_CODE')).toBe(PICKUP_MESSAGE_TEXT.PICKUP_FAILED);
  });

  it('resuelve mensajes de autorización conocidos', () => {
    expect(getAuthorizationMessage('AUTH_REQUEST_APPROVED')).toContain('Solicitud aprobada');
    expect(getAuthorizationMessage('EXIT_AUTHORIZATION_REQUIRED')).toContain('autorización');
  });
});
