import { validateNutritionistGoals } from '../../utils/nutritionist-goals.validation';
import { InvalidNutritionistGoalsError } from '../../exceptions/onboarding.errors';
import {
  NutritionistGoalsExtraction,
  NutritionistGoalsResult,
  isNutritionistGoalsClarification,
} from '../../utils/nutritionist-goals.prompt';

const validRaw = { calorie: 2000, protein: 150, carbs: 200, fat: 60 };

function asExtraction(result: NutritionistGoalsResult): NutritionistGoalsExtraction {
  if (isNutritionistGoalsClarification(result)) {
    throw new Error(`Expected NutritionistGoalsExtraction, got clarification: ${result.needs_clarification}`);
  }
  return result;
}

describe('validateNutritionistGoals', () => {
  describe('happy path', () => {
    it('accepts a fully-formed extraction', () => {
      expect(validateNutritionistGoals(validRaw)).toEqual(validRaw);
    });

    it('rounds non-integer values', () => {
      const result = asExtraction(validateNutritionistGoals({ calorie: 1999.6, protein: 150.4, carbs: 200, fat: 60 }));
      expect(result.calorie).toBe(2000);
      expect(result.protein).toBe(150);
    });

    it('accepts values at range boundaries', () => {
      expect(() => validateNutritionistGoals({ calorie: 800, protein: 30, carbs: 30, fat: 20 })).not.toThrow();
      expect(() => validateNutritionistGoals({ calorie: 5000, protein: 400, carbs: 700, fat: 300 })).not.toThrow();
    });
  });

  describe('clarification path', () => {
    it('returns clarification when needs_clarification is a non-empty string', () => {
      const result = validateNutritionistGoals({ needs_clarification: 'Me manda os 4 valores' });
      expect(result).toEqual({ needs_clarification: 'Me manda os 4 valores' });
    });

    it('trims surrounding whitespace from clarification', () => {
      const result = validateNutritionistGoals({ needs_clarification: '  Me manda  ' });
      expect(result).toEqual({ needs_clarification: 'Me manda' });
    });

    it('clarification wins when both clarification and extraction fields are present', () => {
      const result = validateNutritionistGoals({ ...validRaw, needs_clarification: 'Me manda os 4 valores' });
      expect(result).toEqual({ needs_clarification: 'Me manda os 4 valores' });
    });

    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['null', null],
      ['number', 42],
    ])('ignores %s clarification and validates normally', (_label, needs_clarification) => {
      const result = validateNutritionistGoals({ ...validRaw, needs_clarification });
      expect(isNutritionistGoalsClarification(result)).toBe(false);
    });
  });

  describe('payload shape', () => {
    it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
      expect(() => validateNutritionistGoals(raw)).toThrow(InvalidNutritionistGoalsError);
    });
  });

  describe('range validation', () => {
    it.each([
      ['calorie below min', { calorie: 500 }],
      ['calorie above max', { calorie: 8000 }],
      ['protein below min', { protein: 10 }],
      ['protein above max', { protein: 500 }],
      ['carbs below min', { carbs: 10 }],
      ['carbs above max', { carbs: 1000 }],
      ['fat below min', { fat: 5 }],
      ['fat above max', { fat: 500 }],
    ])('rejects %s', (_label, override) => {
      expect(() => validateNutritionistGoals({ ...validRaw, ...override })).toThrow(InvalidNutritionistGoalsError);
    });

    it.each(['calorie', 'protein', 'carbs', 'fat'] as const)('rejects negative %s', (field) => {
      expect(() => validateNutritionistGoals({ ...validRaw, [field]: -1 })).toThrow(new RegExp(field));
    });

    it.each(['calorie', 'protein', 'carbs', 'fat'] as const)('rejects NaN %s', (field) => {
      expect(() => validateNutritionistGoals({ ...validRaw, [field]: NaN })).toThrow(new RegExp(field));
    });

    it.each(['calorie', 'protein', 'carbs', 'fat'] as const)('rejects Infinity %s', (field) => {
      expect(() => validateNutritionistGoals({ ...validRaw, [field]: Infinity })).toThrow(new RegExp(field));
    });

    it.each(['calorie', 'protein', 'carbs', 'fat'] as const)('rejects string %s', (field) => {
      expect(() => validateNutritionistGoals({ ...validRaw, [field]: '2000' })).toThrow(new RegExp(field));
    });

    it.each(['calorie', 'protein', 'carbs', 'fat'] as const)('rejects null %s', (field) => {
      expect(() => validateNutritionistGoals({ ...validRaw, [field]: null })).toThrow(new RegExp(field));
    });

    it.each(['calorie', 'protein', 'carbs', 'fat'] as const)('rejects missing %s', (field) => {
      const { [field]: _, ...withoutField } = validRaw;
      expect(() => validateNutritionistGoals(withoutField)).toThrow(new RegExp(field));
    });
  });
});
