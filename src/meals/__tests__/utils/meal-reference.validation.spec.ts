import { validateMealReference, InvalidMealReferenceError } from '../../utils/meal-reference.validation';
import {
  MealReferenceExtraction,
  MealReferenceResult,
  isMealReferenceClarification,
} from '../../utils/meal-reference.prompt';

function asExtraction(result: MealReferenceResult): MealReferenceExtraction {
  if (isMealReferenceClarification(result)) {
    throw new Error(`Expected MealReferenceExtraction, got clarification: ${result.needs_clarification}`);
  }
  return result;
}

describe('validateMealReference', () => {
  describe('happy path', () => {
    it('accepts meal_type with null time (days_offset defaults to 0)', () => {
      const result = asExtraction(validateMealReference({ meal_type: 'LUNCH', time: null }));
      expect(result).toEqual({ meal_type: 'LUNCH', time: null, days_offset: 0 });
    });

    it('accepts meal_type with valid HH:MM time', () => {
      const result = asExtraction(validateMealReference({ meal_type: 'SNACK', time: '16:00' }));
      expect(result).toEqual({ meal_type: 'SNACK', time: '16:00', days_offset: 0 });
    });

    it.each([0, 1, 2, 7, 30, 90])('accepts days_offset %i', (offset) => {
      const result = asExtraction(validateMealReference({ meal_type: 'LUNCH', time: null, days_offset: offset }));
      expect(result.days_offset).toBe(offset);
    });

    it.each([
      ['negative', -1],
      ['too big', 91],
      ['float', 1.5],
      ['string', '1'],
    ])('rejects invalid days_offset %s', (_label, offset) => {
      expect(() => validateMealReference({ meal_type: 'LUNCH', time: null, days_offset: offset })).toThrow(/days_offset/);
    });

    it('treats missing/null days_offset as 0', () => {
      const r1 = asExtraction(validateMealReference({ meal_type: 'LUNCH', time: null }));
      const r2 = asExtraction(validateMealReference({ meal_type: 'LUNCH', time: null, days_offset: null }));
      expect(r1.days_offset).toBe(0);
      expect(r2.days_offset).toBe(0);
    });

    it.each(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])('accepts each meal_type %s', (mt) => {
      expect(() => validateMealReference({ meal_type: mt, time: null })).not.toThrow();
    });

    it.each([
      '00:00', '08:15', '12:30', '16:00', '19:45', '23:59',
    ])('accepts valid time %s', (time) => {
      expect(() => validateMealReference({ meal_type: 'LUNCH', time })).not.toThrow();
    });

    it('treats missing time field as null', () => {
      const result = asExtraction(validateMealReference({ meal_type: 'BREAKFAST' }));
      expect(result.time).toBeNull();
    });
  });

  describe('clarification path', () => {
    it('returns clarification when needs_clarification is non-empty string', () => {
      const result = validateMealReference({ needs_clarification: 'Qual refeição?' });
      expect(result).toEqual({ needs_clarification: 'Qual refeição?' });
    });

    it('trims whitespace from clarification', () => {
      const result = validateMealReference({ needs_clarification: '  Qual refeição?  ' });
      expect(result).toEqual({ needs_clarification: 'Qual refeição?' });
    });

    it('clarification wins when both clarification and meal_type are present', () => {
      const result = validateMealReference({
        meal_type: 'LUNCH', time: null,
        needs_clarification: 'Qual?',
      });
      expect(result).toEqual({ needs_clarification: 'Qual?' });
    });

    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['null', null],
      ['number', 42],
    ])('ignores %s clarification and validates extraction normally', (_label, needs_clarification) => {
      const result = validateMealReference({ meal_type: 'LUNCH', time: null, needs_clarification });
      expect(isMealReferenceClarification(result)).toBe(false);
    });
  });

  describe('payload shape', () => {
    it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
      expect(() => validateMealReference(raw)).toThrow(InvalidMealReferenceError);
    });
  });

  describe('meal_type validation', () => {
    it.each([
      ['lowercase lunch', 'lunch'],
      ['portuguese', 'almoço'],
      ['random string', 'foo'],
      ['number', 1],
      ['null', null],
      ['undefined', undefined],
    ])('rejects %s (%p)', (_label, meal_type) => {
      expect(() => validateMealReference({ meal_type, time: null })).toThrow(/meal_type/);
    });
  });

  describe('time validation', () => {
    it.each([
      ['24:00 (hour out of range)', '24:00'],
      ['25:30', '25:30'],
      ['12:60 (minute out of range)', '12:60'],
      ['12:99', '12:99'],
      ['no minutes', '12'],
      ['no leading zero', '8:30'],
      ['with seconds', '12:30:00'],
      ['with am/pm', '12:30 PM'],
      ['number', 1230],
      ['empty string', ''],
    ])('rejects invalid time %s (%p)', (_label, time) => {
      expect(() => validateMealReference({ meal_type: 'LUNCH', time })).toThrow(/time/);
    });
  });
});
