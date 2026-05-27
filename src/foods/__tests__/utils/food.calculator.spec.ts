import { calculateMacros } from '../../utils/food.calculator';
import { FoodEntry } from '../../utils/food.types';

const ovo: FoodEntry = {
  id: 'ovo',
  name: 'Ovo de galinha',
  aliases: ['ovo', 'ovos'],
  category: 'ovos_laticinios',
  default_unit: 'unidade',
  per_100g: { calories: 143, protein: 13, carbs: 1.1, fat: 9.5 },
  units: { unidade: { grams: 50 }, g: { grams: 1 } },
};

const banana: FoodEntry = {
  id: 'banana',
  name: 'Banana',
  aliases: ['banana', 'bananas'],
  category: 'frutas',
  default_unit: 'unidade',
  per_100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  units: { unidade: { grams: 100 }, g: { grams: 1 } },
};

const frangoPeito: FoodEntry = {
  id: 'frango-peito',
  name: 'Peito de frango grelhado',
  aliases: ['frango', 'peito de frango', 'frango grelhado'],
  category: 'carnes',
  default_unit: 'unidade',
  per_100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  units: { unidade: { grams: 120 }, g: { grams: 1 } },
};

const arroz: FoodEntry = {
  id: 'arroz-branco',
  name: 'Arroz branco cozido',
  aliases: ['arroz', 'arroz branco'],
  category: 'cereais',
  default_unit: 'colher',
  per_100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  units: { colher: { grams: 30 }, g: { grams: 1 } },
};

const catalog: FoodEntry[] = [ovo, banana, frangoPeito, arroz];

describe('calculateMacros — happy path', () => {
  it('returns zero totals and empty arrays for empty input', () => {
    const result = calculateMacros([], catalog);
    expect(result.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
  });

  it('calculates macros for a single item using unit', () => {
    const result = calculateMacros([{ food: 'ovo', quantity: 2, unit: 'unidade' }], catalog);
    expect(result.totals.calories).toBe(143);
    expect(result.totals.protein).toBe(13);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toEqual([]);
  });

  it('calculates macros for a single item using g', () => {
    const result = calculateMacros([{ food: 'frango', quantity: 100, unit: 'g' }], catalog);
    expect(result.totals.calories).toBe(165);
    expect(result.totals.protein).toBe(31);
  });

  it('sums multiple items', () => {
    const result = calculateMacros(
      [
        { food: 'ovo', quantity: 2, unit: 'unidade' },
        { food: 'banana', quantity: 1, unit: 'unidade' },
      ],
      catalog,
    );
    expect(result.totals.calories).toBe(232);
    expect(result.matched).toHaveLength(2);
  });

  it('handles fractional quantities', () => {
    const result = calculateMacros([{ food: 'banana', quantity: 0.5, unit: 'unidade' }], catalog);
    expect(result.totals.calories).toBe(45);
    expect(result.matched[0].grams).toBe(50);
  });

  it('handles mixed units across items', () => {
    const result = calculateMacros(
      [
        { food: 'frango', quantity: 1, unit: 'unidade' },
        { food: 'arroz', quantity: 4, unit: 'colher' },
      ],
      catalog,
    );
    expect(result.totals.calories).toBe(354);
    expect(result.totals.protein).toBe(40);
  });

  it('aggregates same food appearing twice', () => {
    const result = calculateMacros(
      [
        { food: 'ovo', quantity: 1, unit: 'unidade' },
        { food: 'ovo', quantity: 1, unit: 'unidade' },
      ],
      catalog,
    );
    expect(result.totals.calories).toBe(143);
    expect(result.matched).toHaveLength(2);
  });
});

describe('calculateMacros — matched details', () => {
  it('exposes resolved food entry and matched alias', () => {
    const result = calculateMacros([{ food: 'ovos', quantity: 2, unit: 'unidade' }], catalog);
    expect(result.matched[0].food.id).toBe('ovo');
    expect(result.matched[0].matched_alias).toBe('ovos');
  });

  it('computes grams from quantity × unit conversion', () => {
    const result = calculateMacros([{ food: 'arroz', quantity: 4, unit: 'colher' }], catalog);
    expect(result.matched[0].grams).toBe(120);
  });

  it('exposes per-item macros (not rounded) in matched.macros', () => {
    const result = calculateMacros([{ food: 'frango', quantity: 1, unit: 'unidade' }], catalog);
    expect(result.matched[0].macros.calories).toBeCloseTo(198, 0);
    expect(result.matched[0].macros.protein).toBeCloseTo(37.2, 1);
  });

  it('preserves the original input in matched.input', () => {
    const input = { food: 'OVO', quantity: 3, unit: 'unidade' };
    const result = calculateMacros([input], catalog);
    expect(result.matched[0].input).toBe(input);
  });
});

describe('calculateMacros — unmatched: food_not_found', () => {
  it('pushes item with reason food_not_found when food is unknown', () => {
    const result = calculateMacros([{ food: 'xyzcoiso', quantity: 1, unit: 'unidade' }], catalog);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].reason).toBe('food_not_found');
    expect(result.matched).toEqual([]);
  });

  it('does not include unmatched contributions in totals', () => {
    const result = calculateMacros(
      [
        { food: 'ovo', quantity: 1, unit: 'unidade' },
        { food: 'xyzcoiso', quantity: 99, unit: 'g' },
      ],
      catalog,
    );
    expect(result.totals.calories).toBe(72);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
  });

  it('preserves the original input in unmatched.input', () => {
    const input = { food: 'desconhecido', quantity: 2, unit: 'g' };
    const result = calculateMacros([input], catalog);
    expect(result.unmatched[0].input).toBe(input);
  });
});

describe('calculateMacros — unmatched: unit_not_supported', () => {
  it('pushes item with reason unit_not_supported when food matches but unit is not configured', () => {
    const result = calculateMacros([{ food: 'ovo', quantity: 1, unit: 'colher' }], catalog);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].reason).toBe('unit_not_supported');
    expect(result.matched).toEqual([]);
  });

  it('pushes unit_not_supported when unit is an invalid enum value', () => {
    const result = calculateMacros([{ food: 'ovo', quantity: 1, unit: 'litro' }], catalog);
    expect(result.unmatched[0].reason).toBe('unit_not_supported');
  });

  it('still computes other items when one has bad unit', () => {
    const result = calculateMacros(
      [
        { food: 'banana', quantity: 1, unit: 'unidade' },
        { food: 'banana', quantity: 1, unit: 'colher' },
      ],
      catalog,
    );
    expect(result.totals.calories).toBe(89);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].reason).toBe('unit_not_supported');
  });
});

describe('calculateMacros — rounding', () => {
  it('rounds kcal/p/c to integers', () => {
    const result = calculateMacros([{ food: 'banana', quantity: 1, unit: 'unidade' }], catalog);
    expect(Number.isInteger(result.totals.calories)).toBe(true);
    expect(Number.isInteger(result.totals.protein)).toBe(true);
    expect(Number.isInteger(result.totals.carbs)).toBe(true);
  });

  it('keeps fat with 1 decimal when below 5g', () => {
    const result = calculateMacros([{ food: 'banana', quantity: 1, unit: 'unidade' }], catalog);
    expect(result.totals.fat).toBe(0.3);
  });

  it('rounds fat to integer when >= 5g', () => {
    const result = calculateMacros([{ food: 'ovo', quantity: 2, unit: 'unidade' }], catalog);
    expect(Number.isInteger(result.totals.fat)).toBe(true);
    expect(result.totals.fat).toBe(10);
  });

  it('rounds totals after summing, not per item', () => {
    const result = calculateMacros(
      [
        { food: 'banana', quantity: 1, unit: 'unidade' },
        { food: 'banana', quantity: 1, unit: 'unidade' },
      ],
      catalog,
    );
    expect(result.totals.fat).toBe(0.6);
  });
});

describe('calculateMacros — case/accent tolerance via matcher', () => {
  it('case insensitive food name', () => {
    const result = calculateMacros([{ food: 'OVO', quantity: 1, unit: 'unidade' }], catalog);
    expect(result.matched).toHaveLength(1);
    expect(result.totals.calories).toBe(72);
  });

  it('strips accents in food name', () => {
    const maca: FoodEntry = {
      id: 'maca',
      name: 'Maçã',
      aliases: ['maca'],
      category: 'frutas',
      default_unit: 'unidade',
      per_100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
      units: { unidade: { grams: 150 }, g: { grams: 1 } },
    };
    // valida que matcher também é resiliente, mas precisa ter >=2 aliases real;
    // aqui é só pra confirmar que o calculator não derruba quando alias com acento entra
    const result = calculateMacros([{ food: 'maçã', quantity: 1, unit: 'unidade' }], [...catalog, { ...maca, aliases: ['maca', 'maças'] }]);
    expect(result.matched[0].food.id).toBe('maca');
  });
});

describe('calculateMacros — real catalog integration', () => {
  const fullCatalog = require('../../data/foods.json') as FoodEntry[];

  it('calculates "2 ovos + 1 banana" using real seed', () => {
    const result = calculateMacros(
      [
        { food: 'ovo', quantity: 2, unit: 'unidade' },
        { food: 'banana', quantity: 1, unit: 'unidade' },
      ],
      fullCatalog,
    );
    expect(result.totals.calories).toBeGreaterThan(200);
    expect(result.totals.calories).toBeLessThan(260);
    expect(result.unmatched).toEqual([]);
  });

  it('calculates a full meal: arroz + feijão + frango', () => {
    const result = calculateMacros(
      [
        { food: 'arroz', quantity: 4, unit: 'colher' },
        { food: 'feijão', quantity: 1, unit: 'concha' },
        { food: 'frango', quantity: 1, unit: 'unidade' },
      ],
      fullCatalog,
    );
    expect(result.totals.calories).toBeGreaterThan(350);
    expect(result.totals.protein).toBeGreaterThan(40);
    expect(result.unmatched).toEqual([]);
  });

  it('calculates 1 fatia de pizza muçarela using real seed', () => {
    const result = calculateMacros(
      [{ food: 'pizza muçarela', quantity: 1, unit: 'fatia' }],
      fullCatalog,
    );
    expect(result.totals.calories).toBeGreaterThan(250);
    expect(result.totals.calories).toBeLessThan(320);
  });

  it('reports unmatched for exotic food not in seed', () => {
    const result = calculateMacros([{ food: 'acarajé', quantity: 1, unit: 'unidade' }], fullCatalog);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].reason).toBe('food_not_found');
  });
});
