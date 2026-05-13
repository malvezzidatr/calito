jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test } from '@nestjs/testing';
import { MealsService } from '../meals.service';
import { MealsRepository } from '../meals.repository';
import { AiService } from '../../ai/ai.service';
import { UsersRepository } from '../../users/users.repository';
import { WhatsappService } from '../../whatsapp/whatsapp.service';

describe('MealsService', () => {
  let service: MealsService;
  let chat: jest.Mock;
  let findByPhone: jest.Mock;
  let create: jest.Mock;
  let sumDailyByUser: jest.Mock;
  let findDailyByUser: jest.Mock;
  let findInRangeByUser: jest.Mock;
  let sendText: jest.Mock;

  beforeEach(async () => {
    chat = jest.fn();
    findByPhone = jest.fn();
    create = jest.fn().mockResolvedValue(undefined);
    sumDailyByUser = jest.fn().mockResolvedValue({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    findDailyByUser = jest.fn().mockResolvedValue([]);
    findInRangeByUser = jest.fn().mockResolvedValue([]);
    sendText = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: AiService,        useValue: { chat } },
        { provide: UsersRepository,  useValue: { findByPhone } },
        { provide: MealsRepository,  useValue: { create, sumDailyByUser, findDailyByUser, findInRangeByUser } },
        { provide: WhatsappService,  useValue: { sendText } },
      ],
    }).compile();

    service = module.get(MealsService);
  });

  describe('register', () => {
    it('extracts meal, persists it and confirms when AI returns meal_type', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        description: 'arroz e frango',
        calories: 650,
        protein: 45,
        carbs: 75,
        fat: 12,
        meal_type: 'LUNCH',
      }));

      await service.register('5511999', 'almocei arroz e frango', '5511999@s.whatsapp.net');

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        user_id: 'user-1',
        meal_type: 'LUNCH',
        description: 'arroz e frango',
        calories: 650,
        protein: 45,
        carbs: 75,
        fat: 12,
      });

      expect(sendText).toHaveBeenCalledTimes(1);
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('5511999@s.whatsapp.net');
      expect(message).toContain('Almoço');
      expect(message).toContain('650kcal');
    });

    it('falls back to time-based meal_type when AI returns null', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-09T12:30:00'));

      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        description: '2 ovos e 1 banana',
        calories: 250,
        protein: 14,
        carbs: 27,
        fat: 11,
        meal_type: null,
      }));

      await service.register('5511999', 'comi 2 ovos e uma banana', '5511999@s.whatsapp.net');

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        meal_type: 'LUNCH',
      }));

      jest.useRealTimers();
    });

    it('warns user and skips persistence when AI returns invalid JSON', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue('isso não é json');

      await service.register('5511999', 'comi sei lá o que', '5511999@s.whatsapp.net');

      expect(create).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledTimes(1);
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('5511999@s.whatsapp.net');
      expect(message).toContain('Não consegui entender');
    });

    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.register('5511999', 'comi 2 ovos', '5511999@s.whatsapp.net');

      expect(chat).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });
  });

  describe('persistence integrity', () => {
    type StoredMeal = {
      user_id: string;
      meal_type: string;
      description: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      created_at: Date;
    };
    let store: StoredMeal[];

    beforeEach(() => {
      store = [];
      create.mockImplementation(async (data: Omit<StoredMeal, 'created_at'>) => {
        store.push({ ...data, created_at: new Date() });
        return { id: `meal-${store.length}` };
      });
      sumDailyByUser.mockImplementation(async (user_id: string) => {
        const matching = store.filter((m) => m.user_id === user_id);
        return matching.reduce(
          (acc, m) => ({
            calories: acc.calories + m.calories,
            protein:  acc.protein  + m.protein,
            carbs:    acc.carbs    + m.carbs,
            fat:      acc.fat      + m.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
      });
    });

    it('persists multiple meals for the same user with totals matching the sum of inputs', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2000, protein_goal: 100 });
      chat
        .mockResolvedValueOnce(JSON.stringify({ description: 'café', calories: 300, protein: 10, carbs: 30, fat: 12, meal_type: 'BREAKFAST' }))
        .mockResolvedValueOnce(JSON.stringify({ description: 'almoço', calories: 500, protein: 40, carbs: 50, fat: 10, meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({ description: 'lanche', calories: 200, protein: 5,  carbs: 30, fat: 5,  meal_type: 'SNACK' }));

      await service.register('phone-1', 'café da manhã', 'jid-1');
      await service.register('phone-1', 'almoço',         'jid-1');
      await service.register('phone-1', 'lanche',         'jid-1');

      expect(store).toHaveLength(3);
      expect(store.every((m) => m.user_id === 'user-1')).toBe(true);

      const totals = await sumDailyByUser.mock.results.at(-1)!.value;
      expect(totals).toEqual({ calories: 1000, protein: 55, carbs: 110, fat: 27 });
    });

    it('isolates meals between different users', async () => {
      findByPhone.mockImplementation(async (phone: string) =>
        phone === 'phone-A'
          ? { id: 'user-A', calorie_goal: 2000, protein_goal: 100 }
          : { id: 'user-B', calorie_goal: 2000, protein_goal: 100 },
      );
      chat.mockResolvedValue(JSON.stringify({
        description: 'algo', calories: 400, protein: 20, carbs: 40, fat: 10, meal_type: 'LUNCH',
      }));

      await service.register('phone-A', 'comida', 'jid-A');
      await service.register('phone-B', 'comida', 'jid-B');

      expect(store).toHaveLength(2);
      expect(store.filter((m) => m.user_id === 'user-A')).toHaveLength(1);
      expect(store.filter((m) => m.user_id === 'user-B')).toHaveLength(1);
    });

    it('sends a fallback message and does NOT persist when the AI returns an invalid extraction (negative calories)', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        description: 'algo', calories: -50, protein: 20, carbs: 40, fat: 10, meal_type: 'LUNCH',
      }));

      await service.register('phone-1', 'comida', 'jid-1');

      expect(store).toHaveLength(0);
      expect(sendText).toHaveBeenCalledWith('jid-1', expect.stringContaining('Não consegui entender'));
    });

    it('sends a technical-error message when persistence throws', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        description: 'algo', calories: 400, protein: 20, carbs: 40, fat: 10, meal_type: 'LUNCH',
      }));
      create.mockRejectedValueOnce(new Error('DB connection lost'));

      await service.register('phone-1', 'comida', 'jid-1');

      expect(sendText).toHaveBeenCalledWith('jid-1', expect.stringContaining('problema técnico'));
    });
  });

  describe('dailyResume', () => {
    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.dailyResume('5511999', '5511999@s.whatsapp.net');

      expect(sumDailyByUser).not.toHaveBeenCalled();
      expect(findDailyByUser).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('sends the daily resume with totals, meal list and praise', async () => {
      findByPhone.mockResolvedValue({
        id: 'user-1',
        calorie_goal: 2150, protein_goal: 160, carbs_goal: 240, fat_goal: 72,
      });
      sumDailyByUser.mockResolvedValue({ calories: 1650, protein: 120, carbs: 200, fat: 50 });
      findDailyByUser.mockResolvedValue([
        { meal_type: 'BREAKFAST', calories: 350 },
        { meal_type: 'LUNCH',     calories: 750 },
        { meal_type: 'SNACK',     calories: 200 },
        { meal_type: 'DINNER',    calories: 350 },
      ]);

      await service.dailyResume('phone-1', 'jid-1');

      expect(sendText).toHaveBeenCalledTimes(1);
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('📊 Resumo de hoje');
      expect(message).toContain('🔥 Calorias: 1.650 / 2.150');
      expect(message).toContain('(faltam 500)');
      expect(message).toContain('• Café: 350kcal');
      expect(message).toContain('• Almoço: 750kcal');
      expect(message).toContain('Ainda dá tempo de completar a meta');
    });

    it('queries totals and meal list for the same user in parallel', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2000, protein_goal: 100 });

      await service.dailyResume('phone-1', 'jid-1');

      expect(sumDailyByUser).toHaveBeenCalledWith('user-1', expect.any(Date));
      expect(findDailyByUser).toHaveBeenCalledWith('user-1', expect.any(Date));
    });

    it('falls back to a goal-less praise when the user has no calorie_goal', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: null });
      sumDailyByUser.mockResolvedValue({ calories: 1200, protein: 70, carbs: 150, fat: 40 });

      await service.dailyResume('phone-1', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Tô anotando');
    });

    it('shows the empty-meals placeholder when no meals were registered today', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2000 });
      findDailyByUser.mockResolvedValue([]);

      await service.dailyResume('phone-1', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Nenhuma refeição registrada hoje');
    });
  });

  describe('weeklyResume', () => {
    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.weeklyResume('5511999', '5511999@s.whatsapp.net');

      expect(findInRangeByUser).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('queries meals with a 7-day window ending on tomorrow start (end-exclusive)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-12T15:00:00Z'));

      findByPhone.mockResolvedValue({
        id: 'user-1',
        calorie_goal: 2150, protein_goal: 160, carbs_goal: 240, fat_goal: 72,
      });

      await service.weeklyResume('phone-1', 'jid-1');

      expect(findInRangeByUser).toHaveBeenCalledTimes(1);
      const [userId, start, endExcl] = findInRangeByUser.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(start.toISOString()).toBe('2026-05-06T03:00:00.000Z');
      expect(endExcl.toISOString()).toBe('2026-05-13T03:00:00.000Z');

      jest.useRealTimers();
    });

    it('sends a weekly resume with averages, days-within-goal and praise', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-12T15:00:00Z'));

      findByPhone.mockResolvedValue({
        id: 'user-1',
        calorie_goal: 2150, protein_goal: 160, carbs_goal: 240, fat_goal: 72,
      });
      findInRangeByUser.mockResolvedValue([
        { created_at: new Date('2026-05-06T13:00:00Z'), meal_type: 'LUNCH', calories: 2000, protein: 130, carbs: 220, fat: 55 },
        { created_at: new Date('2026-05-07T13:00:00Z'), meal_type: 'LUNCH', calories: 2050, protein: 130, carbs: 220, fat: 55 },
        { created_at: new Date('2026-05-08T13:00:00Z'), meal_type: 'LUNCH', calories: 1800, protein: 110, carbs: 200, fat: 50 },
        { created_at: new Date('2026-05-11T13:00:00Z'), meal_type: 'LUNCH', calories: 1900, protein: 120, carbs: 210, fat: 50 },
        { created_at: new Date('2026-05-12T13:00:00Z'), meal_type: 'LUNCH', calories: 2100, protein: 140, carbs: 230, fat: 60 },
      ]);

      await service.weeklyResume('phone-1', 'jid-1');

      expect(sendText).toHaveBeenCalledTimes(1);
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('📊 Resumo da semana');
      expect(message).toContain('Média diária');
      expect(message).toContain('Dias dentro da meta');

      jest.useRealTimers();
    });

    it('sends the empty-week placeholder when no meals were registered', async () => {
      findByPhone.mockResolvedValue({
        id: 'user-1', calorie_goal: 2150, protein_goal: 160, carbs_goal: 240, fat_goal: 72,
      });
      findInRangeByUser.mockResolvedValue([]);

      await service.weeklyResume('phone-1', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Nenhuma refeição registrada essa semana');
    });
  });

  describe('macroResume', () => {
    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.macroResume('5511999', 'quanta proteína comi?', '5511999@s.whatsapp.net');

      expect(sumDailyByUser).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('sends a friendly fallback when no macro keyword is found in the text', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2150, protein_goal: 160, carbs_goal: 240, fat_goal: 72 });

      await service.macroResume('phone-1', 'sei lá o que', 'jid-1');

      expect(sumDailyByUser).not.toHaveBeenCalled();
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('calorias');
      expect(message).toContain('proteína');
      expect(message).toContain('carboidrato');
      expect(message).toContain('gordura');
    });

    it('replies with the asked macro total and goal when the user has a goal', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', protein_goal: 160, carbs_goal: 240, fat_goal: 72 });
      sumDailyByUser.mockResolvedValue({ calories: 1500, protein: 95, carbs: 180, fat: 50 });

      await service.macroResume('phone-1', 'quanta proteína comi hoje?', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('🥩 Proteína: 95g / 160g');
      expect(message).toContain('Faltam 65g');
    });

    it('replies with carbs when the text mentions "carbo"', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', protein_goal: 160, carbs_goal: 240, fat_goal: 72 });
      sumDailyByUser.mockResolvedValue({ calories: 1500, protein: 95, carbs: 200, fat: 50 });

      await service.macroResume('phone-1', 'quanto carbo já comi', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('🍚 Carboidrato: 200g / 240g');
    });

    it('shows the no-goal fallback when the macro goal is null', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: null, protein_goal: null, carbs_goal: null, fat_goal: null });
      sumDailyByUser.mockResolvedValue({ calories: 1500, protein: 95, carbs: 180, fat: 50 });

      await service.macroResume('phone-1', 'quanta gordura comi', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('🧈 Gordura: 50g hoje');
      expect(message).toContain('Quando você fechar suas metas');
    });

    it('replies with calorie total and goal when the user asks about calories', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2282, protein_goal: 171, carbs_goal: 257, fat_goal: 63 });
      sumDailyByUser.mockResolvedValue({ calories: 420, protein: 14, carbs: 60, fat: 18 });

      await service.macroResume('phone-1', 'quantas calorias comi hoje?', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('🔥 Calorias: 420 / 2.282');
      expect(message).toContain('Faltam 1.862');
    });
  });
});
