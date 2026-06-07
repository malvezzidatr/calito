jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {},
}));

import { MercadoPagoWebhookController } from '../mercadopago.webhook.controller';

describe('MercadoPagoWebhookController', () => {
  let controller: MercadoPagoWebhookController;
  let activateFromPayment: jest.Mock;

  beforeEach(() => {
    activateFromPayment = jest.fn().mockResolvedValue(undefined);
    controller = new MercadoPagoWebhookController({ activateFromPayment } as never);
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
});
