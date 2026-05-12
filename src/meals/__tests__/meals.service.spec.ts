jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test } from '@nestjs/testing';
import { MealsService } from '../meals.service';
import { formatMealConfirmation } from '../meal.format';
import { pickPraise } from '../meal.praise';
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
  let sendText: jest.Mock;

  beforeEach(async () => {
    chat = jest.fn();
    findByPhone = jest.fn();
    create = jest.fn().mockResolvedValue(undefined);
    sumDailyByUser = jest.fn().mockResolvedValue({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    sendText = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: AiService,        useValue: { chat } },
        { provide: UsersRepository,  useValue: { findByPhone } },
        { provide: MealsRepository,  useValue: { create, sumDailyByUser } },
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
});

describe('formatMealConfirmation', () => {
  const sampleExtraction = {
    description: 'arroz e frango',
    calories: 650,
    protein: 45,
    carbs: 75,
    fat: 12,
    meal_type: 'LUNCH' as const,
  };

  it('formats lunch with calories and macros', () => {
    const result = formatMealConfirmation('LUNCH', sampleExtraction, 'Mandou bem!');
    expect(result).toContain('Almoço');
    expect(result).toContain('650kcal');
    expect(result).toContain('P: 45g');
    expect(result).toContain('C: 75g');
    expect(result).toContain('G: 12g');
    expect(result).toContain('Mandou bem!');
  });

  it.each([
    ['BREAKFAST', 'Café'],
    ['DINNER',    'Jantar'],
    ['SNACK',     'Lanche'],
  ] as const)('uses label "%s" for meal_type %s', (mealType, label) => {
    const result = formatMealConfirmation(mealType, sampleExtraction, 'praise');
    expect(result).toContain(label);
  });
});

describe('pickPraise', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('picks from PROTEIN pool when protein contributes >= 40% of calories', () => {
    const result = pickPraise({
      description: 'whey com leite',
      calories: 200,
      protein: 30,
      carbs: 10,
      fat: 4,
      meal_type: null,
    });
    expect(result).toMatch(/proteína|músculos|proteica/i);
  });

  it('picks from CARB pool when carbs contribute >= 55% of calories', () => {
    const result = pickPraise({
      description: 'pão e suco',
      calories: 300,
      protein: 5,
      carbs: 50,
      fat: 4,
      meal_type: null,
    });
    expect(result).toMatch(/energia|carboidrato|treino|combustível/i);
  });

  it('picks from HEAVY pool when calories >= 700 regardless of macros', () => {
    const result = pickPraise({
      description: 'whopper e coca',
      calories: 920,
      protein: 35,
      carbs: 70,
      fat: 45,
      meal_type: null,
    });
    expect(result).toMatch(/anotado|registrei|registrado|reforçado|densa|cheia|fica de olho/i);
  });

  it('picks from BALANCED pool when no macro dominates', () => {
    const result = pickPraise({
      description: 'arroz e frango',
      calories: 650,
      protein: 45,
      carbs: 75,
      fat: 12,
      meal_type: null,
    });
    expect(result).toMatch(/equilibrada|distribuídos|combinação|lugar|anotado/i);
  });

  it('falls back to BALANCED when calories is 0 (avoids divide-by-zero)', () => {
    const result = pickPraise({
      description: 'algo estranho',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meal_type: null,
    });
    expect(result).toMatch(/equilibrada|distribuídos|combinação|lugar|anotado/i);
  });
});
