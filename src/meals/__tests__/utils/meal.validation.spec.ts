import { validateMealExtraction, InvalidMealExtractionError } from '../../utils/meal.validation';
import { MealExtraction, MealExtractionResult, isMealClarification } from '../../utils/meal.prompt';

const validRaw = {
  description: 'arroz e frango',
  calories: 500,
  protein: 40,
  carbs: 50,
  fat: 10,
  meal_type: 'LUNCH',
};

function asExtraction(result: MealExtractionResult): MealExtraction {
  if (isMealClarification(result)) {
    throw new Error(`Expected MealExtraction, got clarification: ${result.needs_clarification}`);
  }
  return result;
}

describe('validateMealExtraction', () => {
  describe('happy path', () => {
    it('accepts a fully-formed extraction', () => {
      expect(validateMealExtraction(validRaw)).toEqual(validRaw);
    });

    it('accepts meal_type === null', () => {
      const result = asExtraction(validateMealExtraction({ ...validRaw, meal_type: null }));
      expect(result.meal_type).toBeNull();
    });

    it('accepts zero values for macros (user ate something with no protein etc)', () => {
      const result = asExtraction(validateMealExtraction({ ...validRaw, fat: 0, carbs: 0 }));
      expect(result.fat).toBe(0);
      expect(result.carbs).toBe(0);
    });

    it('trims surrounding whitespace from description', () => {
      const result = asExtraction(validateMealExtraction({ ...validRaw, description: '  arroz e frango  ' }));
      expect(result.description).toBe('arroz e frango');
    });

    it('accepts decimal values for macros', () => {
      const result = asExtraction(validateMealExtraction({ ...validRaw, protein: 24.5 }));
      expect(result.protein).toBe(24.5);
    });
  });

  describe('clarification path', () => {
    it('returns clarification when needs_clarification is a non-empty string', () => {
      const result = validateMealExtraction({ needs_clarification: 'Me passa as quantidades' });
      expect(result).toEqual({ needs_clarification: 'Me passa as quantidades' });
    });

    it('trims surrounding whitespace from clarification question', () => {
      const result = validateMealExtraction({ needs_clarification: '  Me passa as quantidades  ' });
      expect(result).toEqual({ needs_clarification: 'Me passa as quantidades' });
    });

    it('clarification wins when both clarification and extraction fields are present', () => {
      const result = validateMealExtraction({
        ...validRaw,
        needs_clarification: 'Me passa as quantidades',
      });
      expect(result).toEqual({ needs_clarification: 'Me passa as quantidades' });
    });

    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['null', null],
      ['number', 42],
    ])('ignores %s clarification and validates extraction normally', (_label, needs_clarification) => {
      const result = validateMealExtraction({ ...validRaw, needs_clarification });
      expect(isMealClarification(result)).toBe(false);
    });
  });

  describe('payload shape', () => {
    it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
      expect(() => validateMealExtraction(raw)).toThrow(InvalidMealExtractionError);
    });
  });

  describe('description', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['null', null],
      ['number', 42],
      ['undefined', undefined],
    ])('rejects %s', (_label, description) => {
      expect(() => validateMealExtraction({ ...validRaw, description })).toThrow(
        /description/,
      );
    });
  });

  describe('numeric fields', () => {
    it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects negative %s', (field) => {
      expect(() => validateMealExtraction({ ...validRaw, [field]: -1 })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects NaN %s', (field) => {
      expect(() => validateMealExtraction({ ...validRaw, [field]: NaN })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects Infinity %s', (field) => {
      expect(() => validateMealExtraction({ ...validRaw, [field]: Infinity })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects string %s', (field) => {
      expect(() => validateMealExtraction({ ...validRaw, [field]: '500' })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects null %s', (field) => {
      expect(() => validateMealExtraction({ ...validRaw, [field]: null })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects missing %s', (field) => {
      const { [field]: _, ...withoutField } = validRaw;
      expect(() => validateMealExtraction(withoutField)).toThrow(new RegExp(field));
    });
  });

  describe('meal_type', () => {
    it.each(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])('accepts valid enum value %p', (mt) => {
      expect(() => validateMealExtraction({ ...validRaw, meal_type: mt })).not.toThrow();
    });

    it.each([
      ['lowercase', 'lunch'],
      ['portuguese', 'almoço'],
      ['random string', 'foo'],
      ['number', 1],
      ['missing entirely', undefined],
    ])('rejects %s (%p)', (_label, mt) => {
      expect(() => validateMealExtraction({ ...validRaw, meal_type: mt })).toThrow(/meal_type/);
    });
  });
});
