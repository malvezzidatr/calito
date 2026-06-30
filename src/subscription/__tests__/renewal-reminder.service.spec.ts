jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { RenewalReminderService } from '../renewal-reminder.service';

describe('RenewalReminderService', () => {
  let service: RenewalReminderService;
  let findSubscriptionExpiringBetween: jest.Mock;
  let update: jest.Mock;
  let sendText: jest.Mock;
  let getMonthlyPriceBRL: jest.Mock;

  const makeUser = (id: string, phone: string, expiresAt: Date): User =>
    ({ id, phone, subscription_expires_at: expiresAt } as unknown as User);

  beforeEach(() => {
    findSubscriptionExpiringBetween = jest.fn().mockResolvedValue([]);
    update = jest.fn().mockResolvedValue(undefined);
    sendText = jest.fn().mockResolvedValue(undefined);
    getMonthlyPriceBRL = jest.fn().mockReturnValue(9.9);

    service = new RenewalReminderService(
      { findSubscriptionExpiringBetween, update } as never,
      { sendText } as never,
      { getMonthlyPriceBRL } as never,
    );
    jest.spyOn(service as never as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(undefined);
  });

  it('queries two adjacent 24h windows', async () => {
    await service.sendRenewalReminders();

    expect(findSubscriptionExpiringBetween).toHaveBeenCalledTimes(2);
    const [soonStart, soonEnd] = findSubscriptionExpiringBetween.mock.calls[0];
    const [expiredStart, expiredEnd] = findSubscriptionExpiringBetween.mock.calls[1];

    expect(soonEnd.getTime() - soonStart.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(expiredEnd.getTime() - expiredStart.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(expiredEnd.getTime()).toBe(soonStart.getTime());
  });

  it('sends renewal reminder to users expiring tomorrow', async () => {
    const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000);
    findSubscriptionExpiringBetween
      .mockResolvedValueOnce([makeUser('u1', '5511111', expiresAt)])
      .mockResolvedValueOnce([]);

    await service.sendRenewalReminders();

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe('5511111@s.whatsapp.net');
    expect(sendText.mock.calls[0][1]).toContain('termina amanhã');
  });

  it('marks expired users as INACTIVE and sends expired message', async () => {
    const expiresAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    findSubscriptionExpiringBetween
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeUser('u2', '5522222', expiresAt)]);

    await service.sendRenewalReminders();

    expect(update).toHaveBeenCalledWith('5522222', { status: 'INACTIVE' });
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe('5522222@s.whatsapp.net');
    expect(sendText.mock.calls[0][1]).toContain('venceu');
  });

  it('skips a failing send and keeps notifying the rest', async () => {
    const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000);
    findSubscriptionExpiringBetween
      .mockResolvedValueOnce([
        makeUser('u1', '5511111', expiresAt),
        makeUser('u2', '5522222', expiresAt),
      ])
      .mockResolvedValueOnce([]);
    sendText.mockRejectedValueOnce(new Error('timeout'));

    await service.sendRenewalReminders();

    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no subscription is expiring', async () => {
    await service.sendRenewalReminders();
    expect(sendText).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
