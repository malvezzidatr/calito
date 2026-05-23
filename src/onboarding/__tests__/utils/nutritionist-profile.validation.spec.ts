import { validateNutritionistProfile, InvalidNutritionistProfileError } from '../../utils/nutritionist-profile.validation';
import {
  NutritionistProfileExtraction,
  NutritionistProfileResult,
  isNutritionistProfileClarification,
} from '../../utils/nutritionist-profile.prompt';

const validRaw = { weight: 70, height: 175, age: 30, gender: 'MALE' };

function asExtraction(result: NutritionistProfileResult): NutritionistProfileExtraction {
  if (isNutritionistProfileClarification(result)) {
    throw new Error(`Expected NutritionistProfileExtraction, got clarification: ${result.needs_clarification}`);
  }
  return result;
}

describe('validateNutritionistProfile', () => {
  describe('happy path', () => {
    it('accepts a fully-formed extraction', () => {
      expect(validateNutritionistProfile(validRaw)).toEqual(validRaw);
    });

    it('accepts FEMALE', () => {
      const result = asExtraction(validateNutritionistProfile({ ...validRaw, gender: 'FEMALE' }));
      expect(result.gender).toBe('FEMALE');
    });

    it('accepts decimal weight', () => {
      const result = asExtraction(validateNutritionistProfile({ ...validRaw, weight: 70.5 }));
      expect(result.weight).toBe(70.5);
    });

    it('rounds height to integer', () => {
      const result = asExtraction(validateNutritionistProfile({ ...validRaw, height: 175.4 }));
      expect(result.height).toBe(175);
    });

    it('accepts values at range boundaries', () => {
      expect(() => validateNutritionistProfile({ weight: 20, height: 100, age: 13, gender: 'MALE' })).not.toThrow();
      expect(() => validateNutritionistProfile({ weight: 350, height: 250, age: 90, gender: 'FEMALE' })).not.toThrow();
    });
  });

  describe('clarification path', () => {
    it('returns clarification when needs_clarification is non-empty string', () => {
      const result = validateNutritionistProfile({ needs_clarification: 'Faltam dados' });
      expect(result).toEqual({ needs_clarification: 'Faltam dados' });
    });

    it('trims whitespace from clarification', () => {
      const result = validateNutritionistProfile({ needs_clarification: '  Faltam dados  ' });
      expect(result).toEqual({ needs_clarification: 'Faltam dados' });
    });

    it('clarification wins when both present', () => {
      const result = validateNutritionistProfile({ ...validRaw, needs_clarification: 'Faltam dados' });
      expect(result).toEqual({ needs_clarification: 'Faltam dados' });
    });
  });

  describe('payload shape', () => {
    it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
      expect(() => validateNutritionistProfile(raw)).toThrow(InvalidNutritionistProfileError);
    });
  });

  describe('range validation', () => {
    it.each([
      ['weight below min', { weight: 10 }],
      ['weight above max', { weight: 500 }],
      ['height below min', { height: 50 }],
      ['height above max', { height: 300 }],
      ['age below min', { age: 10 }],
      ['age above max', { age: 100 }],
    ])('rejects %s', (_label, override) => {
      expect(() => validateNutritionistProfile({ ...validRaw, ...override })).toThrow(InvalidNutritionistProfileError);
    });

    it('rejects non-integer age', () => {
      expect(() => validateNutritionistProfile({ ...validRaw, age: 30.5 })).toThrow(/age/);
    });

    it.each(['weight', 'height', 'age'] as const)('rejects negative %s', (field) => {
      expect(() => validateNutritionistProfile({ ...validRaw, [field]: -1 })).toThrow(new RegExp(field));
    });

    it.each(['weight', 'height', 'age'] as const)('rejects NaN %s', (field) => {
      expect(() => validateNutritionistProfile({ ...validRaw, [field]: NaN })).toThrow(new RegExp(field));
    });

    it.each(['weight', 'height', 'age'] as const)('rejects string %s', (field) => {
      expect(() => validateNutritionistProfile({ ...validRaw, [field]: '70' })).toThrow(new RegExp(field));
    });

    it.each(['weight', 'height', 'age'] as const)('rejects null %s', (field) => {
      expect(() => validateNutritionistProfile({ ...validRaw, [field]: null })).toThrow(new RegExp(field));
    });

    it.each(['weight', 'height', 'age', 'gender'] as const)('rejects missing %s', (field) => {
      const { [field]: _, ...withoutField } = validRaw;
      expect(() => validateNutritionistProfile(withoutField)).toThrow(new RegExp(field));
    });
  });

  describe('gender validation', () => {
    it.each([
      ['lowercase male', 'male'],
      ['portuguese', 'masculino'],
      ['other', 'OTHER'],
      ['number', 1],
      ['null', null],
    ])('rejects %s (%p)', (_label, gender) => {
      expect(() => validateNutritionistProfile({ ...validRaw, gender })).toThrow(/gender/);
    });
  });
});
