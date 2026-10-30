jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { OnboardingService } from '../onboarding.service';
import { OnboardingStep } from '../utils/onboarding.constants';
import { CURRENT_LGPD_CONSENT_VERSION } from '../utils/lgpd.config';

describe('OnboardingService — reconsentimento', () => {
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

  describe('needsReconsent', () => {
    it('is true for an onboarded user whose consent_version does not match the current one', () => {
      expect(service.needsReconsent({ onboarding_step: null, consent_version: 'old-version' })).toBe(true);
    });

    it('is false when the version matches the current one', () => {
      expect(service.needsReconsent({ onboarding_step: null, consent_version: CURRENT_LGPD_CONSENT_VERSION })).toBe(false);
    });

    it('is false while the user is mid-onboarding (own flow handles consent already)', () => {
      expect(service.needsReconsent({ onboarding_step: OnboardingStep.WaitingGoal, consent_version: null })).toBe(false);
    });
  });

  describe('requestReconsent', () => {
    it('parks the user in WaitingReconsent and sends the LGPD notice again', async () => {
      await service.requestReconsent('5511999', 'jid');

      expect(update).toHaveBeenCalledWith('5511999', { onboarding_step: OnboardingStep.WaitingReconsent });
      expect(sendText).toHaveBeenCalledWith('jid', expect.any(String));
    });
  });

  describe('handleStep(WaitingReconsent)', () => {
    it('on "sim": records the current version and resumes normal use (step back to null)', async () => {
      await service.handleStep(OnboardingStep.WaitingReconsent, '5511999', 'sim', 'jid');

      expect(update).toHaveBeenCalledWith('5511999', expect.objectContaining({
        consent_given: true,
        consent_version: CURRENT_LGPD_CONSENT_VERSION,
        onboarding_step: null,
      }));
    });

    it('on "não": deletes the account instead of leaving stale consent behind', async () => {
      await service.handleStep(OnboardingStep.WaitingReconsent, '5511999', 'não', 'jid');

      expect(deleteByPhone).toHaveBeenCalledWith('5511999');
    });
  });
});
