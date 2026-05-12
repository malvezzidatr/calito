import { pickGoalAwarePraise, pickPraise, subtractMeal } from './meal.praise';
import { MealExtraction } from '../ai/meal.prompt';

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
