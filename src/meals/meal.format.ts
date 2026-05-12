import { MealType } from '@prisma/client';
import { MealExtraction } from '../ai/meal.prompt';
import { DailyTotals } from './meal.praise';

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Café',
  LUNCH:     'Almoço',
  DINNER:    'Jantar',
  SNACK:     'Lanche',
};

const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];

export type DailyGoals = {
  calorie: number | null;
  protein: number | null;
  carbs:   number | null;
  fat:     number | null;
};

export type DailyMeal = { meal_type: MealType; calories: number };

export function formatMealConfirmation(mealType: MealType, extraction: MealExtraction, praise: string): string {
  const label = MEAL_LABELS[mealType];
  return [
    `✓ ${label} — ${extraction.calories}kcal`,
    `🥩 P: ${extraction.protein}g`,
    `🍚 C: ${extraction.carbs}g`,
    `🧈 G: ${extraction.fat}g`,
    praise,
  ].join('\n');
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function macroLine(emoji: string, label: string, total: number, goal: number | null, unit: 'kcal' | 'g'): string {
  const totalStr = unit === 'kcal' ? total.toLocaleString('pt-BR') : `${total}g`;
  if (goal === null) {
    return `${emoji} ${label}: ${totalStr}`;
  }
  const goalStr = unit === 'kcal' ? goal.toLocaleString('pt-BR') : `${goal}g`;
  const base = `${emoji} ${label}: ${totalStr} / ${goalStr}`;
  if (unit === 'kcal' && total < goal) {
    return `${base} (faltam ${(goal - total).toLocaleString('pt-BR')})`;
  }
  return base;
}

function summarizeMealsByType(meals: DailyMeal[]): Array<{ type: MealType; calories: number }> {
  const sums = new Map<MealType, number>();
  for (const m of meals) {
    sums.set(m.meal_type, (sums.get(m.meal_type) ?? 0) + m.calories);
  }
  return MEAL_ORDER
    .filter((t) => sums.has(t))
    .map((t) => ({ type: t, calories: sums.get(t)! }));
}

export function formatDailyResume(
  date: Date,
  meals: DailyMeal[],
  totals: DailyTotals,
  goals: DailyGoals,
  praise: string,
): string {
  const lines: string[] = [
    `📊 Resumo de hoje (${formatDate(date)})`,
    '',
    macroLine('🔥', 'Calorias',     totals.calories, goals.calorie, 'kcal'),
    macroLine('🥩', 'Proteína',     Math.round(totals.protein), goals.protein, 'g'),
    macroLine('🍚', 'Carboidrato',  Math.round(totals.carbs),   goals.carbs,   'g'),
    macroLine('🧈', 'Gordura',      Math.round(totals.fat),     goals.fat,     'g'),
  ];

  const summarized = summarizeMealsByType(meals);
  if (summarized.length > 0) {
    lines.push('', 'Refeições:');
    for (const m of summarized) {
      lines.push(`• ${MEAL_LABELS[m.type]}: ${m.calories}kcal`);
    }
  } else {
    lines.push('', 'Nenhuma refeição registrada hoje 🍽️');
  }

  lines.push('', praise);
  return lines.join('\n');
}
