import { calcTMB, calcTDEE, adjustByGoal, splitMacros, calcGoals } from '../../utils/nutrition.calculator';

describe('NutritionCalculator', () => {
    describe('calcTMB', () => {
        it('calculate BMR for women (case: Maria - 65kg, 165cm, 28 years)', () => {
            const tmb = calcTMB({ gender: 'FEMALE', weight: 65, height: 165, age: 28 });
            expect(tmb).toBeCloseTo(1438.6, 1);
        });

        it('calculate BMR for man (case: Joao - 80kg, 174cm, 31 years)', () => {
            const tmb = calcTMB({ gender: 'MALE', weight: 80, height: 174, age: 31 });
            expect(tmb).toBeCloseTo(1819.2, 1)
        })
    });

    describe('calcTDEE', () => {
        const tmb = 1819;
        it('apply MODERATE (1.55)', () => {
            const tdee = calcTDEE({ tmb, activityLevel: 'MODERATE' })
            expect(tdee).toBeCloseTo(2819.45, 1);
        })
        it('apply SEDENTARY (1.2)', () => {
            const tdee = calcTDEE({ tmb, activityLevel: 'SEDENTARY' })
            expect(tdee).toBeCloseTo(2182.8, 1);
        })
        it('apply VERY_INTENSE (1.9)', () => {
            const tdee = calcTDEE({ tmb, activityLevel: 'VERY_INTENSE' })
            expect(tdee).toBeCloseTo(3456.1, 1);
        })
    });

    describe('adjustByGoal', () => {
        const tdee = 2819.45
        it('goal is LOSE', () => {
            const adjustedCalories = adjustByGoal({goal: 'LOSE', tdee: tdee})
            expect(adjustedCalories).toBeCloseTo(2319.45, 1)
        })
        it('goal is MAINTAIN', () => {
            const adjustedCalories = adjustByGoal({goal: 'MAINTAIN', tdee: tdee})
            expect(adjustedCalories).toBeCloseTo(2819.45, 1)
        })
        it('goal is GAIN', () => {
            const adjustedCalories = adjustByGoal({goal: 'GAIN', tdee: tdee})
            expect(adjustedCalories).toBeCloseTo(3219.45, 1)
        })
    });

    describe('splitMacros', () => {
        it('calculates protein at 1.8g/kg for male', () => {
            const { protein_goal } = splitMacros({ calories: 2500, weight: 80, gender: 'MALE' });
            expect(protein_goal).toBe(144);
        });

        it('calculates protein at 1.0g/kg for female', () => {
            const { protein_goal } = splitMacros({ calories: 1730, weight: 65, gender: 'FEMALE' });
            expect(protein_goal).toBe(65);
        });

        it('calculates fat at 1.0g/kg regardless of gender', () => {
            const maleFat = splitMacros({ calories: 2500, weight: 80, gender: 'MALE' }).fat_goal;
            const femaleFat = splitMacros({ calories: 1730, weight: 65, gender: 'FEMALE' }).fat_goal;
            expect(maleFat).toBe(80);
            expect(femaleFat).toBe(65);
        });

        it('fills remaining calories with carbs', () => {
            const { carbs_goal } = splitMacros({ calories: 1730, weight: 65, gender: 'FEMALE' });
            expect(carbs_goal).toBe(221);
        });

        it('uses 4 kcal/g for P/C and 9 kcal/g for G (sum matches calories)', () => {
            const calories = 2000;
            const { protein_goal, carbs_goal, fat_goal } = splitMacros({ calories, weight: 70, gender: 'MALE' });
            const total = protein_goal * 4 + carbs_goal * 4 + fat_goal * 9;
            expect(Math.abs(total - calories)).toBeLessThanOrEqual(5);
        });
    });

    describe('calcGoals (HU-07 base case)', () => {
        it('Maria case → calorie_goal ≈ 1730 kcal', () => {
            const goals = calcGoals({
                gender: 'FEMALE',
                weight: 65,
                height: 165,
                age: 28,
                activityLevel: 'MODERATE',
                goal: 'LOSE',
            });
            expect(goals.calorie_goal).toBe(1730);
        });

        it('returns macros consistent with the calorie goal (P*4 + C*4 + G*9 ≈ calorie_goal)', () => {
            const goals = calcGoals({
                gender: 'FEMALE',
                weight: 65,
                height: 165,
                age: 28,
                activityLevel: 'MODERATE',
                goal: 'LOSE',
            });
            const total = goals.protein_goal * 4 + goals.carbs_goal * 4 + goals.fat_goal * 9;
            expect(Math.abs(total - goals.calorie_goal)).toBeLessThanOrEqual(5);
        });

        it('active man wanting to gain mass → calorie_goal > TDEE', () => {
            const input = {
                gender: 'MALE' as const,
                weight: 80,
                height: 174,
                age: 31,
                activityLevel: 'INTENSE' as const,
                goal: 'GAIN' as const,
            };
            const goals = calcGoals(input);
            const tdee = calcTDEE({
                tmb: calcTMB(input),
                activityLevel: input.activityLevel,
            });
            expect(goals.calorie_goal).toBeGreaterThan(tdee);
        });
    });
});
