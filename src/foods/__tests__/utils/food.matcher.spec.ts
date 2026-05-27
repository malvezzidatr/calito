import { matchFood, normalize } from '../../utils/food.matcher';
import { FoodEntry } from '../../utils/food.types';

const ovo: FoodEntry = {
  id: 'ovo',
  name: 'Ovo de galinha',
  aliases: ['ovo', 'ovos', 'ovo de galinha', 'ovo cozido', 'ovo frito'],
  category: 'ovos_laticinios',
  default_unit: 'unidade',
  per_100g: { calories: 143, protein: 13, carbs: 1.1, fat: 9.5 },
  units: { unidade: { grams: 50 }, g: { grams: 1 } },
};

const maca: FoodEntry = {
  id: 'maca',
  name: 'Maçã',
  aliases: ['maca', 'maca vermelha', 'macas'],
  category: 'frutas',
  default_unit: 'unidade',
  per_100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  units: { unidade: { grams: 150 }, g: { grams: 1 } },
};

const frangoPeito: FoodEntry = {
  id: 'frango-peito',
  name: 'Peito de frango grelhado',
  aliases: ['frango', 'peito de frango', 'frango grelhado', 'file de frango'],
  category: 'carnes',
  default_unit: 'unidade',
  per_100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  units: { unidade: { grams: 120 }, g: { grams: 1 } },
};

const frangoCoxa: FoodEntry = {
  id: 'frango-coxa',
  name: 'Coxa de frango assada',
  aliases: ['coxa de frango', 'coxa', 'coxa assada'],
  category: 'carnes',
  default_unit: 'unidade',
  per_100g: { calories: 195, protein: 19, carbs: 0, fat: 13 },
  units: { unidade: { grams: 100 }, g: { grams: 1 } },
};

const arroz: FoodEntry = {
  id: 'arroz-branco',
  name: 'Arroz branco cozido',
  aliases: ['arroz', 'arroz branco', 'arroz cozido'],
  category: 'cereais',
  default_unit: 'colher',
  per_100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  units: { colher: { grams: 30 }, g: { grams: 1 } },
};

const catalog: FoodEntry[] = [ovo, maca, frangoPeito, frangoCoxa, arroz];

describe('normalize', () => {
  it('trims whitespace', () => {
    expect(normalize('  ovo  ')).toBe('ovo');
  });

  it('lowercases input', () => {
    expect(normalize('OVO')).toBe('ovo');
    expect(normalize('Frango Grelhado')).toBe('frango grelhado');
  });

  it('strips accents (NFD diacritics)', () => {
    expect(normalize('maçã')).toBe('maca');
    expect(normalize('café')).toBe('cafe');
    expect(normalize('açaí')).toBe('acai');
  });

  it('collapses multiple whitespace', () => {
    expect(normalize('frango   grelhado')).toBe('frango grelhado');
  });

  it('combines all transformations', () => {
    expect(normalize('  PÃO   FRANCÊS  ')).toBe('pao frances');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalize('   ')).toBe('');
  });
});

describe('matchFood — exact tier', () => {
  it('matches exact alias', () => {
    const result = matchFood('ovo', catalog);
    expect(result?.food.id).toBe('ovo');
    expect(result?.confidence).toBe('exact');
    expect(result?.matched_alias).toBe('ovo');
  });

  it('matches case-insensitive', () => {
    expect(matchFood('OVO', catalog)?.food.id).toBe('ovo');
    expect(matchFood('Ovo', catalog)?.food.id).toBe('ovo');
  });

  it('matches with accent variation', () => {
    expect(matchFood('maçã', catalog)?.food.id).toBe('maca');
  });

  it('matches with surrounding whitespace', () => {
    expect(matchFood('  ovo  ', catalog)?.food.id).toBe('ovo');
  });

  it('matches multi-word alias literally', () => {
    const result = matchFood('peito de frango', catalog);
    expect(result?.food.id).toBe('frango-peito');
    expect(result?.confidence).toBe('exact');
  });

  it('matches multi-word alias case + accent insensitive', () => {
    const result = matchFood('Coxa de Frango', catalog);
    expect(result?.food.id).toBe('frango-coxa');
    expect(result?.confidence).toBe('exact');
  });
});

describe('matchFood — partial tier', () => {
  it('matches when input contains alias as substring', () => {
    const result = matchFood('comi 2 ovos cozidos hoje', catalog);
    expect(result?.food.id).toBe('ovo');
    expect(result?.confidence).toBe('partial');
  });

  it('prefers the longest alias when multiple match', () => {
    const result = matchFood('comi peito de frango grelhado', catalog);
    expect(result?.food.id).toBe('frango-peito');
    expect(['peito de frango', 'frango grelhado']).toContain(result?.matched_alias);
  });

  it('matches when alias has extra surrounding words in input', () => {
    const result = matchFood('comi arroz branco hoje', catalog);
    expect(result?.food.id).toBe('arroz-branco');
    expect(result?.confidence).toBe('partial');
    expect(result?.matched_alias).toBe('arroz branco');
  });

  it('uses word boundary — partial word does NOT match', () => {
    expect(matchFood('arrozinho', catalog)).toBeNull();
  });

  it('matches "coxa" alone to coxa entry (not peito)', () => {
    const result = matchFood('coxa', catalog);
    expect(result?.food.id).toBe('frango-coxa');
  });
});

describe('matchFood — ambiguity', () => {
  it('exact match wins over partial match', () => {
    const result = matchFood('frango', catalog);
    expect(result?.food.id).toBe('frango-peito');
    expect(result?.confidence).toBe('exact');
  });

  it('between two partial matches, the longer alias wins', () => {
    const result = matchFood('comi um frango grelhado no almoco', catalog);
    expect(result?.food.id).toBe('frango-peito');
    expect(result?.matched_alias).toBe('frango grelhado');
  });
});

describe('matchFood — no match', () => {
  it('returns null for unknown food', () => {
    expect(matchFood('xyzcoiso', catalog)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(matchFood('', catalog)).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(matchFood('   ', catalog)).toBeNull();
  });

  it('returns null when catalog is empty', () => {
    expect(matchFood('ovo', [])).toBeNull();
  });
});

describe('matchFood — real catalog integration', () => {
  const fullCatalog = require('../../data/foods.json') as FoodEntry[];

  it.each([
    ['ovo', 'ovo'],
    ['ovos', 'ovo'],
    ['banana', 'banana'],
    ['maçã', 'maca'],
    ['frango', 'frango-peito'],
    ['peito de frango', 'frango-peito'],
    ['frango grelhado', 'frango-peito'],
    ['arroz', 'arroz-branco'],
    ['feijão', 'feijao-carioca'],
    ['feijão preto', 'feijao-preto'],
    ['leite', 'leite-integral'],
    ['queijo', 'queijo-mussarela'],
    ['açaí', 'acai-polpa'],
    ['café', 'cafe-puro'],
    ['hambúrguer', 'hamburguer-comum'],
    ['cheeseburger', 'hamburguer-comum'],
    ['hambúrguer blend', 'hamburguer-blend'],
    ['pão francês', 'pao-frances'],
    ['pão de queijo', 'pao-de-queijo'],
    ['fatia de pizza muçarela', 'pizza-mussarela'],
    ['whey', 'whey-protein'],
    ['castanha do pará', 'castanha-do-para'],
    ['salada', 'salada-acompanhamento'],
    ['cenoura', 'cenoura-crua'],
    ['bacon', 'bacon-frito'],
    ['nuggets', 'nuggets-frango'],
    ['coxinha', 'coxinha-frango'],
    ['sushi', 'sushi-niguiri'],
    ['açaí na tigela', 'acai-na-tigela'],
    ['suco de laranja', 'suco-laranja-natural'],
  ])('matchFood(%p) returns entry %p', (input, expectedId) => {
    const result = matchFood(input, fullCatalog);
    expect(result?.food.id).toBe(expectedId);
  });

  it('handles input with extra words: "comi 2 ovos no café da manhã"', () => {
    const result = matchFood('comi 2 ovos no cafe da manha', fullCatalog);
    expect(result?.food.id).toBe('ovo');
  });
});
