jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { OnboardingService } from '../onboarding.service';
import { OnboardingStep } from '../utils/onboarding.constants';

describe('OnboardingService — idade mínima', () => {
  let service: OnboardingService;
  let update: jest.Mock;
  let deleteByPhone: jest.Mock;
  let sendText: jest.Mock;

  beforeEach(() => {
    update = jest.fn().mockResolvedValue(undefined);
    deleteByPhone = jest.fn().mockResolvedValue(undefined);
    sendText = jest.fn().mockResolvedValue(undefined);

    service = new OnboardingService(
      { update, deleteByPhone, findByPhone: jest.fn() } as never,
      { sendText } as never,
      {} as never,
      {} as never,
    );
  });

  it('rejects and deletes the pending record for a 17-year-old (no verifiable parental consent)', async () => {
    await service.handleStep(OnboardingStep.WaitingAge, '5511999', '17', 'jid');

    expect(deleteByPhone).toHaveBeenCalledWith('5511999');
    expect(update).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith('jid', expect.stringContaining('18 anos'));
  });

  it('accepts exactly 18 and advances to the gender step', async () => {
    await service.handleStep(OnboardingStep.WaitingAge, '5511999', '18', 'jid');

    expect(update).toHaveBeenCalledWith('5511999', { age: 18, onboarding_step: OnboardingStep.WaitingGender });
    expect(deleteByPhone).not.toHaveBeenCalled();
  });

  it('still asks again for an unparseable age instead of treating it as underage', async () => {
    await service.handleStep(OnboardingStep.WaitingAge, '5511999', 'trinta e poucos', 'jid');

    expect(deleteByPhone).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
