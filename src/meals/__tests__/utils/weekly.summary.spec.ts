import { MealType } from '@prisma/client';
import { buildWeeklySummary, WeeklyMealRow } from '../../utils/weekly.summary';
import { DailyGoals } from '../../utils/meal.format';

const today = new Date('2026-05-12T15:00:00Z'); // 12/05 12h SP (Tuesday)
const goals2150: DailyGoals = { calorie: 2150, protein: 160, carbs: 240, fat: 72 };
const goalsNoCalorie: DailyGoals = { calorie: null, protein: 160, carbs: 240, fat: 72 };

function makeMeal(iso: string, calories: number, opts: Partial<WeeklyMealRow> = {}): WeeklyMealRow {
  return {
    created_at: new Date(iso),
    meal_type: 'LUNCH' as MealType,
    calories,
    protein: 30,
    carbs: 40,
    fat: 10,
    ...opts,
  };
}

describe('buildWeeklySummary', () => {
  describe('bucketing', () => {
    it('creates 7 day buckets in chronological order ending on today (SP)', () => {
      const summary = buildWeeklySummary([], today, goals2150);
      expect(summary.days).toHaveLength(7);
      expect(summary.days[0].date.toISOString()).toBe('2026-05-06T03:00:00.000Z');
      expect(summary.days[6].date.toISOString()).toBe('2026-05-12T03:00:00.000Z');
      expect(summary.startDate.toISOString()).toBe('2026-05-06T03:00:00.000Z');
      expect(summary.endDate.toISOString()).toBe('2026-05-12T03:00:00.000Z');
    });

    it('buckets meals by SP day, not UTC day (handles meals logged near midnight SP)', () => {
      // 12/05 02:30 UTC = 11/05 23:30 SP → should land in 11/05 bucket
      const meal = makeMeal('2026-05-12T02:30:00Z', 500);
      const summary = buildWeeklySummary([meal], today, goals2150);
      expect(summary.days[5].totals.calories).toBe(500);
      expect(summary.days[5].hasMeals).toBe(true);
      expect(summary.days[6].totals.calories).toBe(0);
      expect(summary.days[6].hasMeals).toBe(false);
    });

    it('sums multiple meals on the same day', () => {
      const meals = [
        makeMeal('2026-05-09T13:00:00Z', 700, { protein: 50, carbs: 80, fat: 20 }),
        makeMeal('2026-05-09T20:00:00Z', 500, { protein: 30, carbs: 60, fat: 15 }),
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.days[3].totals).toEqual({ calories: 1200, protein: 80, carbs: 140, fat: 35 });
      expect(summary.days[3].hasMeals).toBe(true);
    });

    it('marks empty days with hasMeals=false and totals zeroed', () => {
      const summary = buildWeeklySummary([], today, goals2150);
      for (const day of summary.days) {
        expect(day.hasMeals).toBe(false);
        expect(day.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
    });

    it('silently ignores meals outside the 7-day window (defensive)', () => {
      const meal = makeMeal('2026-05-05T15:00:00Z', 999);
      const summary = buildWeeklySummary([meal], today, goals2150);
      expect(summary.days.every((d) => !d.hasMeals)).toBe(true);
    });
  });

  describe('averages', () => {
    it('divides total by 7, counting empty days as 0', () => {
      const meals = [makeMeal('2026-05-12T13:00:00Z', 700, { protein: 70, carbs: 70, fat: 14 })];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.averages.calories).toBe(100);
      expect(summary.averages.protein).toBe(10);
    });

    it('returns raw (unrounded) averages — rounding is the formatter responsibility', () => {
      const meals = [makeMeal('2026-05-12T13:00:00Z', 1000)];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.averages.calories).toBeCloseTo(142.857, 2);
    });
  });

  describe('daysWithinGoal', () => {
    it('counts days where calories are in [80%, 110%] of the calorie goal', () => {
      // goal 2150 → within = [1720, 2365]
      const meals = [
        makeMeal('2026-05-06T13:00:00Z', 2000), // within
        makeMeal('2026-05-07T13:00:00Z', 2300), // within
        makeMeal('2026-05-08T13:00:00Z', 1800), // within
        makeMeal('2026-05-09T13:00:00Z', 2500), // overshoot
        makeMeal('2026-05-10T13:00:00Z', 1500), // under
        makeMeal('2026-05-11T13:00:00Z', 2100), // within
        makeMeal('2026-05-12T13:00:00Z', 2100), // within
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.daysWithinGoal).toBe(5);
    });

    it('returns 0 when calorieGoal is null', () => {
      const meals = [makeMeal('2026-05-12T13:00:00Z', 2000)];
      const summary = buildWeeklySummary(meals, today, goalsNoCalorie);
      expect(summary.daysWithinGoal).toBe(0);
      expect(summary.days.every((d) => !d.isWithinGoal)).toBe(true);
    });

    it('does not count empty days as within goal', () => {
      const summary = buildWeeklySummary([], today, goals2150);
      expect(summary.daysWithinGoal).toBe(0);
    });
  });

  describe('bestDay', () => {
    it('picks the within-goal day closest to 100% of the calorie goal', () => {
      const meals = [
        makeMeal('2026-05-06T13:00:00Z', 1800), // |1800-2150|=350
        makeMeal('2026-05-07T13:00:00Z', 2100), // |2100-2150|=50 ← best
        makeMeal('2026-05-08T13:00:00Z', 2300), // |2300-2150|=150
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.bestDay?.date.toISOString()).toBe('2026-05-07T03:00:00.000Z');
    });

    it('tie-breaks toward the most recent day', () => {
      const meals = [
        makeMeal('2026-05-06T13:00:00Z', 2100),
        makeMeal('2026-05-11T13:00:00Z', 2100),
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.bestDay?.date.toISOString()).toBe('2026-05-11T03:00:00.000Z');
    });

    it('is undefined when no day is within goal', () => {
      const meals = [
        makeMeal('2026-05-06T13:00:00Z', 1000), // under 80%
        makeMeal('2026-05-07T13:00:00Z', 3000), // over 110%
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.bestDay).toBeUndefined();
    });

    it('is undefined when calorieGoal is null', () => {
      const meals = [makeMeal('2026-05-12T13:00:00Z', 2100)];
      const summary = buildWeeklySummary(meals, today, goalsNoCalorie);
      expect(summary.bestDay).toBeUndefined();
    });
  });

  describe('highestDay', () => {
    it('picks the max-kcal day only when it overshoots (>110% of goal)', () => {
      // 110% of 2150 = 2365
      const meals = [
        makeMeal('2026-05-06T13:00:00Z', 2200), // within
        makeMeal('2026-05-09T13:00:00Z', 2800), // overshoot ← max
        makeMeal('2026-05-12T13:00:00Z', 2400), // overshoot but lower
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.highestDay?.date.toISOString()).toBe('2026-05-09T03:00:00.000Z');
      expect(summary.highestDay?.totals.calories).toBe(2800);
    });

    it('is undefined when no day overshot', () => {
      const meals = [
        makeMeal('2026-05-06T13:00:00Z', 2000),
        makeMeal('2026-05-12T13:00:00Z', 2300),
      ];
      const summary = buildWeeklySummary(meals, today, goals2150);
      expect(summary.highestDay).toBeUndefined();
    });

    it('is undefined when calorieGoal is null even when daily totals are huge', () => {
      const meals = [makeMeal('2026-05-12T13:00:00Z', 5000)];
      const summary = buildWeeklySummary(meals, today, goalsNoCalorie);
      expect(summary.highestDay).toBeUndefined();
    });
  });
});
