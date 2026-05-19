import { pickGoalAwarePraise, pickPraise, pickDailyResumePraise, pickWeeklyResumePraise, subtractMeal } from '../../utils/meal.praise';
import { MealExtraction } from '../../../ai/prompts/meal.prompt';

const baseExtraction: MealExtraction = {
  description: 'arroz e frango',
  calories: 200,
  protein: 15,
  carbs: 25,
  fat: 5,
  meal_type: null,
};

const goals = { calorie: 2000, protein: 100 };

describe('pickGoalAwarePraise', () => {
  describe('protein milestone', () => {
    it('fires when this meal pushes daily protein from below to at-or-above goal', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1500, protein: 95, carbs: 150, fat: 50 },
        totalsAfter:  { calories: 1700, protein: 110, carbs: 175, fat: 55 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Proteína do dia batida! Seus músculos agradecem 🔥');
    });

    it('fires when daily protein lands exactly on the goal', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1500, protein: 85, carbs: 150, fat: 50 },
        totalsAfter:  { calories: 1700, protein: 100, carbs: 175, fat: 55 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Proteína do dia batida! Seus músculos agradecem 🔥');
    });

    it('does not fire when daily protein was already above goal before this meal', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1500, protein: 105, carbs: 150, fat: 50 },
        totalsAfter:  { calories: 1700, protein: 120, carbs: 175, fat: 55 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).not.toContain('Proteína do dia batida');
    });

    it('skips protein milestone silently when goal.protein is null', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1500, protein: 95, carbs: 150, fat: 50 },
        totalsAfter:  { calories: 1700, protein: 110, carbs: 175, fat: 55 },
        goals: { calorie: 2000, protein: null },
        extraction: baseExtraction,
      });
      expect(result).not.toContain('Proteína do dia batida');
    });
  });

  describe('calorie milestone', () => {
    it('fires when this meal pushes daily calories from below to at-or-above goal', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1850, protein: 80, carbs: 200, fat: 60 },
        totalsAfter:  { calories: 2050, protein: 95, carbs: 225, fat: 65 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Meta calórica batida! Mandou bem hoje 💪');
    });

    it('protein milestone wins over calorie milestone when both fire', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1850, protein: 95, carbs: 200, fat: 60 },
        totalsAfter:  { calories: 2050, protein: 110, carbs: 225, fat: 65 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Proteína do dia batida! Seus músculos agradecem 🔥');
    });
  });

  describe('overshoot (>=110% kcal)', () => {
    it('fires when daily calories already past 110% of goal', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 2100, protein: 120, carbs: 250, fat: 75 },
        totalsAfter:  { calories: 2300, protein: 135, carbs: 275, fat: 80 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Passou um pouco da meta hoje, mas amanhã é um novo dia! Bora 🚀');
    });

    it('fires exactly at 110%', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 2000, protein: 120, carbs: 250, fat: 75 },
        totalsAfter:  { calories: 2200, protein: 135, carbs: 275, fat: 80 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Passou um pouco da meta hoje, mas amanhã é um novo dia! Bora 🚀');
    });
  });

  describe('close to goal (80-99% kcal)', () => {
    it('fires with remaining kcal when daily total is between 80% and 100% of goal', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1500, protein: 80, carbs: 180, fat: 50 },
        totalsAfter:  { calories: 1700, protein: 95, carbs: 205, fat: 55 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Faltam só 300kcal, quase lá! Termina o dia forte 💪');
    });

    it('fires exactly at 80%', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1400, protein: 80, carbs: 180, fat: 50 },
        totalsAfter:  { calories: 1600, protein: 95, carbs: 205, fat: 55 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Faltam só 400kcal, quase lá! Termina o dia forte 💪');
    });

    it('does not fire when total reaches exactly 100% of goal (that is the calorie milestone instead)', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1800, protein: 80, carbs: 200, fat: 60 },
        totalsAfter:  { calories: 2000, protein: 95, carbs: 225, fat: 65 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe('Meta calórica batida! Mandou bem hoje 💪');
    });
  });

  describe('fallback to pickPraise', () => {
    beforeEach(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('falls back to pool-based praise when no milestone fires (early in the day)', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 200, protein: 15, carbs: 25, fat: 5 },
        totalsAfter:  { calories: 400, protein: 30, carbs: 50, fat: 10 },
        goals,
        extraction: baseExtraction,
      });
      expect(result).toBe(pickPraise(baseExtraction));
    });

    it('falls back when both goals are null', () => {
      const result = pickGoalAwarePraise({
        totalsBefore: { calories: 1800, protein: 95, carbs: 200, fat: 60 },
        totalsAfter:  { calories: 2000, protein: 110, carbs: 225, fat: 65 },
        goals: { calorie: null, protein: null },
        extraction: baseExtraction,
      });
      expect(result).toBe(pickPraise(baseExtraction));
    });
  });
});

describe('subtractMeal', () => {
  it('subtracts each macro of the meal from the daily totals', () => {
    const totals = { calories: 1700, protein: 110, carbs: 175, fat: 55 };
    const result = subtractMeal(totals, baseExtraction);
    expect(result).toEqual({
      calories: 1500,
      protein: 95,
      carbs: 150,
      fat: 50,
    });
  });

  it('handles the first meal of the day (totals equal extraction macros)', () => {
    const totals = { calories: 200, protein: 15, carbs: 25, fat: 5 };
    const result = subtractMeal(totals, baseExtraction);
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('pickDailyResumePraise', () => {
  it('returns "ainda dá tempo" when below 80% of the calorie goal', () => {
    const result = pickDailyResumePraise({ totalCalories: 800, calorieGoal: 2000 });
    expect(result).toBe('Ainda dá tempo de completar a meta! 🚀');
  });

  it('returns remaining-kcal message when between 80% and 99% of the goal', () => {
    const result = pickDailyResumePraise({ totalCalories: 1800, calorieGoal: 2000 });
    expect(result).toBe('Faltam só 200kcal pra fechar a meta! Termina o dia forte 💪');
  });

  it('returns "faltam" exactly at 80%', () => {
    const result = pickDailyResumePraise({ totalCalories: 1600, calorieGoal: 2000 });
    expect(result).toContain('Faltam só 400kcal');
  });

  it('returns "meta batida" when total reaches exactly the goal', () => {
    const result = pickDailyResumePraise({ totalCalories: 2000, calorieGoal: 2000 });
    expect(result).toBe('Meta calórica batida! Mandou bem 💪');
  });

  it('returns "meta batida" between 100% and 110%', () => {
    const result = pickDailyResumePraise({ totalCalories: 2150, calorieGoal: 2000 });
    expect(result).toBe('Meta calórica batida! Mandou bem 💪');
  });

  it('returns "passou um pouco" at or above 110%', () => {
    const result = pickDailyResumePraise({ totalCalories: 2200, calorieGoal: 2000 });
    expect(result).toBe('Passou um pouco da meta hoje, mas tá tranquilo — amanhã é dia novo 🌅');
  });

  it('returns a goal-less fallback message when calorieGoal is null', () => {
    const result = pickDailyResumePraise({ totalCalories: 1500, calorieGoal: null });
    expect(result).toContain('Tô anotando');
  });

  it('returns a goal-less fallback message when calorieGoal is 0', () => {
    const result = pickDailyResumePraise({ totalCalories: 1500, calorieGoal: 0 });
    expect(result).toContain('Tô anotando');
  });
});

describe('pickPraise', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('picks from PROTEIN pool when protein contributes >= 40% of calories', () => {
    const result = pickPraise({
      description: 'whey com leite',
      calories: 200,
      protein: 30,
      carbs: 10,
      fat: 4,
      meal_type: null,
    });
    expect(result).toMatch(/proteína|músculos|proteica/i);
  });

  it('picks from CARB pool when carbs contribute >= 55% of calories', () => {
    const result = pickPraise({
      description: 'pão e suco',
      calories: 300,
      protein: 5,
      carbs: 50,
      fat: 4,
      meal_type: null,
    });
    expect(result).toMatch(/energia|carboidrato|treino|combustível/i);
  });

  it('picks from HEAVY pool when calories >= 700 regardless of macros', () => {
    const result = pickPraise({
      description: 'whopper e coca',
      calories: 920,
      protein: 35,
      carbs: 70,
      fat: 45,
      meal_type: null,
    });
    expect(result).toMatch(/anotado|registrei|registrado|reforçado|densa|cheia|fica de olho/i);
  });

  it('picks from BALANCED pool when no macro dominates', () => {
    const result = pickPraise({
      description: 'arroz e frango',
      calories: 650,
      protein: 45,
      carbs: 75,
      fat: 12,
      meal_type: null,
    });
    expect(result).toMatch(/equilibrada|distribuídos|combinação|lugar|anotado/i);
  });

  it('falls back to BALANCED when calories is 0 (avoids divide-by-zero)', () => {
    const result = pickPraise({
      description: 'algo estranho',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meal_type: null,
    });
    expect(result).toMatch(/equilibrada|distribuídos|combinação|lugar|anotado/i);
  });
});

describe('pickWeeklyResumePraise', () => {
  it('returns a "começar a registrar" message when no day has meals', () => {
    const result = pickWeeklyResumePraise({
      daysWithinGoal: 0,
      totalDays: 7,
      hasAnyMeal: false,
      calorieGoal: 2150,
    });
    expect(result).toContain('começar a registrar');
  });

  it('returns a goal-less message when the user has registered meals but calorieGoal is null', () => {
    const result = pickWeeklyResumePraise({
      daysWithinGoal: 0,
      totalDays: 7,
      hasAnyMeal: true,
      calorieGoal: null,
    });
    expect(result).toContain('Tô anotando');
  });

  it.each<[number, RegExp]>([
    [7, /Semana perfeita/i],
    [6, /Semana sólida/i],
    [5, /Semana sólida/i],
    [4, /Boa semana/i],
    [3, /Boa semana/i],
    [2, /Tem dias bons/i],
    [1, /Tem dias bons/i],
    [0, /Bora apertar/i],
  ])('returns the right cascade message for %i days within goal', (daysWithinGoal, expected) => {
    const result = pickWeeklyResumePraise({
      daysWithinGoal,
      totalDays: 7,
      hasAnyMeal: true,
      calorieGoal: 2150,
    });
    expect(result).toMatch(expected);
  });
});
