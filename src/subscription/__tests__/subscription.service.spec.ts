jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {},
}));

import { User } from '@prisma/client';
import { SubscriptionService } from '../subscription.service';
import { CHECKOUT_ERROR } from '../messages/subscription.messages';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let sendText: jest.Mock;
  let configGet: jest.Mock;
  let findByPhone: jest.Mock;
  let update: jest.Mock;
  let createPixCharge: jest.Mock;
  let getPayment: jest.Mock;

  beforeEach(() => {
    sendText = jest.fn().mockResolvedValue(undefined);
    configGet = jest.fn().mockReturnValue(undefined); // sem env -> default
    findByPhone = jest.fn();
    update = jest.fn().mockResolvedValue(undefined);
    createPixCharge = jest.fn();
    getPayment = jest.fn();

    service = new SubscriptionService(
      { sendText } as never,
      { get: configGet } as never,
      { findByPhone, update } as never,
      { createPixCharge, getPayment } as never,
    );
  });

  describe('access + price', () => {
    it('isActive is true for an ACTIVE, non-expired user', () => {
      const farFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(service.isActive({ status: 'ACTIVE', subscription_expires_at: farFuture } as unknown as User)).toBe(true);
    });

    it('isActive is false for a user who never paid', () => {
      expect(service.isActive({ status: 'INACTIVE', subscription_expires_at: null } as unknown as User)).toBe(false);
    });

    it('requiresSubscription gates paid intents but not free ones', () => {
      expect(service.requiresSubscription('register_meal')).toBe(true);
      expect(service.requiresSubscription('help')).toBe(false);
    });

    it('defaults the monthly price to 9.90 and reads the env override', () => {
      expect(service.getMonthlyPriceBRL()).toBe(9.9);
      configGet.mockReturnValue('19.90');
      expect(service.getMonthlyPriceBRL()).toBe(19.9);
    });

    it('sendPaywall shows the configured price', async () => {
      await service.sendPaywall('jid-1');
      expect(sendText.mock.calls[0][1]).toContain('R$ 9,90/mês');
    });
  });

  describe('startTrial', () => {
    it('persists a future trial end and announces the free days', async () => {
      await service.startTrial('5511999', 'jid-1');

      const [phone, data] = update.mock.calls[0];
      expect(phone).toBe('5511999');
      expect(data.trial_ends_at.getTime()).toBeGreaterThan(Date.now());
      expect(sendText).toHaveBeenCalledWith('jid-1', expect.stringContaining('dias grátis'));
    });

    it('grants exactly 3 days of trial', async () => {
      const before = Date.now();
      await service.startTrial('5511999', 'jid-1');
      const trialEndsAt: Date = update.mock.calls[0][1].trial_ends_at;
      const days = (trialEndsAt.getTime() - before) / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(3, 1);
    });
  });

  describe('startCheckout', () => {
    it('creates a Pix charge, stores the payment id and sends the copia-e-cola', async () => {
      createPixCharge.mockResolvedValue({ paymentId: 'pay-1', qrCode: 'PIXCODE', qrCodeBase64: 'b64' });

      await service.startCheckout('5511999', 'jid-1');

      expect(createPixCharge).toHaveBeenCalledWith(
        expect.objectContaining({ amountBRL: 9.9, externalReference: '5511999', payerEmail: '5511999@calito.app' }),
      );
      expect(update).toHaveBeenCalledWith('5511999', { subscription_id: 'pay-1' });
      expect(sendText).toHaveBeenCalledTimes(2);
      expect(sendText).toHaveBeenNthCalledWith(2, 'jid-1', 'PIXCODE');
    });

    it('sends an error message and does not persist when the charge fails', async () => {
      createPixCharge.mockRejectedValue(new Error('mp down'));

      await service.startCheckout('5511999', 'jid-1');

      expect(update).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('jid-1', CHECKOUT_ERROR);
    });

    describe('with a previous Pix charge', () => {
      beforeEach(() => {
        findByPhone.mockResolvedValue({ phone: '5511999', subscription_id: 'old-pay' });
      });

      it('resends the same Pix when the previous one is still pending', async () => {
        getPayment.mockResolvedValue({ id: 'old-pay', status: 'pending', externalReference: '5511999', qrCode: 'OLDPIX' });

        await service.startCheckout('5511999', 'jid-1');

        expect(createPixCharge).not.toHaveBeenCalled();
        expect(sendText).toHaveBeenNthCalledWith(2, 'jid-1', 'OLDPIX');
      });

      it('activates and skips a new charge when the previous payment was approved', async () => {
        getPayment.mockResolvedValue({ id: 'old-pay', status: 'approved', externalReference: '5511999', qrCode: '' });
        findByPhone.mockResolvedValue({ phone: '5511999', subscription_id: 'old-pay', status: 'INACTIVE', subscription_expires_at: null });

        await service.startCheckout('5511999', 'jid-1');

        expect(createPixCharge).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith('5511999', expect.objectContaining({ status: 'ACTIVE' }));
      });

      it('warns and generates a new Pix when the previous one expired', async () => {
        getPayment.mockResolvedValue({ id: 'old-pay', status: 'cancelled', externalReference: '5511999', qrCode: '' });
        createPixCharge.mockResolvedValue({ paymentId: 'new-pay', qrCode: 'NEWPIX', qrCodeBase64: 'b64' });

        await service.startCheckout('5511999', 'jid-1');

        expect(sendText.mock.calls[0][1]).toContain('expirou');
        expect(createPixCharge).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith('5511999', { subscription_id: 'new-pay' });
      });

      it('generates a new Pix when the previous payment cannot be fetched', async () => {
        getPayment.mockRejectedValue(new Error('mp down'));
        createPixCharge.mockResolvedValue({ paymentId: 'new-pay', qrCode: 'NEWPIX', qrCodeBase64: 'b64' });

        await service.startCheckout('5511999', 'jid-1');

        expect(createPixCharge).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('activateFromPayment', () => {
    it('activates the subscription on an approved payment and confirms to the user', async () => {
      getPayment.mockResolvedValue({ id: 'pay-1', status: 'approved', externalReference: '5511999' });
      findByPhone.mockResolvedValue({ phone: '5511999', subscription_id: 'pay-1', status: 'INACTIVE', subscription_expires_at: null });

      await service.activateFromPayment('pay-1');

      const [phone, data] = update.mock.calls[0];
      expect(phone).toBe('5511999');
      expect(data).toMatchObject({ status: 'ACTIVE', subscription_id: 'pay-1' });
      expect(data.subscription_expires_at.getTime()).toBeGreaterThan(Date.now());
      expect(sendText).toHaveBeenCalledWith('5511999@s.whatsapp.net', expect.stringContaining('Pagamento confirmado'));
    });

    it('ignores a payment that is not approved', async () => {
      getPayment.mockResolvedValue({ id: 'pay-1', status: 'pending', externalReference: '5511999' });

      await service.activateFromPayment('pay-1');

      expect(update).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('is idempotent when the payment was already activated', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      getPayment.mockResolvedValue({ id: 'pay-1', status: 'approved', externalReference: '5511999' });
      findByPhone.mockResolvedValue({ phone: '5511999', subscription_id: 'pay-1', status: 'ACTIVE', subscription_expires_at: future });

      await service.activateFromPayment('pay-1');

      expect(update).not.toHaveBeenCalled();
    });

    it('ignores an approved payment for an unknown user', async () => {
      getPayment.mockResolvedValue({ id: 'pay-1', status: 'approved', externalReference: '5511999' });
      findByPhone.mockResolvedValue(null);

      await service.activateFromPayment('pay-1');

      expect(update).not.toHaveBeenCalled();
    });
  });
});
