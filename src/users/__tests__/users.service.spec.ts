jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { UsersService } from '../users.service';
import { UPDATE_GOAL_QUESTION, UPDATE_GOAL_NEEDS_PROFILE } from '../../messages/messages/general.messages';

describe('UsersService', () => {
  let service: UsersService;
  let findByPhone: jest.Mock;
  let update: jest.Mock;
  let sendText: jest.Mock;

  const fullProfile = {
    phone: '5511999',
    gender: 'MALE',
    weight: 80,
    height: 180,
    age: 30,
    activity_level: 'MODERATE',
    goal: 'MAINTAIN',
  } as unknown as User;

  beforeEach(() => {
    findByPhone = jest.fn().mockResolvedValue(fullProfile);
    update = jest.fn().mockResolvedValue(undefined);
    sendText = jest.fn().mockResolvedValue(undefined);

    service = new UsersService(
      { findByPhone, update } as never,
      { sendText } as never,
    );
  });

  describe('updateGoal', () => {
    it('recalculates and persists the new goal when the message names it', async () => {
      await service.updateGoal('5511999', 'agora quero ganhar massa', 'jid-1');

      expect(update).toHaveBeenCalledTimes(1);
      const [phone, data] = update.mock.calls[0];
      expect(phone).toBe('5511999');
      expect(data).toMatchObject({ goal: 'GAIN', onboarding_step: null });
      expect(typeof data.calorie_goal).toBe('number');
      expect(typeof data.protein_goal).toBe('number');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('ganhar massa');
      expect(message).toContain('kcal');
    });

    it('asks which goal and parks in WaitingGoalChoice when the message is ambiguous', async () => {
      await service.updateGoal('5511999', 'quero mudar meu objetivo', 'jid-1');

      expect(update).toHaveBeenCalledWith('5511999', { onboarding_step: 'waiting_goal_choice' });
      expect(sendText).toHaveBeenCalledWith('jid-1', UPDATE_GOAL_QUESTION);
      expect(findByPhone).not.toHaveBeenCalled();
    });

    it('does not recalculate when the profile is incomplete', async () => {
      findByPhone.mockResolvedValue({ ...fullProfile, weight: null });

      await service.updateGoal('5511999', 'quero emagrecer', 'jid-1');

      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith('5511999', { onboarding_step: null });
      expect(sendText).toHaveBeenCalledWith('jid-1', UPDATE_GOAL_NEEDS_PROFILE);
    });
  });

  describe('handleGoalChoice', () => {
    it('applies the goal when the reply names a valid one', async () => {
      await service.handleGoalChoice('5511999', 'emagrecer', 'jid-1');

      const [, data] = update.mock.calls[0];
      expect(data).toMatchObject({ goal: 'LOSE', onboarding_step: null });
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('emagrecer');
    });

    it('re-asks and stays in the state when the reply is not a valid goal', async () => {
      await service.handleGoalChoice('5511999', 'sei lá', 'jid-1');

      expect(update).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('jid-1', UPDATE_GOAL_QUESTION);
    });
  });
});
