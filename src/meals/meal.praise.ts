import { MealExtraction } from '../ai/meal.prompt';

export type DailyTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Goals = {
  calorie: number | null;
  protein: number | null;
};

type PraiseContext = {
  totalsBefore: DailyTotals;
  totalsAfter:  DailyTotals;
  goals:        Goals;
  extraction:   MealExtraction;
};

const PROTEIN_PRAISES = [
  'Bastante proteína nessa, mandou bem! 🥩',
  'Boa! Seus músculos agradecem 💪',
  'Refeição proteica, top! 🔥',
  'Show, proteína no talo 💪🥩',
];

const CARB_PRAISES = [
  'Energia no talo! Bora gastar essa gasolina 🚀',
  'Carboidrato pra mover, anotado 🍚',
  'Boa pra antes do treino! 💪',
  'Combustível pro dia, mandou bem 🔥',
];

const BALANCED_PRAISES = [
  'Refeição equilibrada, mandou bem! 💪',
  'Show! Macros bem distribuídos 🎯',
  'Tá afiado! Boa combinação 🔥',
  'Boa, tudo no lugar 👌',
  'Mandou bem, anotado 📝',
];

const HEAVY_PRAISES = [
  'Anotado! Hoje foi mais reforçado 👀',
  'Beleza, registrei tudo 📝',
  'Refeição mais densa, anotei 👌',
  'Registrado! Fica de olho na meta do dia 🎯',
  'Anotado, refeição cheia 📝',
];

const HEAVY_THRESHOLD = 700;

function justCrossed(before: number, after: number, goal: number | null): boolean {
  return goal !== null && before < goal && after >= goal;
}

export function subtractMeal(totals: DailyTotals, m: MealExtraction): DailyTotals {
  return {
    calories: totals.calories - m.calories,
    protein:  totals.protein  - m.protein,
    carbs:    totals.carbs    - m.carbs,
    fat:      totals.fat      - m.fat,
  };
}

export function pickGoalAwarePraise(ctx: PraiseContext): string {
  const { totalsBefore, totalsAfter, goals, extraction } = ctx;

  if (justCrossed(totalsBefore.protein, totalsAfter.protein, goals.protein)) {
    return 'Proteína do dia batida! Seus músculos agradecem 🔥';
  }

  if (justCrossed(totalsBefore.calories, totalsAfter.calories, goals.calorie)) {
    return 'Meta calórica batida! Mandou bem hoje 💪';
  }

  if (goals.calorie && totalsAfter.calories >= goals.calorie * 1.10) {
    return 'Passou um pouco da meta hoje, mas amanhã é um novo dia! Bora 🚀';
  }

  if (goals.calorie && totalsAfter.calories >= goals.calorie * 0.80 && totalsAfter.calories < goals.calorie) {
    const faltam = goals.calorie - totalsAfter.calories;
    return `Faltam só ${faltam}kcal, quase lá! Termina o dia forte 💪`;
  }

  return pickPraise(extraction);
}

export function pickPraise(extraction: MealExtraction): string {
  const totalKcal = extraction.calories || 1;

  let pool: readonly string[];
  if (totalKcal >= HEAVY_THRESHOLD) {
    pool = HEAVY_PRAISES;
  } else {
    const proteinPct = (extraction.protein * 4) / totalKcal;
    const carbsPct = (extraction.carbs * 4) / totalKcal;
    if (proteinPct >= 0.40) pool = PROTEIN_PRAISES;
    else if (carbsPct >= 0.55) pool = CARB_PRAISES;
    else pool = BALANCED_PRAISES;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
