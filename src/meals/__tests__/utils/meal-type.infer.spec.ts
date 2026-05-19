import { inferMealTypeByHour } from '../../utils/meal-type.infer';

const spHourToUtc = (hour: number, minute = 0): Date => {
  const utcHour = (hour + 3) % 24;
  const baseDate = '2026-05-19';
  return new Date(`${baseDate}T${String(utcHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
};

describe('inferMealTypeByHour', () => {
  describe('classifies based on São Paulo time regardless of system timezone', () => {
    it('22h SP (01h UTC the next day) is DINNER — main acceptance case from CS-39', () => {
      const date = new Date('2026-05-20T01:00:00Z');
      expect(inferMealTypeByHour(date)).toBe('DINNER');
    });

    it('08h SP (11h UTC) is BREAKFAST', () => {
      expect(inferMealTypeByHour(spHourToUtc(8))).toBe('BREAKFAST');
    });

    it('12h SP (15h UTC) is LUNCH', () => {
      expect(inferMealTypeByHour(spHourToUtc(12))).toBe('LUNCH');
    });

    it('16h SP (19h UTC) is SNACK', () => {
      expect(inferMealTypeByHour(spHourToUtc(16))).toBe('SNACK');
    });

    it('20h SP (23h UTC) is DINNER', () => {
      expect(inferMealTypeByHour(spHourToUtc(20))).toBe('DINNER');
    });

    it('02h SP (05h UTC) is SNACK', () => {
      expect(inferMealTypeByHour(spHourToUtc(2))).toBe('SNACK');
    });
  });

  describe('boundary hours', () => {
    it.each([
      [4, 59, 'SNACK'],
      [5, 0,  'BREAKFAST'],
      [10, 59, 'BREAKFAST'],
      [11, 0,  'LUNCH'],
      [14, 59, 'LUNCH'],
      [15, 0,  'SNACK'],
      [17, 59, 'SNACK'],
      [18, 0,  'DINNER'],
      [22, 59, 'DINNER'],
      [23, 0,  'SNACK'],
      [0, 0,   'SNACK'],
    ] as const)('SP %sh%s -> %s', (hour, minute, expected) => {
      expect(inferMealTypeByHour(spHourToUtc(hour, minute))).toBe(expected);
    });
  });
});
