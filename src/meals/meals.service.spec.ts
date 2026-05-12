jest.mock('../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test } from '@nestjs/testing';
import { MealsService } from './meals.service';
import { formatMealConfirmation } from './meal.format';
import { pickPraise } from './meal.praise';
import { MealsRepository } from './meals.repository';
import { AiService } from '../ai/ai.service';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';

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
