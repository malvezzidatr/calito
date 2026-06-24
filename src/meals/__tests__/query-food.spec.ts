jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MealsService } from '../meals.service';
import { MealsRepository } from '../meals.repository';
import { AiService } from '../../ai/ai.service';
import { UsersRepository } from '../../users/users.repository';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { FoodsService } from '../../foods/foods.service';
import { ParsedMessagesRepository } from '../parsed-messages.repository';
import { FOOD_LOOKUP_CALC_FAILED, FOOD_LOOKUP_PARSE_FAILED } from '../messages/meals.messages';

describe('MealsService.queryFood', () => {
  let service: MealsService;
  let chat: jest.Mock;
  let sendText: jest.Mock;
  let calculateWithFallback: jest.Mock;

  beforeEach(async () => {
    chat = jest.fn();
    sendText = jest.fn().mockResolvedValue(undefined);
    calculateWithFallback = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: AiService,                useValue: { chat } },
        { provide: UsersRepository,          useValue: { findByPhone: jest.fn() } },
        { provide: MealsRepository,          useValue: { create: jest.fn(), sumDailyByUser: jest.fn(), findDailyByUser: jest.fn(), findInRangeByUser: jest.fn(), findLastByUser: jest.fn(), findDailyByUserAndType: jest.fn(), deleteById: jest.fn(), updateById: jest.fn() } },
        { provide: WhatsappService,          useValue: { sendText } },
        { provide: FoodsService,             useValue: { calculateWithFallback } },
        { provide: ConfigService,            useValue: { get: jest.fn().mockReturnValue('false') } },
        { provide: ParsedMessagesRepository, useValue: { findByText: jest.fn().mockResolvedValue(null), upsert: jest.fn() } },
      ],
    }).compile();

    service = module.get(MealsService);
  });

  it('returns nutrition facts without persisting when food is recognized', async () => {
    chat.mockResolvedValue(JSON.stringify({
      foods: [{ food: 'banana', quantity: 1, unit: 'unidade' }],
      meal_type: null,
    }));
    calculateWithFallback.mockResolvedValue({
      totals:    { calories: 89, protein: 1, carbs: 23, fat: 0 },
      matched:   [{ food: 'banana' }],
      unmatched: [],
      estimated: [],
      failed:    [],
    });

    await service.queryFood('calorias de uma banana', 'jid-1');

    expect(calculateWithFallback).toHaveBeenCalledTimes(1);
    const [, message] = sendText.mock.calls[0];
    expect(message).toContain('banana');
    expect(message).toContain('89 kcal');
    expect(message).toContain('23g');
  });

  it('sends parse-failed message when AI returns null', async () => {
    chat.mockRejectedValue(new Error('network'));

    await service.queryFood('algo', 'jid-1');

    expect(calculateWithFallback).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith('jid-1', FOOD_LOOKUP_PARSE_FAILED);
  });

  it('sends calc-failed message when no items are matched or estimated', async () => {
    chat.mockResolvedValue(JSON.stringify({
      foods: [{ food: 'xyzzy', quantity: 100, unit: 'g' }],
      meal_type: null,
    }));

    calculateWithFallback.mockResolvedValue({
      totals:    { calories: 0, protein: 0, carbs: 0, fat: 0 },
      matched:   [],
      unmatched: [{ food: 'xyzzy' }],
      estimated: [],
      failed:    [{ food: 'xyzzy' }],
    });

    await service.queryFood('calorias de xyzzy', 'jid-1');

    expect(sendText).toHaveBeenCalledWith('jid-1', FOOD_LOOKUP_CALC_FAILED);
  });

  it('does not call mealsRepository.create', async () => {
    chat.mockResolvedValue(JSON.stringify({
      foods: [{ food: 'ovo', quantity: 2, unit: 'unidade' }],
      meal_type: null,
    }));
    calculateWithFallback.mockResolvedValue({
      totals:    { calories: 140, protein: 12, carbs: 1, fat: 10 },
      matched:   [{ food: 'ovo' }],
      unmatched: [],
      estimated: [],
      failed:    [],
    });

    const createSpy = jest.spyOn((service as any).mealsRepository, 'create');

    await service.queryFood('quantas calorias tem 2 ovos', 'jid-1');

    expect(createSpy).not.toHaveBeenCalled();
  });
});
