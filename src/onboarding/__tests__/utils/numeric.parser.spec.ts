import { parseDecimal, parseHeightCm, parseInteger } from '../../utils/numeric.parser';

describe('parseDecimal', () => {
  it.each([
    ['70', 70],
    ['70.5', 70.5],
    ['70,5', 70.5],
    ['  70  ', 70],
  ])('parses plain number "%s" as %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each([
    ['70kg', 70],
    ['70 kg', 70],
    ['70.5kg', 70.5],
    ['70,5kg', 70.5],
    ['170cm', 170],
    ['25 anos', 25],
    ['peso 70', 70],
  ])('strips units and noise from "%s" returning %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each([
    ['', null],
    ['kg', null],
    ['abc', null],
    ['nada de numero', null],
    ['1.2.3', null],
  ])('returns null for invalid input "%s"', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
});

describe('parseInteger', () => {
  it.each([
    ['25', 25],
    ['25 anos', 25],
    ['tenho 25', 25],
    ['  25  ', 25],
  ])('parses integer "%s" as %p', (input, expected) => {
    expect(parseInteger(input)).toBe(expected);
  });

  it.each([
    ['25.5', null],
    ['25,5', null],
    ['25.5 anos', null],
  ])('rejects decimal input "%s"', (input, expected) => {
    expect(parseInteger(input)).toBe(expected);
  });

  it.each([
    ['', null],
    ['abc', null],
    ['anos', null],
  ])('returns null for invalid input "%s"', (input, expected) => {
    expect(parseInteger(input)).toBe(expected);
  });
});

describe('parseHeightCm', () => {
  it.each([
    ['170', 170],
    ['170cm', 170],
    ['altura 170', 170],
  ])('returns cm as-is when value is already >= 3 ("%s" → %p)', (input, expected) => {
    expect(parseHeightCm(input)).toBe(expected);
  });

  it.each([
    ['1.70m', 170],
    ['1,70m', 170],
    ['1.70', 170],
    ['1,70', 170],
    ['1m70', 170],
    ['1.7', 170],
    ['2', 200],
    ['2.5', 250],
  ])('converts meters to cm when value < 3 ("%s" → %p)', (input, expected) => {
    expect(parseHeightCm(input)).toBe(expected);
  });

  it('rounds away float precision artifacts (1.7 * 100 = 170.0000000000003)', () => {
    expect(parseHeightCm('1.7m')).toBe(170);
    expect(Number.isInteger(parseHeightCm('1.7m'))).toBe(true);
  });

  it.each([
    ['', null],
    ['altura', null],
  ])('returns null for invalid input "%s"', (input, expected) => {
    expect(parseHeightCm(input)).toBe(expected);
  });
});
