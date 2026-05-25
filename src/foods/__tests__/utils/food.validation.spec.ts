import { validateFoodEntry, validateFoodCatalog, InvalidFoodEntryError } from '../../utils/food.validation';
import foodsCatalog from '../../data/foods.json';

const validEntry = {
  id: 'ovo-galinha',
  name: 'Ovo de galinha',
  aliases: ['ovo', 'ovo cozido'],
  category: 'ovos_laticinios',
  default_unit: 'unidade',
  per_100g: { kcal: 143, p: 13, c: 1.1, g: 9.5 },
  units: {
    unidade: { grams: 50 },
    g: { grams: 1 },
  },
};

describe('validateFoodEntry', () => {
  describe('happy path', () => {
    it('accepts a fully-formed entry', () => {
      const result = validateFoodEntry(validEntry);
      expect(result.id).toBe('ovo-galinha');
      expect(result.name).toBe('Ovo de galinha');
      expect(result.aliases).toEqual(['ovo', 'ovo cozido']);
      expect(result.category).toBe('ovos_laticinios');
      expect(result.default_unit).toBe('unidade');
    });

    it('trims whitespace from name and aliases', () => {
      const result = validateFoodEntry({ ...validEntry, name: '  Ovo  ', aliases: ['  ovo  ', '  ovo cozido  '] });
      expect(result.name).toBe('Ovo');
      expect(result.aliases).toEqual(['ovo', 'ovo cozido']);
    });
  });

  describe('payload shape', () => {
    it.each([null, undefined, 'string', 42, true])('rejects non-object payload: %p', (raw) => {
      expect(() => validateFoodEntry(raw)).toThrow(InvalidFoodEntryError);
    });
  });

  describe('id validation', () => {
    it.each([
      ['UPPERCASE', 'OVO'],
      ['spaces', 'ovo galinha'],
      ['underscore', 'ovo_galinha'],
      ['starts with hyphen', '-ovo'],
      ['ends with hyphen', 'ovo-'],
      ['double hyphen', 'ovo--galinha'],
      ['empty string', ''],
      ['number', 42],
      ['null', null],
    ])('rejects invalid id %s (%p)', (_label, id) => {
      expect(() => validateFoodEntry({ ...validEntry, id })).toThrow(/id/);
    });

    it.each(['ovo', 'ovo-galinha', 'arroz-branco-cozido', 'pizza-4-queijos'])('accepts valid kebab-case id: %s', (id) => {
      expect(() => validateFoodEntry({ ...validEntry, id })).not.toThrow();
    });
  });

  describe('name validation', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['null', null],
      ['number', 42],
      ['undefined', undefined],
    ])('rejects invalid name %s', (_label, name) => {
      expect(() => validateFoodEntry({ ...validEntry, name })).toThrow(/name/);
    });
  });

  describe('aliases validation', () => {
    it('rejects array with less than 2 entries', () => {
      expect(() => validateFoodEntry({ ...validEntry, aliases: ['ovo'] })).toThrow(/aliases/);
    });

    it('rejects empty array', () => {
      expect(() => validateFoodEntry({ ...validEntry, aliases: [] })).toThrow(/aliases/);
    });

    it('rejects non-array', () => {
      expect(() => validateFoodEntry({ ...validEntry, aliases: 'ovo, ovo cozido' })).toThrow(/aliases/);
    });

    it('rejects uppercase aliases', () => {
      expect(() => validateFoodEntry({ ...validEntry, aliases: ['Ovo', 'OVO COZIDO'] })).toThrow(/lowercase/);
    });

    it('rejects empty string alias', () => {
      expect(() => validateFoodEntry({ ...validEntry, aliases: ['ovo', ''] })).toThrow(/aliases/);
    });

    it('rejects non-string alias', () => {
      expect(() => validateFoodEntry({ ...validEntry, aliases: ['ovo', 42] })).toThrow(/aliases/);
    });
  });

  describe('category validation', () => {
    it.each([
      'cereais', 'leguminosas', 'carnes', 'ovos_laticinios', 'frutas',
      'verduras', 'paes_cereais', 'processados', 'bebidas', 'composicao_lanche',
    ])('accepts valid category %s', (category) => {
      expect(() => validateFoodEntry({ ...validEntry, category })).not.toThrow();
    });

    it.each([
      ['lowercase typo', 'cereaiss'],
      ['uppercase', 'CEREAIS'],
      ['portuguese variant', 'frutas-doces'],
      ['empty', ''],
      ['number', 1],
    ])('rejects invalid category %s (%p)', (_label, category) => {
      expect(() => validateFoodEntry({ ...validEntry, category })).toThrow(/category/);
    });
  });

  describe('default_unit validation', () => {
    it.each(['unidade', 'g', 'ml', 'colher', 'concha', 'fatia', 'copo', 'scoop', 'prato', 'porcao'])(
      'accepts valid unit %s',
      (unit) => {
        const units = { [unit]: { grams: 10 } };
        expect(() => validateFoodEntry({ ...validEntry, default_unit: unit, units })).not.toThrow();
      },
    );

    it('rejects default_unit not present in units', () => {
      expect(() =>
        validateFoodEntry({ ...validEntry, default_unit: 'fatia', units: { unidade: { grams: 50 } } }),
      ).toThrow(/default_unit/);
    });

    it('rejects unknown unit', () => {
      expect(() => validateFoodEntry({ ...validEntry, default_unit: 'litro' })).toThrow(/default_unit/);
    });
  });

  describe('per_100g validation', () => {
    it.each(['kcal', 'p', 'c', 'g'] as const)('rejects negative %s', (field) => {
      expect(() => validateFoodEntry({ ...validEntry, per_100g: { ...validEntry.per_100g, [field]: -1 } })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['kcal', 'p', 'c', 'g'] as const)('rejects NaN %s', (field) => {
      expect(() => validateFoodEntry({ ...validEntry, per_100g: { ...validEntry.per_100g, [field]: NaN } })).toThrow(
        new RegExp(field),
      );
    });

    it.each(['kcal', 'p', 'c', 'g'] as const)('rejects missing %s', (field) => {
      const { [field]: _, ...partial } = validEntry.per_100g;
      expect(() => validateFoodEntry({ ...validEntry, per_100g: partial })).toThrow(new RegExp(field));
    });

    it('accepts zero values', () => {
      expect(() =>
        validateFoodEntry({ ...validEntry, per_100g: { kcal: 0, p: 0, c: 0, g: 0 } }),
      ).not.toThrow();
    });
  });

  describe('units validation', () => {
    it('rejects empty units object', () => {
      expect(() => validateFoodEntry({ ...validEntry, units: {} })).toThrow(/units/);
    });

    it('rejects unknown unit key', () => {
      expect(() =>
        validateFoodEntry({ ...validEntry, units: { unidade: { grams: 50 }, litro: { grams: 1000 } } }),
      ).toThrow(/litro/);
    });

    it.each([0, -1, NaN, Infinity, '50'])('rejects invalid grams value: %p', (grams) => {
      expect(() => validateFoodEntry({ ...validEntry, units: { unidade: { grams } } })).toThrow(/grams/);
    });
  });
});

describe('validateFoodCatalog', () => {
  it('rejects non-array payload', () => {
    expect(() => validateFoodCatalog({})).toThrow(InvalidFoodEntryError);
    expect(() => validateFoodCatalog(null)).toThrow(InvalidFoodEntryError);
  });

  it('rejects catalog with duplicate ids', () => {
    expect(() => validateFoodCatalog([validEntry, validEntry])).toThrow(/duplicate/);
  });

  it('accepts an array of valid entries', () => {
    const other = { ...validEntry, id: 'banana', aliases: ['banana', 'bananas'] };
    const result = validateFoodCatalog([validEntry, other]);
    expect(result).toHaveLength(2);
  });
});

describe('seed catalog (foods.json)', () => {
  it('loads without validation errors', () => {
    expect(() => validateFoodCatalog(foodsCatalog)).not.toThrow();
  });

  it('has at least 30 entries in initial seed', () => {
    const entries = validateFoodCatalog(foodsCatalog);
    expect(entries.length).toBeGreaterThanOrEqual(30);
  });

  it('every entry default_unit exists in its units map', () => {
    const entries = validateFoodCatalog(foodsCatalog);
    for (const entry of entries) {
      expect(entry.units[entry.default_unit]).toBeDefined();
    }
  });

  it('every entry has at least 2 aliases', () => {
    const entries = validateFoodCatalog(foodsCatalog);
    for (const entry of entries) {
      expect(entry.aliases.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all ids are unique', () => {
    const entries = validateFoodCatalog(foodsCatalog);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
