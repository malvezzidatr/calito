import { detectMacro } from '../macro.detect';

describe('detectMacro', () => {
  it.each([
    ['quanta proteína comi hoje?', 'protein'],
    ['quanto de proteina',         'protein'],
    ['proteína?',                  'protein'],
    ['quanto carboidrato',         'carbs'],
    ['quantos carbo comi',         'carbs'],
    ['e os carbo do dia?',         'carbs'],
    ['quanta gordura comi',        'fat'],
    ['gordura hoje?',              'fat'],
    ['quantas calorias comi?',     'calorie'],
    ['quanta caloria',             'calorie'],
    ['me mostra as calorias',      'calorie'],
    ['quantos kcal',               'calorie'],
  ])('detects %s → %s', (text, expected) => {
    expect(detectMacro(text)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(detectMacro('QUANTA PROTEÍNA')).toBe('protein');
    expect(detectMacro('GORDURA')).toBe('fat');
    expect(detectMacro('CALORIAS')).toBe('calorie');
  });

  it('returns null when no macro keyword is found', () => {
    expect(detectMacro('como foi meu dia?')).toBeNull();
    expect(detectMacro('oi tudo bem?')).toBeNull();
    expect(detectMacro('')).toBeNull();
  });

  it('returns the first matching macro when multiple keywords appear', () => {
    expect(detectMacro('proteína e gordura')).toBe('protein');
  });
});
