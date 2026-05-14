import { MealType } from '@prisma/client';
import { MealExtraction } from '../ai/meal.prompt';
import { DailyTotals } from './meal.praise';
import { Macro } from './macro.detect';

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

export type WeeklyDayStats = {
  date: Date;
  totals: DailyTotals;
  hasMeals: boolean;
  isWithinGoal: boolean;
};

export type WeeklySummary = {
  startDate: Date;
  endDate: Date;
  days: WeeklyDayStats[];
  averages: DailyTotals;
  daysWithinGoal: number;
  bestDay?: WeeklyDayStats;
  highestDay?: WeeklyDayStats;
};

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
});

const WEEKDAY_LABELS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const MACRO_LABELS: Record<Macro, { emoji: string; label: string; unit: 'g' | '' }> = {
  calorie: { emoji: '🔥', label: 'Calorias',    unit: ''  },
  protein: { emoji: '🥩', label: 'Proteína',    unit: 'g' },
  carbs:   { emoji: '🍚', label: 'Carboidrato', unit: 'g' },
  fat:     { emoji: '🧈', label: 'Gordura',     unit: 'g' },
};

const EMPTY_DAY_MESSAGE = 'Você ainda não registrou nada hoje 🍽️\n\nMe manda o que comeu que eu calculo tudo pra você 💪';

function formatShortDate(d: Date): string {
  return shortDateFormatter.format(d);
}

function formatWeekday(spDayStart: Date): string {
  return WEEKDAY_LABELS_PT[spDayStart.getUTCDay()];
}

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
  if (totals.calories === 0) {
    return EMPTY_DAY_MESSAGE;
  }

  const lines: string[] = [
    `📊 Resumo de hoje (${formatShortDate(date)})`,
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

export function formatWeeklyResume(
  summary: WeeklySummary,
  goals: DailyGoals,
  praise: string,
): string {
  const header = `📊 Resumo da semana (${formatShortDate(summary.startDate)} - ${formatShortDate(summary.endDate)})`;

  const hasAnyMeal = summary.days.some((d) => d.hasMeals);
  if (!hasAnyMeal) {
    return [header, '', 'Nenhuma refeição registrada essa semana 🍽️', '', praise].join('\n');
  }

  const lines: string[] = [header, ''];

  lines.push(`Média diária: ${Math.round(summary.averages.calories).toLocaleString('pt-BR')}kcal`);

  if (goals.calorie !== null) {
    lines.push(`Meta: ${goals.calorie.toLocaleString('pt-BR')}kcal`);
    const emoji = summary.daysWithinGoal >= 5 ? ' ✅' : '';
    lines.push(`Dias dentro da meta: ${summary.daysWithinGoal} de ${summary.days.length}${emoji}`);
  }

  lines.push('');
  lines.push(`🥩 Proteína média: ${Math.round(summary.averages.protein)}g/dia`);
  lines.push(`🍚 Carboidrato médio: ${Math.round(summary.averages.carbs)}g/dia`);
  lines.push(`🧈 Gordura média: ${Math.round(summary.averages.fat)}g/dia`);

  if (summary.bestDay || summary.highestDay) {
    lines.push('');
    if (summary.bestDay) {
      lines.push(`Melhor dia: ${formatWeekday(summary.bestDay.date)} (${summary.bestDay.totals.calories.toLocaleString('pt-BR')}kcal)`);
    }
    if (summary.highestDay) {
      lines.push(`Dia mais alto: ${formatWeekday(summary.highestDay.date)} (${summary.highestDay.totals.calories.toLocaleString('pt-BR')}kcal)`);
    }
  }

  lines.push('', praise);
  return lines.join('\n');
}

export function formatMacroResume(macro: Macro, total: number, goal: number | null): string {
  const { emoji, label, unit } = MACRO_LABELS[macro];
  const isKcal = macro === 'calorie';
  const totalRounded = Math.round(total);
  const fmt = (n: number) => (isKcal ? n.toLocaleString('pt-BR') : String(n));

  if (totalRounded === 0) {
    return EMPTY_DAY_MESSAGE;
  }

  if (goal === null) {
    return `${emoji} ${label}: ${fmt(totalRounded)}${unit} hoje\n\nQuando você fechar suas metas no onboarding, comparo aqui 📝`;
  }

  const baseLine = `${emoji} ${label}: ${fmt(totalRounded)}${unit} / ${fmt(goal)}${unit}`;

  if (totalRounded >= goal) {
    return `${baseLine}\n\nMeta batida! Mandou bem 💪`;
  }

  const faltam = goal - totalRounded;
  return `${baseLine}\n\nFaltam ${fmt(faltam)}${unit}, bora completar! 💪`;
}