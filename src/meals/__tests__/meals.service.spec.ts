jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { MealsService } from '../meals.service';
import { MealsRepository } from '../meals.repository';
import { AiService } from '../../ai/ai.service';
import { UsersRepository } from '../../users/users.repository';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { FoodsService } from '../../foods/foods.service';
import { ParsedMessagesRepository } from '../parsed-messages.repository';

describe('MealsService', () => {
  let service: MealsService;
  let chat: jest.Mock;
  let findByPhone: jest.Mock;
  let create: jest.Mock;
  let sumDailyByUser: jest.Mock;
  let findDailyByUser: jest.Mock;
  let findInRangeByUser: jest.Mock;
  let findLastByUser: jest.Mock;
  let findDailyByUserAndType: jest.Mock;
  let deleteById: jest.Mock;
  let updateById: jest.Mock;
  let sendText: jest.Mock;
  let calculateWithFallback: jest.Mock;
  let configGet: jest.Mock;
  let parsedFindByText: jest.Mock;
  let parsedUpsert: jest.Mock;

  beforeEach(async () => {
    chat = jest.fn();
    findByPhone = jest.fn();
    create = jest.fn().mockResolvedValue(undefined);
    sumDailyByUser = jest.fn().mockResolvedValue({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    findDailyByUser = jest.fn().mockResolvedValue([]);
    findInRangeByUser = jest.fn().mockResolvedValue([]);
    findLastByUser = jest.fn().mockResolvedValue(null);
    findDailyByUserAndType = jest.fn().mockResolvedValue([]);
    deleteById = jest.fn().mockResolvedValue(undefined);
    updateById = jest.fn().mockResolvedValue(undefined);
    sendText = jest.fn().mockResolvedValue(undefined);
    calculateWithFallback = jest.fn();
    configGet = jest.fn().mockReturnValue('false'); // default: feature flag OFF
    parsedFindByText = jest.fn().mockResolvedValue(null); // default: cache miss
    parsedUpsert = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: AiService,        useValue: { chat } },
        { provide: UsersRepository,  useValue: { findByPhone } },
        { provide: MealsRepository,  useValue: { create, sumDailyByUser, findDailyByUser, findInRangeByUser, findLastByUser, findDailyByUserAndType, deleteById, updateById } },
        { provide: WhatsappService,  useValue: { sendText } },
        { provide: FoodsService,             useValue: { calculateWithFallback } },
        { provide: ConfigService,            useValue: { get: configGet } },
        { provide: ParsedMessagesRepository, useValue: { findByText: parsedFindByText, upsert: parsedUpsert } },
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
      jest.setSystemTime(new Date('2026-05-09T15:30:00Z'));

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

    it('sends the clarification question and does NOT persist when AI asks for clarification', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        needs_clarification: 'Me passa as quantidades 🤔 Ex: 4 colheres de arroz, 1 concha de feijão, 1 filé de frango',
      }));

      await service.register('5511999', 'comi arroz, feijão e frango', '5511999@s.whatsapp.net');

      expect(create).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledTimes(1);
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('5511999@s.whatsapp.net');
      expect(message).toBe('Me passa as quantidades 🤔 Ex: 4 colheres de arroz, 1 concha de feijão, 1 filé de frango');
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
        const matching = store.filter((meal) => meal.user_id === user_id);
        return matching.reduce(
          (acc, meal) => ({
            calories: acc.calories + meal.calories,
            protein:  acc.protein  + meal.protein,
            carbs:    acc.carbs    + meal.carbs,
            fat:      acc.fat      + meal.fat,
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

    it('sends header + empty-day message when no meals were registered today', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2000 });
      findDailyByUser.mockResolvedValue([]);

      await service.dailyResume('phone-1', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('📊 Resumo de hoje');
      expect(message).toContain('Você ainda não registrou nada hoje');
      expect(message).not.toContain('🔥 Calorias');
    });
  });

  describe('buildDailyResumeMessage', () => {
    const today = new Date('2026-06-02T18:00:00Z');

    it('builds the message with totals, meal list and praise without sending', async () => {
      const user = {
        id: 'user-1',
        calorie_goal: 2150, protein_goal: 160, carbs_goal: 240, fat_goal: 72,
      } as unknown as User;
      sumDailyByUser.mockResolvedValue({ calories: 1650, protein: 120, carbs: 200, fat: 50 });
      findDailyByUser.mockResolvedValue([
        { meal_type: 'BREAKFAST', calories: 350 },
        { meal_type: 'LUNCH',     calories: 750 },
      ]);

      const message = await service.buildDailyResumeMessage(user, today);

      expect(message).toContain('📊 Resumo de hoje');
      expect(message).toContain('🔥 Calorias: 1.650 / 2.150');
      expect(message).toContain('• Café: 350kcal');
      expect(message).toContain('• Almoço: 750kcal');
      expect(sendText).not.toHaveBeenCalled();
    });

    it('queries totals and meal list for the same user and date in parallel', async () => {
      const user = { id: 'user-1', calorie_goal: 2000, protein_goal: 100 } as unknown as User;

      await service.buildDailyResumeMessage(user, today);

      expect(sumDailyByUser).toHaveBeenCalledWith('user-1', today);
      expect(findDailyByUser).toHaveBeenCalledWith('user-1', today);
    });

    it('uses a goal-less praise when the user has no calorie_goal', async () => {
      const user = { id: 'user-1', calorie_goal: null } as unknown as User;
      sumDailyByUser.mockResolvedValue({ calories: 1200, protein: 70, carbs: 150, fat: 40 });

      const message = await service.buildDailyResumeMessage(user, today);

      expect(message).toContain('Tô anotando');
    });

    it('builds header + empty-day message when no meals were registered', async () => {
      const user = { id: 'user-1', calorie_goal: 2000 } as unknown as User;
      findDailyByUser.mockResolvedValue([]);

      const message = await service.buildDailyResumeMessage(user, today);

      expect(message).toContain('📊 Resumo de hoje');
      expect(message).toContain('Você ainda não registrou nada hoje');
      expect(message).not.toContain('🔥 Calorias');
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
      expect(message).toContain('📊 Proteína de hoje');
      expect(message).toContain('🥩 Proteína: 95g / 160g (faltam 65g)');
      expect(message).toContain('Bora completar essa meta!');
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
      expect(message).toContain('📊 Gordura de hoje');
      expect(message).toContain('🧈 Gordura: 50g');
      expect(message).toContain('Quando você fechar suas metas');
    });

    it('replies with calorie total and goal when the user asks about calories', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2282, protein_goal: 171, carbs_goal: 257, fat_goal: 63 });
      sumDailyByUser.mockResolvedValue({ calories: 420, protein: 14, carbs: 60, fat: 18 });

      await service.macroResume('phone-1', 'quantas calorias comi hoje?', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('📊 Calorias de hoje');
      expect(message).toContain('🔥 Calorias: 420 / 2.282 (faltam 1.862)');
    });

    it('sends the empty-day message when the asked macro has 0 total today', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1', calorie_goal: 2000, protein_goal: 160, carbs_goal: 240, fat_goal: 72 });
      sumDailyByUser.mockResolvedValue({ calories: 0, protein: 0, carbs: 0, fat: 0 });

      await service.macroResume('phone-1', 'quanta proteína comi hoje?', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Você ainda não registrou nada hoje');
      expect(message).not.toContain('🥩 Proteína:');
      expect(message).not.toContain('Faltam');
    });
  });

  describe('deleteLast', () => {
    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.deleteLast('5511999', '5511999@s.whatsapp.net');

      expect(findLastByUser).not.toHaveBeenCalled();
      expect(deleteById).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('sends the empty-delete message when the user has no meal to delete', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue(null);

      await service.deleteLast('phone-1', 'jid-1');

      expect(deleteById).not.toHaveBeenCalled();
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('Não tenho nada pra apagar');
    });

    it('deletes the last meal and sends a confirmation with type, description and calories', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz e frango', calories: 750 });

      await service.deleteLast('phone-1', 'jid-1');

      expect(findLastByUser).toHaveBeenCalledWith('user-1');
      expect(deleteById).toHaveBeenCalledTimes(1);
      expect(deleteById).toHaveBeenCalledWith('meal-42');

      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('Almoço');
      expect(message).toContain('arroz e frango');
      expect(message).toContain('750kcal');
      expect(message).toContain('🗑️');
    });

    it('deletes only ONE meal per call — the second call hits the new last meal', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser
        .mockResolvedValueOnce({ id: 'meal-2', meal_type: 'DINNER', description: 'omelete', calories: 600 })
        .mockResolvedValueOnce({ id: 'meal-1', meal_type: 'LUNCH',  description: 'arroz e frango', calories: 750 });

      await service.deleteLast('phone-1', 'jid-1');
      await service.deleteLast('phone-1', 'jid-1');

      expect(deleteById).toHaveBeenCalledTimes(2);
      expect(deleteById).toHaveBeenNthCalledWith(1, 'meal-2');
      expect(deleteById).toHaveBeenNthCalledWith(2, 'meal-1');
    });

    it('sends a technical-error message when deletion throws and does NOT confirm', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz e frango', calories: 750 });
      deleteById.mockRejectedValueOnce(new Error('DB connection lost'));

      await service.deleteLast('phone-1', 'jid-1');

      expect(sendText).toHaveBeenCalledTimes(1);
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('problema técnico');
      expect(message).not.toContain('Almoço');
    });
  });

  describe('editLast', () => {
    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.editLast('5511999', 'era 1 ovo', '5511999@s.whatsapp.net');

      expect(findLastByUser).not.toHaveBeenCalled();
      expect(chat).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('sends the empty-edit message when the user has no meal to edit', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue(null);

      await service.editLast('phone-1', 'era 1 ovo', 'jid-1');

      expect(chat).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toContain('Não tenho nada pra editar');
    });

    it('re-extracts macros using original description + correction and updates the same meal', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'BREAKFAST', description: '2 ovos', calories: 140 });
      chat.mockResolvedValue(JSON.stringify({
        description: '1 ovo',
        calories: 70,
        protein: 6,
        carbs: 0,
        fat: 5,
        meal_type: null,
      }));

      await service.editLast('phone-1', 'era 1 ovo, não 2', 'jid-1');

      expect(chat).toHaveBeenCalledTimes(1);
      const [messages] = chat.mock.calls[0];
      expect(messages[0].content).toContain('2 ovos');
      expect(messages[0].content).toContain('era 1 ovo, não 2');

      expect(updateById).toHaveBeenCalledTimes(1);
      expect(updateById).toHaveBeenCalledWith('meal-42', {
        meal_type: 'BREAKFAST',
        description: '1 ovo',
        calories: 70,
        protein: 6,
        carbs: 0,
        fat: 5,
      });

      const [jid, confirmation] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(confirmation).toContain('✏️');
      expect(confirmation).toContain('Café');
      expect(confirmation).toContain('1 ovo');
      expect(confirmation).toContain('70kcal');
    });

    it('keeps the original meal_type when the AI returns null', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz e frango', calories: 750 });
      chat.mockResolvedValue(JSON.stringify({
        description: 'arroz e peixe',
        calories: 500,
        protein: 35,
        carbs: 60,
        fat: 8,
        meal_type: null,
      }));

      await service.editLast('phone-1', 'era peixe, não frango', 'jid-1');

      expect(updateById).toHaveBeenCalledWith('meal-42', expect.objectContaining({ meal_type: 'LUNCH' }));
    });

    it('sends a friendly fallback and does NOT update when the AI returns invalid JSON', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz e frango', calories: 750 });
      chat.mockResolvedValue('isso não é json');

      await service.editLast('phone-1', 'era diferente', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui entender');
    });

    it('sends the clarification question and does NOT update when AI asks for clarification', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: '2 ovos', calories: 140 });
      chat.mockResolvedValue(JSON.stringify({
        needs_clarification: 'Me passa quanto de arroz 🤔 Ex: 4 colheres no almoço',
      }));

      await service.editLast('phone-1', 'troca por arroz', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [jid, message] = sendText.mock.calls[0];
      expect(jid).toBe('jid-1');
      expect(message).toBe('Me passa quanto de arroz 🤔 Ex: 4 colheres no almoço');
    });

    it('sends a friendly fallback and does NOT update when the AI returns invalid extraction (negative calories)', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz e frango', calories: 750 });
      chat.mockResolvedValue(JSON.stringify({
        description: 'algo', calories: -10, protein: 20, carbs: 40, fat: 10, meal_type: 'LUNCH',
      }));

      await service.editLast('phone-1', 'era algo', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui entender');
    });

    it('sends VAGUE_EDIT_MESSAGE and does NOT update when the new description is identical to the original', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz, feijão e frango', calories: 750 });
      chat.mockResolvedValue(JSON.stringify({
        description: 'arroz, feijão e frango',
        calories: 760,
        protein: 46,
        carbs: 50,
        fat: 5,
        meal_type: 'LUNCH',
      }));

      await service.editLast('phone-1', 'edite minha última refeição', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não entendi o que você quer mudar');
    });

    it('ignores casing and whitespace when comparing descriptions', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'Arroz e Frango', calories: 750 });
      chat.mockResolvedValue(JSON.stringify({
        description: '  arroz e frango  ',
        calories: 740, protein: 45, carbs: 75, fat: 12, meal_type: 'LUNCH',
      }));

      await service.editLast('phone-1', 'edita aí', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não entendi o que você quer mudar');
    });

    it('sends a technical-error message when update throws and does NOT confirm', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz e frango', calories: 750 });
      chat.mockResolvedValue(JSON.stringify({
        description: 'arroz e peixe', calories: 500, protein: 35, carbs: 60, fat: 8, meal_type: 'LUNCH',
      }));
      updateById.mockRejectedValueOnce(new Error('DB connection lost'));

      await service.editLast('phone-1', 'era peixe', 'jid-1');

      expect(sendText).toHaveBeenCalledTimes(1);
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('problema técnico');
      expect(message).not.toContain('✏️');
    });
  });

  describe('editMeal', () => {
    const refReply = (overrides: Partial<{ meal_type: string; time: string | null; days_offset: number }> = {}) =>
      JSON.stringify({ meal_type: 'LUNCH', time: null, days_offset: 0, ...overrides });
    const lunchMeal = (overrides: Partial<{ id: string; description: string; calories: number; created_at: Date }> = {}) => ({
      id: 'meal-1',
      meal_type: 'LUNCH',
      description: 'arroz e frango',
      calories: 750,
      created_at: new Date('2026-05-12T15:00:00Z'),
      ...overrides,
    });

    it('returns silently when user is not found', async () => {
      findByPhone.mockResolvedValue(null);

      await service.editMeal('5511999', 'corrige o almoço', '5511999@s.whatsapp.net');

      expect(chat).not.toHaveBeenCalled();
      expect(findDailyByUserAndType).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    });

    it('forwards reference clarification and does NOT search/update', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({ needs_clarification: 'Qual refeição? 🤔' }));

      await service.editMeal('phone-1', 'corrige isso', 'jid-1');

      expect(findDailyByUserAndType).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('jid-1', 'Qual refeição? 🤔');
    });

    it('sends a friendly fallback when the reference extractor returns invalid JSON', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue('isso não é json');

      await service.editMeal('phone-1', 'corrige', 'jid-1');

      expect(findDailyByUserAndType).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não entendi qual refeição');
    });

    it('replies with not-found when there is no meal of that type on the target day', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(refReply({ meal_type: 'LUNCH' }));
      findDailyByUserAndType.mockResolvedValue([]);

      await service.editMeal('phone-1', 'corrige meu almoço', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      expect(chat).toHaveBeenCalledTimes(1);
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não vi nenhum Almoço');
      expect(message).toContain('hoje');
      expect(message).toContain('corrigir');
    });

    it('re-extracts and updates when there is exactly one match for the type', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({
          description: 'carne com salada',
          calories: 420,
          protein: 35,
          carbs: 10,
          fat: 22,
          meal_type: 'LUNCH',
        }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);

      await service.editMeal('phone-1', 'corrige meu almoço pra carne com salada', 'jid-1');

      expect(chat).toHaveBeenCalledTimes(2);
      const [secondMessages] = chat.mock.calls[1];
      expect(secondMessages[0].content).toContain('arroz e frango');
      expect(secondMessages[0].content).toContain('corrige meu almoço pra carne com salada');

      expect(updateById).toHaveBeenCalledTimes(1);
      expect(updateById).toHaveBeenCalledWith('meal-1', {
        meal_type: 'LUNCH',
        description: 'carne com salada',
        calories: 420,
        protein: 35,
        carbs: 10,
        fat: 22,
      });

      const [, confirmation] = sendText.mock.calls[0];
      expect(confirmation).toContain('✏️');
      expect(confirmation).toContain('Almoço');
      expect(confirmation).toContain('carne com salada');
      expect(confirmation).toContain('420kcal');
    });

    it('asks for disambiguation when there are 2+ matches and no time', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(refReply({ meal_type: 'SNACK' }));
      findDailyByUserAndType.mockResolvedValue([
        { id: 'meal-a', meal_type: 'SNACK', description: 'maçã', calories: 80, created_at: new Date('2026-05-12T13:00:00Z') },
        { id: 'meal-b', meal_type: 'SNACK', description: 'whey', calories: 120, created_at: new Date('2026-05-12T19:00:00Z') },
      ]);

      await service.editMeal('phone-1', 'corrige meu lanche', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Você tem 2 lanches');
      expect(message).toContain('corrige o lanche das');
    });

    it('picks the match by time when reference includes time', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'SNACK', time: '16:00' }))
        .mockResolvedValueOnce(JSON.stringify({
          description: '1 maçã',
          calories: 80,
          protein: 0,
          carbs: 21,
          fat: 0,
          meal_type: 'SNACK',
        }));
      findDailyByUserAndType.mockResolvedValue([
        { id: 'meal-morning', meal_type: 'SNACK', description: 'banana', calories: 90, created_at: new Date('2026-05-12T13:00:00Z') },
        { id: 'meal-afternoon', meal_type: 'SNACK', description: 'whey', calories: 120, created_at: new Date('2026-05-12T19:00:00Z') },
      ]);

      await service.editMeal('phone-1', 'corrige o lanche das 16h pra 1 maçã', 'jid-1');

      expect(updateById).toHaveBeenCalledTimes(1);
      expect(updateById).toHaveBeenCalledWith('meal-afternoon', expect.objectContaining({ description: '1 maçã' }));
    });

    it('replies with time-not-found when reference includes time but no match has that time', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(refReply({ meal_type: 'SNACK', time: '09:00' }));
      findDailyByUserAndType.mockResolvedValue([
        { id: 'meal-x', meal_type: 'SNACK', description: 'whey', calories: 120, created_at: new Date('2026-05-12T19:00:00Z') },
      ]);

      await service.editMeal('phone-1', 'corrige o lanche das 9h', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não achei lanche às 09:00');
      expect(message).toContain('corrigir');
    });

    it('keeps the original meal_type when AI re-extraction returns null', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({
          description: 'frango grelhado',
          calories: 200, protein: 37, carbs: 0, fat: 4,
          meal_type: null,
        }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);

      await service.editMeal('phone-1', 'corrige o almoço pra frango grelhado', 'jid-1');

      expect(updateById).toHaveBeenCalledWith('meal-1', expect.objectContaining({ meal_type: 'LUNCH' }));
    });

    it('forwards re-extraction clarification without updating', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({ needs_clarification: 'Me passa a quantidade 🤔' }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);

      await service.editMeal('phone-1', 'corrige o almoço pra arroz', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('jid-1', 'Me passa a quantidade 🤔');
    });

    it('sends VAGUE_EDIT_MESSAGE when the new description is identical to the original', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({
          description: 'arroz e frango',
          calories: 760, protein: 46, carbs: 50, fat: 5, meal_type: 'LUNCH',
        }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);

      await service.editMeal('phone-1', 'corrige meu almoço', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não entendi o que você quer mudar');
    });

    it('sends a friendly fallback when AI re-extraction returns invalid JSON', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce('not json');
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);

      await service.editMeal('phone-1', 'corrige', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui entender');
    });

    it('sends a technical-error message when the update throws and does NOT confirm', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({
          description: 'carne', calories: 200, protein: 30, carbs: 0, fat: 8, meal_type: 'LUNCH',
        }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);
      updateById.mockRejectedValueOnce(new Error('DB down'));

      await service.editMeal('phone-1', 'corrige o almoço pra carne', 'jid-1');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('problema técnico');
      expect(message).not.toContain('✏️');
    });
  });

  describe('editMeal (USE_LOCAL_CALCULATOR=true)', () => {
    beforeEach(() => {
      configGet.mockReturnValue('true');
    });

    const refReply = (overrides: Partial<{ meal_type: string; time: string | null; days_offset: number }> = {}) =>
      JSON.stringify({ meal_type: 'LUNCH', time: null, days_offset: 0, ...overrides });
    const lunchMeal = (overrides: Partial<{ id: string; description: string; calories: number; created_at: Date }> = {}) => ({
      id: 'meal-1',
      meal_type: 'LUNCH',
      description: 'arroz e frango',
      calories: 750,
      created_at: new Date('2026-05-12T15:00:00Z'),
      ...overrides,
    });

    it('parses corrected list, recalculates and updates the target meal', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({
          foods: [{ food: 'carne moída', quantity: 100, unit: 'g' }, { food: 'salada', quantity: 1, unit: 'porcao' }],
          meal_type: null,
        }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 255, protein: 23, carbs: 5, fat: 15 },
        matched: [{}, {}],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.editMeal('phone-1', 'corrige meu almoço pra carne moída e salada', 'jid-1');

      expect(updateById).toHaveBeenCalledTimes(1);
      expect(updateById).toHaveBeenCalledWith('meal-1', {
        meal_type: 'LUNCH',
        description: '100 carne moída, 1 salada',
        calories: 255,
        protein: 23,
        carbs: 5,
        fat: 15,
      });
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Atualizei');
    });

    it('replies with calc error when all items failed', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({
          foods: [{ food: 'biribiri', quantity: 1, unit: 'unidade' }],
          meal_type: null,
        }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        matched: [],
        unmatched: [{ input: { food: 'biribiri', quantity: 1, unit: 'unidade' }, reason: 'food_not_found' }],
        estimated: [],
        failed: [{ input: { food: 'biribiri', quantity: 1, unit: 'unidade' }, reason: 'unknown_food' }],
      });

      await service.editMeal('phone-1', 'corrige o almoço pra biribiri', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui calcular');
    });

    it('forwards parser clarification on edit without updating', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat
        .mockResolvedValueOnce(refReply({ meal_type: 'LUNCH' }))
        .mockResolvedValueOnce(JSON.stringify({ needs_clarification: 'qual quantidade?' }));
      findDailyByUserAndType.mockResolvedValue([lunchMeal()]);

      await service.editMeal('phone-1', 'corrige o almoço pra arroz', 'jid-1');

      expect(updateById).not.toHaveBeenCalled();
      expect(calculateWithFallback).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('jid-1', 'qual quantidade?');
    });

    it('does NOT consult the parser when no match is found', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValueOnce(refReply({ meal_type: 'DINNER' }));
      findDailyByUserAndType.mockResolvedValue([]);

      await service.editMeal('phone-1', 'corrige o jantar', 'jid-1');

      expect(chat).toHaveBeenCalledTimes(1);
      expect(calculateWithFallback).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não vi nenhum Jantar');
    });
  });

  describe('register (USE_LOCAL_CALCULATOR=true)', () => {
    beforeEach(() => {
      configGet.mockReturnValue('true');
    });

    it('parses foods, runs local calc and persists', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'ovo', quantity: 2, unit: 'unidade' }],
        meal_type: 'BREAKFAST',
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 143, protein: 13, carbs: 1, fat: 10 },
        matched: [{ food: { id: 'ovo' } }],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.register('5511999', 'comi 2 ovos no café', '5511999@s.whatsapp.net');

      expect(chat).toHaveBeenCalledTimes(1);
      expect(calculateWithFallback).toHaveBeenCalledWith([{ food: 'ovo', quantity: 2, unit: 'unidade' }]);
      expect(create).toHaveBeenCalledWith({
        user_id: 'user-1',
        meal_type: 'BREAKFAST',
        description: '2 ovos no café',
        calories: 143,
        protein: 13,
        carbs: 1,
        fat: 10,
      });
      expect(sendText).toHaveBeenCalledTimes(1);
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Café');
      expect(message).toContain('143kcal');
    });

    it('strips meal verbs from description (option A)', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'lanche gourmet', quantity: 1, unit: 'unidade' }],
        meal_type: 'DINNER',
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 700, protein: 40, carbs: 30, fat: 35 },
        matched: [{ food: { id: 'lanche' } }],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.register('5511999', 'eu jantei um lanche gourmet', '5511999@s.whatsapp.net');

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        description: 'um lanche gourmet',
      }));
    });

    it('falls back to time-based meal_type when parser returns null', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-09T15:30:00Z'));
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'banana', quantity: 1, unit: 'unidade' }],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 89, protein: 1, carbs: 23, fat: 0.3 },
        matched: [{ food: { id: 'banana' } }],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.register('5511999', 'comi 1 banana', '5511999@s.whatsapp.net');

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ meal_type: 'LUNCH' }));
      jest.useRealTimers();
    });

    it('forwards parser clarification to user without persisting', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({ needs_clarification: 'Me manda de novo com as quantidades' }));

      await service.register('5511999', 'almocei arroz e frango', '5511999@s.whatsapp.net');

      expect(calculateWithFallback).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('5511999@s.whatsapp.net', 'Me manda de novo com as quantidades');
    });

    it('replies with friendly error when parser fails', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockRejectedValue(new Error('rate limit'));

      await service.register('5511999', 'comi algo', '5511999@s.whatsapp.net');

      expect(calculateWithFallback).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui entender');
    });

    it('replies with "não consegui calcular" when ALL items failed', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'biribiri', quantity: 1, unit: 'unidade' }],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        matched: [],
        unmatched: [{ input: { food: 'biribiri', quantity: 1, unit: 'unidade' }, reason: 'food_not_found' }],
        estimated: [],
        failed: [{ input: { food: 'biribiri', quantity: 1, unit: 'unidade' }, reason: 'unknown_food' }],
      });

      await service.register('5511999', 'comi 1 biribiri', '5511999@s.whatsapp.net');

      expect(create).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui calcular');
    });

    it('persists when some items are estimated (cache/ai fallback)', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [
          { food: 'ovo', quantity: 2, unit: 'unidade' },
          { food: 'acarajé', quantity: 1, unit: 'unidade' },
        ],
        meal_type: 'LUNCH',
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 423, protein: 21, carbs: 26, fat: 28 },
        matched: [{ food: { id: 'ovo' } }],
        unmatched: [{ input: { food: 'acarajé', quantity: 1, unit: 'unidade' }, reason: 'food_not_found' }],
        estimated: [{ input: { food: 'acarajé', quantity: 1, unit: 'unidade' }, source: 'fresh', estimate_per_unit: {} as never, macros_contribution: { calories: 280, protein: 8, carbs: 25, fat: 18 } }],
        failed: [],
      });

      await service.register('5511999', 'comi 2 ovos e 1 acarajé', '5511999@s.whatsapp.net');

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        calories: 423,
        meal_type: 'LUNCH',
      }));
    });

    it('replies with technical error when DB create throws', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'ovo', quantity: 1, unit: 'unidade' }],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 72, protein: 6, carbs: 0, fat: 5 },
        matched: [{ food: { id: 'ovo' } }],
        unmatched: [],
        estimated: [],
        failed: [],
      });
      create.mockRejectedValue(new Error('DB down'));

      await service.register('5511999', 'comi 1 ovo', '5511999@s.whatsapp.net');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('problema técnico');
    });

    it('does NOT call the legacy MEAL_EXTRACTION_PROMPT path', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'banana', quantity: 1, unit: 'unidade' }],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 89, protein: 1, carbs: 23, fat: 0.3 },
        matched: [{}],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.register('5511999', 'comi 1 banana', '5511999@s.whatsapp.net');

      const [messages, opts] = chat.mock.calls[0];
      expect(messages).toEqual([{ role: 'user', content: 'comi 1 banana' }]);
      expect(opts.systemPrompt.toLowerCase()).toContain('parser');
    });
  });

  describe('editLast (USE_LOCAL_CALCULATOR=true)', () => {
    beforeEach(() => {
      configGet.mockReturnValue('true');
    });

    it('replies with EMPTY_EDIT_MESSAGE when there is no last meal', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue(null);

      await service.editLast('5511999', 'era 1 ovo', '5511999@s.whatsapp.net');

      expect(chat).not.toHaveBeenCalled();
      expect(calculateWithFallback).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
    });

    it('parses corrected list, recalculates and updates with describeFromFoods', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: '2 ovos e arroz', calories: 0 });
      chat.mockResolvedValue(JSON.stringify({
        foods: [
          { food: 'ovo', quantity: 1, unit: 'unidade' },
          { food: 'arroz', quantity: 4, unit: 'colher' },
        ],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 232, protein: 9, carbs: 37, fat: 5 },
        matched: [{}, {}],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.editLast('5511999', 'era 1 ovo, não 2', '5511999@s.whatsapp.net');

      expect(updateById).toHaveBeenCalledWith('meal-42', {
        meal_type: 'LUNCH',
        description: '1 ovo, 4 arroz',
        calories: 232,
        protein: 9,
        carbs: 37,
        fat: 5,
      });
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Atualizei');
    });

    it('forwards parser clarification on edit without updating', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz', calories: 0 });
      chat.mockResolvedValue(JSON.stringify({ needs_clarification: 'qual quantidade?' }));

      await service.editLast('5511999', 'era arroz', '5511999@s.whatsapp.net');

      expect(updateById).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledWith('5511999@s.whatsapp.net', 'qual quantidade?');
    });

    it('replies with error when parser fails on edit', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz', calories: 0 });
      chat.mockRejectedValue(new Error('boom'));

      await service.editLast('5511999', 'era diferente', '5511999@s.whatsapp.net');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('correção');
    });

    it('replies with calc error when all items failed on edit', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'LUNCH', description: 'arroz', calories: 0 });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'biribiri', quantity: 1, unit: 'unidade' }],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        matched: [],
        unmatched: [{ input: { food: 'biribiri', quantity: 1, unit: 'unidade' }, reason: 'food_not_found' }],
        estimated: [],
        failed: [{ input: { food: 'biribiri', quantity: 1, unit: 'unidade' }, reason: 'unknown_food' }],
      });

      await service.editLast('5511999', 'era biribiri', '5511999@s.whatsapp.net');

      expect(updateById).not.toHaveBeenCalled();
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Não consegui calcular');
    });

    it('preserves last meal mealType when parser returns null', async () => {
      findByPhone.mockResolvedValue({ id: 'user-1' });
      findLastByUser.mockResolvedValue({ id: 'meal-42', meal_type: 'DINNER', description: 'frango', calories: 0 });
      chat.mockResolvedValue(JSON.stringify({
        foods: [{ food: 'frango', quantity: 1, unit: 'unidade' }],
        meal_type: null,
      }));
      calculateWithFallback.mockResolvedValue({
        totals: { calories: 198, protein: 37, carbs: 0, fat: 4 },
        matched: [{}],
        unmatched: [],
        estimated: [],
        failed: [],
      });

      await service.editLast('5511999', 'so frango', '5511999@s.whatsapp.net');

      expect(updateById).toHaveBeenCalledWith('meal-42', expect.objectContaining({ meal_type: 'DINNER' }));
    });
  });
});
