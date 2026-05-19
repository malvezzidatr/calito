import { matchActivity, matchGender, matchGoal } from '../../utils/profile.match';

describe('matchGender', () => {
  it.each([
    ['M', 'MALE'],
    ['m', 'MALE'],
    ['masculino', 'MALE'],
    ['Masculino', 'MALE'],
    ['homem', 'MALE'],
    ['sou homem', 'MALE'],
    ['sou masculino', 'MALE'],
    ['sou do sexo masculino', 'MALE'],
  ])('matches "%s" to MALE', (input, expected) => {
    expect(matchGender(input)).toBe(expected);
  });

  it.each([
    ['F', 'FEMALE'],
    ['f', 'FEMALE'],
    ['feminino', 'FEMALE'],
    ['Feminino', 'FEMALE'],
    ['mulher', 'FEMALE'],
    ['sou mulher', 'FEMALE'],
    ['sou feminino', 'FEMALE'],
  ])('matches "%s" to FEMALE', (input, expected) => {
    expect(matchGender(input)).toBe(expected);
  });

  it.each([
    [''],
    ['outro'],
    ['talvez'],
    ['masc'],
  ])('returns null for "%s"', (input) => {
    expect(matchGender(input)).toBeNull();
  });
});

describe('matchGoal', () => {
  it.each([
    ['1', 'LOSE'],
    ['emagrecer', 'LOSE'],
    ['perder', 'LOSE'],
    ['perder peso', 'LOSE'],
    ['quero emagrecer', 'LOSE'],
    ['preciso emagrecer', 'LOSE'],
    ['to querendo emagrecer', 'LOSE'],
    ['quero perder uns 5kg', 'LOSE'],
    ['quero ficar magro', 'LOSE'],
    ['preciso secar', 'LOSE'],
    ['definir o corpo', 'LOSE'],
    ['queimar gordura', 'LOSE'],
  ])('matches "%s" to LOSE', (input, expected) => {
    expect(matchGoal(input)).toBe(expected);
  });

  it.each([
    ['2', 'MAINTAIN'],
    ['manter', 'MAINTAIN'],
    ['manter peso', 'MAINTAIN'],
    ['manter o peso', 'MAINTAIN'],
    ['quero manter', 'MAINTAIN'],
    ['só quero manter o peso', 'MAINTAIN'],
    ['ficar no mesmo peso', 'MAINTAIN'],
    ['conservar', 'MAINTAIN'],
  ])('matches "%s" to MAINTAIN', (input, expected) => {
    expect(matchGoal(input)).toBe(expected);
  });

  it.each([
    ['3', 'GAIN'],
    ['ganhar', 'GAIN'],
    ['ganhar massa', 'GAIN'],
    ['ganhar peso', 'GAIN'],
    ['engordar', 'GAIN'],
    ['quero ganhar massa', 'GAIN'],
    ['quero hipertrofia', 'GAIN'],
    ['preciso ganhar peso', 'GAIN'],
    ['focar em musculo', 'GAIN'],
    ['fazer bulk', 'GAIN'],
    ['aumentar a massa', 'GAIN'],
  ])('matches "%s" to GAIN', (input, expected) => {
    expect(matchGoal(input)).toBe(expected);
  });

  it.each([
    [''],
    ['4'],
    ['nao sei'],
    ['talvez depois'],
  ])('returns null for "%s"', (input) => {
    expect(matchGoal(input)).toBeNull();
  });
});

describe('matchActivity', () => {
  it.each([
    ['1', 'SEDENTARY'],
    ['sedentario', 'SEDENTARY'],
    ['sedentário', 'SEDENTARY'],
    ['Sedentário', 'SEDENTARY'],
    ['sou sedentario', 'SEDENTARY'],
    ['fico parado', 'SEDENTARY'],
  ])('matches "%s" to SEDENTARY', (input, expected) => {
    expect(matchActivity(input)).toBe(expected);
  });

  it.each([
    ['2', 'LIGHT'],
    ['leve', 'LIGHT'],
    ['treino leve', 'LIGHT'],
    ['faco pouco', 'LIGHT'],
    ['3', 'MODERATE'],
    ['moderado', 'MODERATE'],
    ['treino moderado', 'MODERATE'],
    ['nivel medio', 'MODERATE'],
    ['4', 'INTENSE'],
    ['intenso', 'INTENSE'],
    ['treino intenso', 'INTENSE'],
    ['treino bastante', 'INTENSE'],
    ['5', 'VERY_INTENSE'],
    ['muito intenso', 'VERY_INTENSE'],
    ['treino muito intenso', 'VERY_INTENSE'],
  ])('matches "%s" to %s', (input, expected) => {
    expect(matchActivity(input)).toBe(expected);
  });

  it('picks VERY_INTENSE over INTENSE when both could match (longest-first)', () => {
    expect(matchActivity('muito intenso')).toBe('VERY_INTENSE');
  });

  it.each([
    [''],
    ['6'],
    ['as vezes'],
    ['nao sei dizer'],
  ])('returns null for "%s"', (input) => {
    expect(matchActivity(input)).toBeNull();
  });
});
