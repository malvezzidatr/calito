import { validateFoodEstimate, isZeroEstimate, InvalidFoodEstimateError } from '../../utils/food.estimate.validation';

const valid = { calories: 280, protein: 8, carbs: 25, fat: 18 };

describe('validateFoodEstimate', () => {
  it('accepts a fully-formed estimate', () => {
    expect(validateFoodEstimate(valid)).toEqual(valid);
  });

  it('accepts all-zero estimate (signals "unknown food")', () => {
    expect(validateFoodEstimate({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toEqual({
      calories: 0, protein: 0, carbs: 0, fat: 0,
    });
  });

  it('accepts fractional values (per-gram estimates)', () => {
    expect(validateFoodEstimate({ calories: 1.5, protein: 0.07, carbs: 0.15, fat: 0.08 })).toEqual({
      calories: 1.5, protein: 0.07, carbs: 0.15, fat: 0.08,
    });
  });

  it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
    expect(() => validateFoodEstimate(raw)).toThrow(InvalidFoodEstimateError);
  });

  it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects negative %s', (field) => {
    expect(() => validateFoodEstimate({ ...valid, [field]: -1 })).toThrow(new RegExp(field));
  });

  it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects NaN %s', (field) => {
    expect(() => validateFoodEstimate({ ...valid, [field]: NaN })).toThrow(new RegExp(field));
  });

  it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects string %s', (field) => {
    expect(() => validateFoodEstimate({ ...valid, [field]: '100' })).toThrow(new RegExp(field));
  });

  it.each(['calories', 'protein', 'carbs', 'fat'] as const)('rejects missing %s', (field) => {
    const { [field]: _, ...partial } = valid;
    expect(() => validateFoodEstimate(partial)).toThrow(new RegExp(field));
  });

  it.each([
    ['calories above max', 'calories', 5000],
    ['protein above max', 'protein', 500],
    ['carbs above max', 'carbs', 500],
    ['fat above max', 'fat', 500],
  ] as const)('rejects out-of-range %s', (_label, field, value) => {
    expect(() => validateFoodEstimate({ ...valid, [field]: value })).toThrow(new RegExp(field));
  });
});

describe('isZeroEstimate', () => {
  it('returns true when all macros are zero', () => {
    expect(isZeroEstimate({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toBe(true);
  });

  it('returns false when any macro is non-zero', () => {
    expect(isZeroEstimate({ calories: 1, protein: 0, carbs: 0, fat: 0 })).toBe(false);
    expect(isZeroEstimate({ calories: 0, protein: 0, carbs: 0, fat: 0.1 })).toBe(false);
  });
});
