import {
  formatDailyResume,
  formatMealConfirmation,
  formatWeeklyResume,
  formatMacroResume,
  formatDeleteConfirmation,
  EMPTY_DELETE_MESSAGE,
  DailyMeal,
  DailyGoals,
  WeeklyDayStats,
  WeeklySummary,
} from '../meal.format';
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
  const sampleExtraction = {
    description: 'arroz e frango',
    calories: 650,
    protein: 45,
    carbs: 75,
    fat: 12,
    meal_type: 'LUNCH' as const,
  };

  it('formats lunch with calories, macros and the provided praise', () => {
    const result = formatMealConfirmation('LUNCH', sampleExtraction, 'Mandou bem!');
    expect(result).toContain('Almoço');
    expect(result).toContain('650kcal');
    expect(result).toContain('P: 45g');
    expect(result).toContain('C: 75g');
    expect(result).toContain('G: 12g');
    expect(result).toContain('Mandou bem!');
  });

  it.each([
    ['BREAKFAST', 'Café'],
    ['DINNER',    'Jantar'],
    ['SNACK',     'Lanche'],
  ] as const)('uses label "%s" for meal_type %s', (mealType, label) => {
    const result = formatMealConfirmation(mealType, sampleExtraction, 'praise');
    expect(result).toContain(label);
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

  describe('empty day (totals.calories === 0)', () => {
    const zeroTotals: DailyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

    it('returns header + empty-day message and skips macros, meal list and praise', () => {
      const result = formatDailyResume(date, [], zeroTotals, baseGoals, 'praise-ignored');
      expect(result).toContain('📊 Resumo de hoje (12/05)');
      expect(result).toContain('Você ainda não registrou nada hoje');
      expect(result).toContain('Me manda o que comeu');
      expect(result).not.toContain('🔥 Calorias');
      expect(result).not.toContain('praise-ignored');
    });
  });
});

describe('formatWeeklyResume', () => {
  const goalsFull: DailyGoals = { calorie: 2150, protein: 160, carbs: 240, fat: 72 };
  const goalsNoCalorie: DailyGoals = { calorie: null, protein: null, carbs: null, fat: null };

  function makeDay(iso: string, calories: number, opts: { hasMeals?: boolean; isWithinGoal?: boolean } = {}): WeeklyDayStats {
    return {
      date: new Date(iso),
      totals: { calories, protein: 130, carbs: 220, fat: 55 },
      hasMeals: opts.hasMeals ?? true,
      isWithinGoal: opts.isWithinGoal ?? true,
    };
  }

  it('formats a full weekly resume with header, averages, days-within-goal, best and highest day', () => {
    const summary: WeeklySummary = {
      startDate: new Date('2026-05-06T03:00:00Z'),
      endDate:   new Date('2026-05-12T03:00:00Z'),
      days: [
        makeDay('2026-05-06T03:00:00Z', 2000),
        makeDay('2026-05-07T03:00:00Z', 2050),
        makeDay('2026-05-08T03:00:00Z', 1800),
        makeDay('2026-05-09T03:00:00Z', 2800, { isWithinGoal: false }),
        makeDay('2026-05-10T03:00:00Z', 1500, { isWithinGoal: false }),
        makeDay('2026-05-11T03:00:00Z', 1900),
        makeDay('2026-05-12T03:00:00Z', 2100),
      ],
      averages: { calories: 2021.4, protein: 125, carbs: 220, fat: 56 },
      daysWithinGoal: 5,
      bestDay: makeDay('2026-05-12T03:00:00Z', 2100),
      highestDay: makeDay('2026-05-09T03:00:00Z', 2800, { isWithinGoal: false }),
    };

    const result = formatWeeklyResume(summary, goalsFull, 'Semana sólida! 🏆');

    expect(result).toContain('📊 Resumo da semana (06/05 - 12/05)');
    expect(result).toContain('Média diária: 2.021kcal');
    expect(result).toContain('Meta: 2.150kcal');
    expect(result).toContain('Dias dentro da meta: 5 de 7 ✅');
    expect(result).toContain('🥩 Proteína média: 125g/dia');
    expect(result).toContain('🍚 Carboidrato médio: 220g/dia');
    expect(result).toContain('🧈 Gordura média: 56g/dia');
    expect(result).toContain('Melhor dia: Terça (2.100kcal)');
    expect(result).toContain('Dia mais alto: Sábado (2.800kcal)');
    expect(result).toContain('Semana sólida! 🏆');
  });

  it('returns the empty-week placeholder + praise when no day has meals', () => {
    const days: WeeklyDayStats[] = Array.from({ length: 7 }, (_, i) => {
      const day = 6 + i;
      return makeDay(`2026-05-${String(day).padStart(2, '0')}T03:00:00Z`, 0, { hasMeals: false, isWithinGoal: false });
    });
    const summary: WeeklySummary = {
      startDate: new Date('2026-05-06T03:00:00Z'),
      endDate:   new Date('2026-05-12T03:00:00Z'),
      days,
      averages: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      daysWithinGoal: 0,
    };

    const result = formatWeeklyResume(summary, goalsFull, 'Bora começar a registrar 🚀');

    expect(result).toContain('Nenhuma refeição registrada essa semana 🍽️');
    expect(result).toContain('Bora começar a registrar 🚀');
    expect(result).not.toContain('Média diária');
    expect(result).not.toContain('Melhor dia');
  });

  it('omits the Meta line and within-goal count when calorieGoal is null', () => {
    const summary: WeeklySummary = {
      startDate: new Date('2026-05-06T03:00:00Z'),
      endDate:   new Date('2026-05-12T03:00:00Z'),
      days: [makeDay('2026-05-12T03:00:00Z', 2000, { isWithinGoal: false })],
      averages: { calories: 2000, protein: 130, carbs: 220, fat: 55 },
      daysWithinGoal: 0,
    };

    const result = formatWeeklyResume(summary, goalsNoCalorie, 'Tô anotando 📝');

    expect(result).toContain('Média diária: 2.000kcal');
    expect(result).not.toContain('Meta:');
    expect(result).not.toContain('Dias dentro da meta');
    expect(result).toContain('Tô anotando 📝');
  });

  it('omits the Melhor / Dia mais alto block when both are undefined', () => {
    const summary: WeeklySummary = {
      startDate: new Date('2026-05-06T03:00:00Z'),
      endDate:   new Date('2026-05-12T03:00:00Z'),
      days: [makeDay('2026-05-12T03:00:00Z', 1500, { isWithinGoal: false })],
      averages: { calories: 1500, protein: 100, carbs: 180, fat: 45 },
      daysWithinGoal: 0,
    };

    const result = formatWeeklyResume(summary, goalsFull, 'Bora apertar 💪');

    expect(result).not.toContain('Melhor dia');
    expect(result).not.toContain('Dia mais alto');
  });

  it('omits the ✅ emoji when daysWithinGoal is below 5', () => {
    const summary: WeeklySummary = {
      startDate: new Date('2026-05-06T03:00:00Z'),
      endDate:   new Date('2026-05-12T03:00:00Z'),
      days: Array.from({ length: 7 }, (_, i) => makeDay(`2026-05-${String(6 + i).padStart(2, '0')}T03:00:00Z`, 2000)),
      averages: { calories: 2000, protein: 130, carbs: 220, fat: 55 },
      daysWithinGoal: 3,
    };

    const result = formatWeeklyResume(summary, goalsFull, 'Boa semana 💪');

    expect(result).toContain('Dias dentro da meta: 3 de 7');
    expect(result).not.toContain('Dias dentro da meta: 3 de 7 ✅');
  });
});

describe('formatMacroResume', () => {
  it.each([
    ['protein', 95,  160, 'Proteína',    '🥩 Proteína: 95g / 160g (faltam 65g)'],
    ['carbs',   200, 240, 'Carboidrato', '🍚 Carboidrato: 200g / 240g (faltam 40g)'],
    ['fat',     50,  72,  'Gordura',     '🧈 Gordura: 50g / 72g (faltam 22g)'],
  ] as const)('formats %s below goal with header, embedded "faltam" and generic praise', (macro, total, goal, headerLabel, dataLine) => {
    const result = formatMacroResume(macro, total, goal, date);
    expect(result).toContain(`📊 ${headerLabel} de hoje (12/05)`);
    expect(result).toContain(dataLine);
    expect(result).toContain('Bora completar essa meta!');
    expect(result).toContain('💪');
  });

  it('shows "Meta batida!" when total reaches the goal exactly', () => {
    const result = formatMacroResume('protein', 160, 160, date);
    expect(result).toContain('📊 Proteína de hoje (12/05)');
    expect(result).toContain('🥩 Proteína: 160g / 160g');
    expect(result).toContain('Meta batida');
    expect(result).not.toContain('faltam');
  });

  it('shows "Meta batida!" when total goes over the goal', () => {
    const result = formatMacroResume('protein', 200, 160, date);
    expect(result).toContain('🥩 Proteína: 200g / 160g');
    expect(result).toContain('Meta batida');
  });

  it('rounds float totals to integers (Prisma decimals)', () => {
    const result = formatMacroResume('carbs', 199.7, 240, date);
    expect(result).toContain('🍚 Carboidrato: 200g / 240g (faltam 40g)');
  });

  it('shows the no-goal fallback message when goal is null', () => {
    const result = formatMacroResume('fat', 30, null, date);
    expect(result).toContain('📊 Gordura de hoje (12/05)');
    expect(result).toContain('🧈 Gordura: 30g');
    expect(result).toContain('Quando você fechar suas metas no onboarding');
    expect(result).not.toContain('/ ');
    expect(result).not.toContain('faltam');
  });

  describe('calorie unit', () => {
    it('formats calorie totals with the 🔥 emoji, no g suffix and pt-BR thousand separators', () => {
      const result = formatMacroResume('calorie', 420, 2282, date);
      expect(result).toContain('📊 Calorias de hoje (12/05)');
      expect(result).toContain('🔥 Calorias: 420 / 2.282 (faltam 1.862)');
      expect(result).not.toContain('kcal');
    });

    it('shows "Meta batida" when calorie total reaches the goal', () => {
      const result = formatMacroResume('calorie', 2300, 2282, date);
      expect(result).toContain('🔥 Calorias: 2.300 / 2.282');
      expect(result).toContain('Meta batida');
    });

    it('shows the no-goal fallback for calorie without unit suffix', () => {
      const result = formatMacroResume('calorie', 1500, null, date);
      expect(result).toContain('🔥 Calorias: 1.500');
      expect(result).toContain('Quando você fechar suas metas no onboarding');
      expect(result).not.toContain('1.500g');
    });
  });

  describe('empty day (total rounds to 0)', () => {
    it.each([
      ['calorie', 'Calorias'],
      ['protein', 'Proteína'],
      ['carbs',   'Carboidrato'],
      ['fat',     'Gordura'],
    ] as const)('returns header + empty-day message for %s when total is 0', (macro, headerLabel) => {
      const result = formatMacroResume(macro, 0, 2000, date);
      expect(result).toContain(`📊 ${headerLabel} de hoje (12/05)`);
      expect(result).toContain('Você ainda não registrou nada hoje');
      expect(result).toContain('Me manda o que comeu');
      expect(result).not.toContain('faltam');
      expect(result).not.toContain('Meta batida');
    });

    it('returns the empty-day message even when goal is null (empty wins over no-goal fallback)', () => {
      const result = formatMacroResume('protein', 0, null, date);
      expect(result).toContain('📊 Proteína de hoje (12/05)');
      expect(result).toContain('Você ainda não registrou nada hoje');
      expect(result).not.toContain('onboarding');
    });

    it('returns the empty-day message when a fractional total rounds to 0', () => {
      const result = formatMacroResume('protein', 0.3, 160, date);
      expect(result).toContain('Você ainda não registrou nada hoje');
    });
  });
});

describe('formatDeleteConfirmation', () => {
  it.each([
    ['BREAKFAST', 350, 'Apaguei seu Café de 350kcal 🗑️'],
    ['LUNCH',     750, 'Apaguei seu Almoço de 750kcal 🗑️'],
    ['SNACK',     200, 'Apaguei seu Lanche de 200kcal 🗑️'],
    ['DINNER',    420, 'Apaguei seu Jantar de 420kcal 🗑️'],
  ] as const)('formats deletion confirmation for %s with the right label and kcal', (mealType, calories, expected) => {
    expect(formatDeleteConfirmation(mealType, calories)).toBe(expected);
  });
});

describe('EMPTY_DELETE_MESSAGE', () => {
  it('is a friendly message that mentions there is nothing to delete', () => {
    expect(EMPTY_DELETE_MESSAGE).toContain('apagar');
    expect(EMPTY_DELETE_MESSAGE).toMatch(/🤔|🙂/);
  });
});
