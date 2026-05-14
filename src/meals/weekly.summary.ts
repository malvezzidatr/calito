import { MealType } from '@prisma/client';
import { startOfDay, startOfDaysAgo } from './day-bounds';
import { DailyTotals } from './meal.praise';
import { DailyGoals, WeeklyDayStats, WeeklySummary } from './meal.format';

export type WeeklyMealRow = {
  created_at: Date;
  meal_type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const WITHIN_GOAL_MIN = 0.8;
const WITHIN_GOAL_MAX = 1.1;
const WEEK_LENGTH = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function emptyTotals(): DailyTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function isWithinCalorieGoal(calories: number, calorieGoal: number | null): boolean {
  if (calorieGoal === null || calorieGoal <= 0) return false;
  return calories >= calorieGoal * WITHIN_GOAL_MIN && calories <= calorieGoal * WITHIN_GOAL_MAX;
}

export function buildWeeklySummary(
  meals: WeeklyMealRow[],
  today: Date,
  goals: DailyGoals,
): WeeklySummary {
  const startDate = startOfDaysAgo(today, WEEK_LENGTH - 1);
  const endDate   = startOfDay(today);

  const dayInstants = Array.from(
    { length: WEEK_LENGTH },
    (_, i) => new Date(startDate.getTime() + i * DAY_MS),
  );

  const buckets = new Map<string, { totals: DailyTotals; hasMeals: boolean }>();
  for (const instant of dayInstants) {
    buckets.set(instant.toISOString(), { totals: emptyTotals(), hasMeals: false });
  }
  for (const meal of meals) {
    const key = startOfDay(meal.created_at).toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.hasMeals = true;
    bucket.totals.calories += meal.calories;
    bucket.totals.protein  += meal.protein;
    bucket.totals.carbs    += meal.carbs;
    bucket.totals.fat      += meal.fat;
  }

  const days: WeeklyDayStats[] = dayInstants.map((date) => {
    const { totals, hasMeals } = buckets.get(date.toISOString())!;
    return {
      date,
      totals,
      hasMeals,
      isWithinGoal: isWithinCalorieGoal(totals.calories, goals.calorie),
    };
  });

  const sum = days.reduce(
    (acc, d) => ({
      calories: acc.calories + d.totals.calories,
      protein:  acc.protein  + d.totals.protein,
      carbs:    acc.carbs    + d.totals.carbs,
      fat:      acc.fat      + d.totals.fat,
    }),
    emptyTotals(),
  );
  const averages: DailyTotals = {
    calories: sum.calories / WEEK_LENGTH,
    protein:  sum.protein  / WEEK_LENGTH,
    carbs:    sum.carbs    / WEEK_LENGTH,
    fat:      sum.fat      / WEEK_LENGTH,
  };

  const daysWithinGoal = days.filter((d) => d.isWithinGoal).length;

  let bestDay: WeeklyDayStats | undefined;
  if (goals.calorie !== null && goals.calorie > 0) {
    const goal = goals.calorie;
    let bestDistance = Infinity;
    for (const day of days) {
      if (!day.isWithinGoal) continue;
      const distance = Math.abs(day.totals.calories - goal);
      if (distance <= bestDistance) {
        bestDistance = distance;
        bestDay = day;
      }
    }
  }

  let highestDay: WeeklyDayStats | undefined;
  if (goals.calorie !== null && goals.calorie > 0) {
    const overshootThreshold = goals.calorie * WITHIN_GOAL_MAX;
    let maxKcal = -Infinity;
    for (const day of days) {
      if (!day.hasMeals) continue;
      if (day.totals.calories > overshootThreshold && day.totals.calories > maxKcal) {
        maxKcal = day.totals.calories;
        highestDay = day;
      }
    }
  }

  return { startDate, endDate, days, averages, daysWithinGoal, bestDay, highestDay };
}
