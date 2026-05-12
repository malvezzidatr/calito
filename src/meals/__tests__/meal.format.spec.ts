import { formatDailyResume, formatMealConfirmation, DailyMeal, DailyGoals } from '../meal.format';
import { DailyTotals } from '../meal.praise';

const baseTotals: DailyTotals = { calories: 1650, protein: 120, carbs: 200, fat: 50 };
const baseGoals: DailyGoals = { calorie: 2150, protein: 160, carbs: 240, fat: 72 };
const baseMeals: DailyMeal[] = [
  { meal_type: 'BREAKFAST', calories: 350 },
  { meal_type: 'LUNCH',     calories: 750 },
  { meal_type: 'SNACK',     calories: 200 },
  { meal_type: 'DINNER',    calories: 350 },
];
const date = new Date('2026-05-12T15:00:00');

describe('formatMealConfirmation', () => {
  it('formats lunch with calories, macros and the provided praise', () => {
    const result = formatMealConfirmation(
      'LUNCH',
      { description: 'arroz e frango', calories: 650, protein: 45, carbs: 75, fat: 12, meal_type: 'LUNCH' },
      'Mandou bem!',
    );
    expect(result).toContain('Almoço');
    expect(result).toContain('650kcal');
    expect(result).toContain('P: 45g');
    expect(result).toContain('Mandou bem!');
  });
});

describe('formatDailyResume', () => {
  describe('header', () => {
    it('includes a header with formatted date DD/MM', () => {
      const result = formatDailyResume(date, baseMeals, baseTotals, baseGoals, 'praise');
      expect(result).toContain('📊 Resumo de hoje (12/05)');
    });

    it('zero-pads day and month', () => {
      const result = formatDailyResume(new Date('2026-01-05T12:00:00'), baseMeals, baseTotals, baseGoals, 'praise');
      expect(result).toContain('(05/01)');
    });
  });

  describe('macros with goals', () => {
    it('shows total / goal for each macro', () => {
      const result = formatDailyResume(date, baseMeals, baseTotals, baseGoals, 'praise');
      expect(result).toContain('🔥 Calorias: 1.650 / 2.150');
      expect(result).toContain('🥩 Proteína: 120g / 160g');
      expect(result).toContain('🍚 Carboidrato: 200g / 240g');
      expect(result).toContain('🧈 Gordura: 50g / 72g');
    });

    it('shows remaining kcal in parentheses when below the calorie goal', () => {
      const result = formatDailyResume(date, baseMeals, baseTotals, baseGoals, 'praise');
      expect(result).toContain('(faltam 500)');
    });

    it('does NOT show "faltam" when total reached the goal', () => {
      const result = formatDailyResume(
        date,
        baseMeals,
        { ...baseTotals, calories: 2150 },
        baseGoals,
        'praise',
      );
      expect(result).not.toContain('(faltam');
    });

    it('rounds macros (gramas) to integers', () => {
      const result = formatDailyResume(
        date,
        baseMeals,
        { calories: 1000, protein: 45.6, carbs: 120.4, fat: 33.5 },
        baseGoals,
        'praise',
      );
      expect(result).toContain('46g');
      expect(result).toContain('120g');
      expect(result).toContain('34g');
    });
  });

  describe('macros without goals (user without onboarding complete)', () => {
    it('shows only total when calorie goal is null', () => {
      const result = formatDailyResume(date, baseMeals, baseTotals, { calorie: null, protein: 160, carbs: 240, fat: 72 }, 'praise');
      expect(result).toContain('🔥 Calorias: 1.650');
      expect(result).not.toContain('🔥 Calorias: 1.650 /');
    });

    it('renders each macro independently — partial goals are allowed', () => {
      const result = formatDailyResume(date, baseMeals, baseTotals, { calorie: 2150, protein: null, carbs: 240, fat: null }, 'praise');
      expect(result).toContain('🔥 Calorias: 1.650 / 2.150');
      expect(result).toContain('🥩 Proteína: 120g');
      expect(result).not.toContain('🥩 Proteína: 120g /');
    });
  });

  describe('meal list', () => {
    it('lists meals in BREAKFAST → LUNCH → SNACK → DINNER order', () => {
      const shuffled: DailyMeal[] = [
        { meal_type: 'DINNER',    calories: 350 },
        { meal_type: 'BREAKFAST', calories: 350 },
        { meal_type: 'SNACK',     calories: 200 },
        { meal_type: 'LUNCH',     calories: 750 },
      ];
      const result = formatDailyResume(date, shuffled, baseTotals, baseGoals, 'praise');
      const breakfastIdx = result.indexOf('Café');
      const lunchIdx     = result.indexOf('Almoço');
      const snackIdx     = result.indexOf('Lanche');
      const dinnerIdx    = result.indexOf('Jantar');
      expect(breakfastIdx).toBeLessThan(lunchIdx);
      expect(lunchIdx).toBeLessThan(snackIdx);
      expect(snackIdx).toBeLessThan(dinnerIdx);
    });

    it('groups multiple meals of the same type by summing their calories', () => {
      const twoLanches: DailyMeal[] = [
        { meal_type: 'SNACK', calories: 150 },
        { meal_type: 'SNACK', calories: 200 },
      ];
      const result = formatDailyResume(date, twoLanches, baseTotals, baseGoals, 'praise');
      expect(result).toContain('• Lanche: 350kcal');
      const lancheMatches = result.match(/• Lanche/g) ?? [];
      expect(lancheMatches.length).toBe(1);
    });

    it('shows "nenhuma refeição" placeholder when there are no meals', () => {
      const result = formatDailyResume(date, [], baseTotals, baseGoals, 'praise');
      expect(result).toContain('Nenhuma refeição registrada hoje');
      expect(result).not.toContain('Refeições:');
    });
  });

  describe('praise', () => {
    it('places the praise as the last line', () => {
      const result = formatDailyResume(date, baseMeals, baseTotals, baseGoals, 'Faltam só 500kcal!');
      const lines = result.split('\n');
      expect(lines[lines.length - 1]).toBe('Faltam só 500kcal!');
    });
  });
});
