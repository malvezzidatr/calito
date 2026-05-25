import { FoodEstimator } from '../food.estimator';
import { AiService } from '../../ai/ai.service';
import { EstimatedFoodsRepository } from '../estimated-foods.repository';
import { UnmatchedItem } from '../utils/food.calculator';

type RepoMock = {
  findByNameAndUnit: jest.Mock;
  upsert: jest.Mock;
};

type AiMock = { chat: jest.Mock };

function makeUnmatched(food: string, quantity: number, unit: string): UnmatchedItem {
  return { input: { food, quantity, unit }, reason: 'food_not_found' };
}

describe('FoodEstimator', () => {
  let ai:   AiMock;
  let repo: RepoMock;
  let estimator: FoodEstimator;

  beforeEach(() => {
    ai   = { chat: jest.fn() };
    repo = { findByNameAndUnit: jest.fn(), upsert: jest.fn().mockResolvedValue(undefined) };
    estimator = new FoodEstimator(ai as unknown as AiService, repo as unknown as EstimatedFoodsRepository);
  });

  describe('empty input', () => {
    it('returns empty arrays when unmatched is empty', async () => {
      const result = await estimator.estimate([]);
      expect(result.estimated).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(ai.chat).not.toHaveBeenCalled();
      expect(repo.findByNameAndUnit).not.toHaveBeenCalled();
    });
  });

  describe('cache hit', () => {
    it('uses cached estimate without calling AI', async () => {
      repo.findByNameAndUnit.mockResolvedValueOnce({
        food_name: 'acaraje', unit: 'unidade', kcal: 280, protein: 8, carbs: 25, fat: 18,
      });

      const result = await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      expect(ai.chat).not.toHaveBeenCalled();
      expect(result.estimated).toHaveLength(1);
      expect(result.estimated[0].source).toBe('cache');
      expect(result.estimated[0].macros_contribution).toEqual({ kcal: 280, p: 8, c: 25, g: 18 });
    });

    it('scales macros by quantity on cache hit', async () => {
      repo.findByNameAndUnit.mockResolvedValueOnce({
        food_name: 'acaraje', unit: 'unidade', kcal: 280, protein: 8, carbs: 25, fat: 18,
      });

      const result = await estimator.estimate([makeUnmatched('acarajé', 3, 'unidade')]);

      expect(result.estimated[0].macros_contribution).toEqual({ kcal: 840, p: 24, c: 75, g: 54 });
    });

    it('uses normalized food name for cache lookup (accent strip)', async () => {
      repo.findByNameAndUnit.mockResolvedValueOnce({
        food_name: 'acaraje', unit: 'unidade', kcal: 280, protein: 8, carbs: 25, fat: 18,
      });

      await estimator.estimate([makeUnmatched('ACARAJÉ', 1, 'unidade')]);

      expect(repo.findByNameAndUnit).toHaveBeenCalledWith('acaraje', 'unidade');
    });

    it('treats cached-zero as unknown_food failure', async () => {
      repo.findByNameAndUnit.mockResolvedValueOnce({
        food_name: 'foobar', unit: 'unidade', kcal: 0, protein: 0, carbs: 0, fat: 0,
      });

      const result = await estimator.estimate([makeUnmatched('foobar', 1, 'unidade')]);

      expect(result.estimated).toEqual([]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('unknown_food');
      expect(ai.chat).not.toHaveBeenCalled();
    });
  });

  describe('cache miss → fresh AI estimate', () => {
    beforeEach(() => {
      repo.findByNameAndUnit.mockResolvedValue(null);
    });

    it('calls AI when cache misses and stores result', async () => {
      ai.chat.mockResolvedValueOnce(JSON.stringify({ kcal: 280, protein: 8, carbs: 25, fat: 18 }));

      const result = await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      expect(ai.chat).toHaveBeenCalledTimes(1);
      expect(repo.upsert).toHaveBeenCalledWith({
        food_name: 'acaraje', unit: 'unidade', kcal: 280, protein: 8, carbs: 25, fat: 18,
      });
      expect(result.estimated[0].source).toBe('fresh');
    });

    it('passes 8b model + structured user message to AI', async () => {
      ai.chat.mockResolvedValueOnce(JSON.stringify({ kcal: 280, protein: 8, carbs: 25, fat: 18 }));

      await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      const [messages, opts] = ai.chat.mock.calls[0];
      expect(messages).toEqual([{ role: 'user', content: 'acarajé | 1 | unidade' }]);
      expect(opts.model).toBe('llama-3.1-8b-instant');
      expect(opts.responseFormat).toBe('json');
    });

    it('marks as unknown_food when AI returns all-zero', async () => {
      ai.chat.mockResolvedValueOnce(JSON.stringify({ kcal: 0, protein: 0, carbs: 0, fat: 0 }));

      const result = await estimator.estimate([makeUnmatched('biribiri', 1, 'unidade')]);

      expect(result.estimated).toEqual([]);
      expect(result.failed[0].reason).toBe('unknown_food');
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('marks as ai_error when AI throws', async () => {
      ai.chat.mockRejectedValueOnce(new Error('rate limit'));

      const result = await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      expect(result.estimated).toEqual([]);
      expect(result.failed[0].reason).toBe('ai_error');
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('marks as ai_error when AI returns invalid JSON', async () => {
      ai.chat.mockResolvedValueOnce('not json');

      const result = await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      expect(result.failed[0].reason).toBe('ai_error');
    });

    it('marks as ai_error when AI returns out-of-range values', async () => {
      ai.chat.mockResolvedValueOnce(JSON.stringify({ kcal: 99999, protein: 0, carbs: 0, fat: 0 }));

      const result = await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      expect(result.failed[0].reason).toBe('ai_error');
    });

    it('keeps going when cache upsert fails (warning only)', async () => {
      ai.chat.mockResolvedValueOnce(JSON.stringify({ kcal: 280, protein: 8, carbs: 25, fat: 18 }));
      repo.upsert.mockRejectedValueOnce(new Error('db down'));

      const result = await estimator.estimate([makeUnmatched('acarajé', 1, 'unidade')]);

      expect(result.estimated).toHaveLength(1);
      expect(result.estimated[0].source).toBe('fresh');
    });
  });

  describe('limit enforcement', () => {
    beforeEach(() => {
      repo.findByNameAndUnit.mockResolvedValue(null);
      ai.chat.mockResolvedValue(JSON.stringify({ kcal: 100, protein: 5, carbs: 10, fat: 3 }));
    });

    it('processes up to 5 items, marks the rest as limit_exceeded', async () => {
      const items = Array.from({ length: 8 }, (_, i) => makeUnmatched(`food${i}`, 1, 'unidade'));

      const result = await estimator.estimate(items);

      expect(result.estimated).toHaveLength(5);
      expect(result.failed).toHaveLength(3);
      expect(result.failed.every((f) => f.reason === 'limit_exceeded')).toBe(true);
      expect(ai.chat).toHaveBeenCalledTimes(5);
    });
  });

  describe('mixed batch', () => {
    it('combines cache hit + fresh + error in a single call', async () => {
      repo.findByNameAndUnit
        .mockResolvedValueOnce({ food_name: 'item1', unit: 'unidade', kcal: 100, protein: 5, carbs: 10, fat: 3 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      ai.chat
        .mockResolvedValueOnce(JSON.stringify({ kcal: 200, protein: 10, carbs: 20, fat: 5 }))
        .mockRejectedValueOnce(new Error('boom'));

      const result = await estimator.estimate([
        makeUnmatched('item1', 1, 'unidade'),
        makeUnmatched('item2', 1, 'unidade'),
        makeUnmatched('item3', 1, 'unidade'),
      ]);

      expect(result.estimated).toHaveLength(2);
      expect(result.estimated[0].source).toBe('cache');
      expect(result.estimated[1].source).toBe('fresh');
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('ai_error');
    });
  });
});
