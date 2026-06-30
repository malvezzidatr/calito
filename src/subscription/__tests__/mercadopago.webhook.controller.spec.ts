jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {},
}));

import { createHmac } from 'crypto';
import { MercadoPagoWebhookController } from '../mercadopago.webhook.controller';

describe('MercadoPagoWebhookController', () => {
  let controller: MercadoPagoWebhookController;
  let activateFromPayment: jest.Mock;
  let configGet: jest.Mock;

  const buildController = () => new MercadoPagoWebhookController({ activateFromPayment } as never, { get: configGet } as never);

  beforeEach(() => {
    activateFromPayment = jest.fn().mockResolvedValue(undefined);
    configGet = jest.fn().mockReturnValue(undefined); // sem segredo -> validação desativada
    controller = buildController();
  });

  it('activates from the payment id on a payment notification', async () => {
    const result = await controller.handle({ type: 'payment', data: { id: 12345 } });

    expect(activateFromPayment).toHaveBeenCalledWith('12345');
    expect(result).toEqual({ received: true });
  });

  it('ignores notifications without a payment id', async () => {
    await controller.handle({ type: 'plan', data: {} });

    expect(activateFromPayment).not.toHaveBeenCalled();
  });

  it('still returns 200 when activation throws', async () => {
    activateFromPayment.mockRejectedValue(new Error('boom'));

    const result = await controller.handle({ type: 'payment', data: { id: 1 } });

    expect(result).toEqual({ received: true });
  });

  describe('signature validation', () => {
    const secret = 'webhook-secret';
    const requestId = 'req-1';

    const validSignature = (dataId: string, ts = '1700000000') => {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
      return `ts=${ts},v1=${v1}`;
    };

    beforeEach(() => {
      configGet.mockReturnValue(secret);
      controller = buildController();
    });

    it('processes a notification carrying a valid signature', async () => {
      await controller.handle({ type: 'payment', data: { id: '12345' } }, validSignature('12345'), requestId);

      expect(activateFromPayment).toHaveBeenCalledWith('12345');
    });

    it('rejects a forged notification and does not activate', async () => {
      const result = await controller.handle({ type: 'payment', data: { id: '12345' } }, 'ts=1700000000,v1=deadbeef', requestId);

      expect(activateFromPayment).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('rejects when the signature header is missing', async () => {
      await controller.handle({ type: 'payment', data: { id: '12345' } });

      expect(activateFromPayment).not.toHaveBeenCalled();
    });
  });
});
