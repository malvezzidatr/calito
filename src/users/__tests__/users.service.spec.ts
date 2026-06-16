jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { UsersService } from '../users.service';
import { UPDATE_GOAL_QUESTION, UPDATE_WEIGHT_QUESTION } from '../../messages/messages/general.messages';

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

    it('updates the goal but keeps targets when the profile is incomplete (nutricionista)', async () => {
      findByPhone.mockResolvedValue({ ...fullProfile, weight: null });

      await service.updateGoal('5511999', 'quero emagrecer', 'jid-1');

      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith('5511999', { goal: 'LOSE', onboarding_step: null });
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('emagrecer');
      expect(message).toContain('continuam as mesmas');
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

  describe('viewProfile', () => {
    it('sends weight, height, goal and daily targets', async () => {
      findByPhone.mockResolvedValue({
        ...fullProfile,
        goal: 'GAIN',
        calorie_goal: 2400,
        protein_goal: 144,
        carbs_goal: 250,
        fat_goal: 80,
      });

      await service.viewProfile('5511999', 'jid-1');

      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('80 kg');
      expect(message).toContain('180 cm');
      expect(message).toContain('ganhar massa');
      expect(message).toContain('2.400 kcal');
      expect(message).toContain('144g de proteína');
    });

    it('says targets are not set when the user has no calorie_goal', async () => {
      findByPhone.mockResolvedValue({ ...fullProfile, calorie_goal: null });

      await service.viewProfile('5511999', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('metas ainda não foram definidas');
    });

    it('shows the goal as nutritionist-defined when targets exist but no goal was chosen', async () => {
      findByPhone.mockResolvedValue({ ...fullProfile, goal: null, calorie_goal: 2000 });

      await service.viewProfile('5511999', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('definido pela sua nutri');
      expect(message).not.toContain('não definido');
    });

    it('does nothing when the user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.viewProfile('5511999', 'jid-1');

      expect(sendText).not.toHaveBeenCalled();
    });
  });

  describe('updateWeight', () => {
    it('updates the weight and recalculates targets when the message has a valid weight', async () => {
      await service.updateWeight('5511999', 'atualiza meu peso pra 75', 'jid-1');

      expect(update).toHaveBeenCalledTimes(1);
      const [phone, data] = update.mock.calls[0];
      expect(phone).toBe('5511999');
      expect(data).toMatchObject({ weight: 75, onboarding_step: null });
      expect(typeof data.calorie_goal).toBe('number');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('75 kg');
      expect(message).toContain('kcal');
    });

    it('asks for the weight and parks in WaitingWeightUpdate when none is given', async () => {
      await service.updateWeight('5511999', 'quero mudar meu peso', 'jid-1');

      expect(update).toHaveBeenCalledWith('5511999', { onboarding_step: 'waiting_weight_update' });
      expect(sendText).toHaveBeenCalledWith('jid-1', UPDATE_WEIGHT_QUESTION);
      expect(findByPhone).not.toHaveBeenCalled();
    });

    it('asks again when the weight is out of the accepted range', async () => {
      await service.updateWeight('5511999', 'meu peso é 5', 'jid-1');

      expect(update).toHaveBeenCalledWith('5511999', { onboarding_step: 'waiting_weight_update' });
      expect(sendText).toHaveBeenCalledWith('jid-1', UPDATE_WEIGHT_QUESTION);
    });

    it('saves the weight without recalculating when the profile is incomplete', async () => {
      findByPhone.mockResolvedValue({ ...fullProfile, height: null });

      await service.updateWeight('5511999', 'peso 70', 'jid-1');

      expect(update).toHaveBeenCalledWith('5511999', { weight: 70, onboarding_step: null });
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('70 kg');
      expect(message).toContain('continuam as mesmas');
    });
  });

  describe('handleWeightUpdate', () => {
    it('applies a valid weight reply', async () => {
      await service.handleWeightUpdate('5511999', '82', 'jid-1');

      const [, data] = update.mock.calls[0];
      expect(data).toMatchObject({ weight: 82, onboarding_step: null });
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('82 kg');
    });

    it('re-asks when the reply is not a valid weight', async () => {
      await service.handleWeightUpdate('5511999', 'sei lá', 'jid-1');

      expect(update).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('jid-1', UPDATE_WEIGHT_QUESTION);
    });
  });
});
