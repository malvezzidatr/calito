import { validateMealParserResult } from '../../utils/meal.parser.validation';
import { InvalidMealParserError } from '../../exceptions/meals.errors';
import {
  MealParserExtraction,
  MealParserResult,
  isMealParserClarification,
  buildParserEditMessage,
} from '../../utils/meal.parser.prompt';

const validExtraction = {
  foods: [
    { food: 'ovo', quantity: 2, unit: 'unidade' },
    { food: 'banana', quantity: 1, unit: 'unidade' },
  ],
  meal_type: 'BREAKFAST',
};

function asExtraction(result: MealParserResult): MealParserExtraction {
  if (isMealParserClarification(result)) {
    throw new Error(`Expected extraction, got clarification: ${result.needs_clarification}`);
  }
  return result;
}

describe('validateMealParserResult — happy path', () => {
  it('accepts a fully-formed extraction', () => {
    const result = asExtraction(validateMealParserResult(validExtraction));
    expect(result.foods).toHaveLength(2);
    expect(result.foods[0]).toEqual({ food: 'ovo', quantity: 2, unit: 'unidade' });
    expect(result.meal_type).toBe('BREAKFAST');
  });

  it('accepts meal_type === null', () => {
    const result = asExtraction(validateMealParserResult({ ...validExtraction, meal_type: null }));
    expect(result.meal_type).toBeNull();
  });

  it('accepts meal_type missing entirely (treated as null)', () => {
    const { meal_type: _, ...withoutMealType } = validExtraction;
    const result = asExtraction(validateMealParserResult(withoutMealType));
    expect(result.meal_type).toBeNull();
  });

  it.each(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])('accepts meal_type %s', (mt) => {
    expect(() => validateMealParserResult({ ...validExtraction, meal_type: mt })).not.toThrow();
  });

  it('lowercases and trims food names', () => {
    const result = asExtraction(validateMealParserResult({
      foods: [{ food: '  OVO  ', quantity: 1, unit: 'unidade' }],
      meal_type: null,
    }));
    expect(result.foods[0].food).toBe('ovo');
  });

  it('accepts fractional quantities', () => {
    const result = asExtraction(validateMealParserResult({
      foods: [{ food: 'banana', quantity: 0.5, unit: 'unidade' }],
      meal_type: null,
    }));
    expect(result.foods[0].quantity).toBe(0.5);
  });

  it.each(['unidade', 'g', 'ml', 'colher', 'concha', 'fatia', 'copo', 'scoop', 'prato', 'porcao'])(
    'accepts canonical unit %s',
    (unit) => {
      expect(() => validateMealParserResult({
        foods: [{ food: 'x', quantity: 1, unit }],
        meal_type: null,
      })).not.toThrow();
    },
  );
});

describe('validateMealParserResult — clarification path', () => {
  it('returns clarification when needs_clarification is a non-empty string', () => {
    const result = validateMealParserResult({ needs_clarification: 'Me manda de novo com as quantidades' });
    expect(result).toEqual({ needs_clarification: 'Me manda de novo com as quantidades' });
  });

  it('trims whitespace from clarification', () => {
    const result = validateMealParserResult({ needs_clarification: '  Me manda  ' });
    expect(result).toEqual({ needs_clarification: 'Me manda' });
  });

  it('clarification wins when both clarification and foods are present', () => {
    const result = validateMealParserResult({
      ...validExtraction,
      needs_clarification: 'Qual quantidade?',
    });
    expect(result).toEqual({ needs_clarification: 'Qual quantidade?' });
  });

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['null', null],
    ['number', 42],
  ])('ignores %s clarification and validates extraction normally', (_label, needs_clarification) => {
    const result = validateMealParserResult({ ...validExtraction, needs_clarification });
    expect(isMealParserClarification(result)).toBe(false);
  });
});

describe('validateMealParserResult — payload shape', () => {
  it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
    expect(() => validateMealParserResult(raw)).toThrow(InvalidMealParserError);
  });
});

describe('validateMealParserResult — foods array', () => {
  it('rejects when foods is not an array', () => {
    expect(() => validateMealParserResult({ foods: 'not array', meal_type: null })).toThrow(/foods/);
  });

  it('rejects when foods is empty array', () => {
    expect(() => validateMealParserResult({ foods: [], meal_type: null })).toThrow(/foods/);
  });

  it('rejects when foods is missing entirely', () => {
    expect(() => validateMealParserResult({ meal_type: 'LUNCH' })).toThrow(/foods/);
  });
});

describe('validateMealParserResult — food item validation', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['null', null],
    ['number', 42],
    ['undefined', undefined],
  ])('rejects %s food name', (_label, food) => {
    expect(() => validateMealParserResult({
      foods: [{ food, quantity: 1, unit: 'unidade' }],
      meal_type: null,
    })).toThrow(/foods\[0\]\.food/);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['string', '1'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s quantity', (_label, quantity) => {
    expect(() => validateMealParserResult({
      foods: [{ food: 'ovo', quantity, unit: 'unidade' }],
      meal_type: null,
    })).toThrow(/foods\[0\]\.quantity/);
  });

  it.each([
    ['unknown unit', 'litro'],
    ['uppercase', 'UNIDADE'],
    ['with accent', 'unídade'],
    ['number', 1],
    ['null', null],
    ['empty', ''],
  ])('rejects invalid unit %s (%p)', (_label, unit) => {
    expect(() => validateMealParserResult({
      foods: [{ food: 'ovo', quantity: 1, unit }],
      meal_type: null,
    })).toThrow(/foods\[0\]\.unit/);
  });

  it('reports correct index when error is in the second item', () => {
    expect(() => validateMealParserResult({
      foods: [
        { food: 'ovo', quantity: 1, unit: 'unidade' },
        { food: 'banana', quantity: -1, unit: 'unidade' },
      ],
      meal_type: null,
    })).toThrow(/foods\[1\]\.quantity/);
  });
});

describe('validateMealParserResult — meal_type validation', () => {
  it.each([
    ['lowercase', 'breakfast'],
    ['portuguese', 'café da manhã'],
    ['random string', 'foo'],
    ['number', 1],
  ])('rejects %s (%p)', (_label, meal_type) => {
    expect(() => validateMealParserResult({ ...validExtraction, meal_type })).toThrow(/meal_type/);
  });
});

describe('buildParserEditMessage', () => {
  it('builds an edit message with original and correction', () => {
    const message = buildParserEditMessage('2 ovos e arroz', 'era 1 ovo');
    expect(message).toContain('Descrição original: "2 ovos e arroz"');
    expect(message).toContain('Correção do usuário: "era 1 ovo"');
    expect(message).toContain('lista FINAL');
  });
});
