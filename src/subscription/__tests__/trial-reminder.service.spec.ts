jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { TrialReminderService } from '../trial-reminder.service';

describe('TrialReminderService', () => {
  let service: TrialReminderService;
  let findTrialEndingBetween: jest.Mock;
  let sendText: jest.Mock;
  let getMonthlyPriceBRL: jest.Mock;

  const makeUser = (id: string, phone: string): User => ({ id, phone } as unknown as User);

  beforeEach(() => {
    findTrialEndingBetween = jest.fn().mockResolvedValue([]);
    sendText = jest.fn().mockResolvedValue(undefined);
    getMonthlyPriceBRL = jest.fn().mockReturnValue(9.9);

    service = new TrialReminderService(
      { findTrialEndingBetween } as never,
      { sendText } as never,
      { getMonthlyPriceBRL } as never,
    );
    jest.spyOn(service as never as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(undefined);
  });

  it('queries two adjacent 24h windows: the next day and the previous day', async () => {
    await service.sendTrialReminders();

    expect(findTrialEndingBetween).toHaveBeenCalledTimes(2);
    const [soonStart, soonEnd] = findTrialEndingBetween.mock.calls[0];
    const [endedStart, endedEnd] = findTrialEndingBetween.mock.calls[1];

    expect(soonEnd.getTime() - soonStart.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(endedEnd.getTime() - endedStart.getTime()).toBe(24 * 60 * 60 * 1000);
    // a janela "expirou" termina onde a janela "expira em breve" começa (now)
    expect(endedEnd.getTime()).toBe(soonStart.getTime());
  });

  it('sends the ending reminder to users whose trial expires within the next day', async () => {
    findTrialEndingBetween
      .mockResolvedValueOnce([makeUser('user-1', '5511111')])
      .mockResolvedValueOnce([]);

    await service.sendTrialReminders();

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe('5511111@s.whatsapp.net');
    expect(sendText.mock.calls[0][1]).toContain('termina amanhã');
  });

  it('sends the paywall to users whose trial just ended', async () => {
    findTrialEndingBetween
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeUser('user-2', '5522222')]);

    await service.sendTrialReminders();

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe('5522222@s.whatsapp.net');
    expect(sendText.mock.calls[0][1]).toContain('teste grátis do Calito chegou ao fim');
  });

  it('skips a failing send and keeps notifying the rest', async () => {
    findTrialEndingBetween
      .mockResolvedValueOnce([makeUser('user-1', '5511111'), makeUser('user-2', '5522222')])
      .mockResolvedValueOnce([]);
    sendText.mockRejectedValueOnce(new Error('socket down'));

    await service.sendTrialReminders();

    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no trial is ending', async () => {
    await service.sendTrialReminders();
    expect(sendText).not.toHaveBeenCalled();
  });
});
