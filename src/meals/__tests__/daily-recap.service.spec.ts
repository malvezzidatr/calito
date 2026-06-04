jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { DailyRecapService } from '../daily-recap.service';

describe('DailyRecapService', () => {
  let service: DailyRecapService;
  let findOnboardedWithMealsInRange: jest.Mock;
  let buildDailyResumeMessage: jest.Mock;
  let sendText: jest.Mock;

  const makeUser = (id: string, phone: string): User => ({ id, phone } as unknown as User);

  beforeEach(() => {
    findOnboardedWithMealsInRange = jest.fn().mockResolvedValue([]);
    buildDailyResumeMessage = jest.fn().mockResolvedValue('resumo do dia');
    sendText = jest.fn().mockResolvedValue(undefined);

    service = new DailyRecapService(
      { findOnboardedWithMealsInRange } as never,
      { buildDailyResumeMessage } as never,
      { sendText } as never,
    );
    // evita esperar o throttle real nos testes
    jest.spyOn(service as never as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(undefined);
  });

  it('queries eligible users for today with a full-day range', async () => {
    await service.sendDailyRecaps();

    expect(findOnboardedWithMealsInRange).toHaveBeenCalledTimes(1);
    const [start, end] = findOnboardedWithMealsInRange.mock.calls[0];
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('sends the recap to each eligible user with the right jid and message', async () => {
    findOnboardedWithMealsInRange.mockResolvedValue([
      makeUser('user-1', '5511111'),
      makeUser('user-2', '5522222'),
    ]);

    await service.sendDailyRecaps();

    expect(buildDailyResumeMessage).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenNthCalledWith(1, '5511111@s.whatsapp.net', 'resumo do dia');
    expect(sendText).toHaveBeenNthCalledWith(2, '5522222@s.whatsapp.net', 'resumo do dia');
  });

  it('throttles between sends but not after the last one', async () => {
    findOnboardedWithMealsInRange.mockResolvedValue([
      makeUser('user-1', '5511111'),
      makeUser('user-2', '5522222'),
      makeUser('user-3', '5533333'),
    ]);
    const sleep = jest.spyOn(service as never as { sleep: () => Promise<void> }, 'sleep');

    await service.sendDailyRecaps();

    // 3 destinatários -> 2 throttles entre eles
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('skips a failing user and keeps sending to the rest', async () => {
    findOnboardedWithMealsInRange.mockResolvedValue([
      makeUser('user-1', '5511111'),
      makeUser('user-2', '5522222'),
    ]);
    buildDailyResumeMessage.mockRejectedValueOnce(new Error('DB down'));

    await service.sendDailyRecaps();

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith('5522222@s.whatsapp.net', 'resumo do dia');
  });

  it('does nothing when there are no eligible users', async () => {
    findOnboardedWithMealsInRange.mockResolvedValue([]);

    await service.sendDailyRecaps();

    expect(buildDailyResumeMessage).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });
});
