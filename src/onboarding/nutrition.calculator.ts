import { ActivityLevel, Gender, Goal } from '@prisma/client';

type TMBInput = { gender: Gender; weight: number; height: number; age: number };
type TDEEInput = { tmb: number; activityLevel: ActivityLevel };
type GoalAdjustInput = { tdee: number; goal: Goal };
type GoalsInput = TMBInput & { activityLevel: ActivityLevel; goal: Goal };

export type Goals = {
    calorie_goal: number;
    protein_goal: number;
    carbs_goal: number;
    fat_goal: number;
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
    SEDENTARY: 1.2,
    LIGHT: 1.375,
    MODERATE: 1.55,
    INTENSE: 1.725,
    VERY_INTENSE: 1.9,
};

const GOAL_ADJUST: Record<Goal, number> = {
    LOSE: -500,
    MAINTAIN: 0,
    GAIN: 400,
};

const MACRO_SPLIT = { protein: 0.30, carbs: 0.45, fat: 0.25 };
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

export const calcTMB = ({ gender, weight, height, age }: TMBInput): number => {
    if (gender === 'MALE') {
        return 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
    }
    return 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
};

export const calcTDEE = ({ tmb, activityLevel }: TDEEInput): number => {
    return tmb * ACTIVITY_FACTOR[activityLevel];
};

export const adjustByGoal = ({ tdee, goal }: GoalAdjustInput): number => {
    return tdee + GOAL_ADJUST[goal];
};

export const splitMacros = (calories: number) => ({
    protein_goal: Math.round((calories * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein),
    carbs_goal: Math.round((calories * MACRO_SPLIT.carbs) / KCAL_PER_GRAM.carbs),
    fat_goal: Math.round((calories * MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat),
});

export const calcGoals = (input: GoalsInput): Goals => {
    const tmb = calcTMB(input);
    const tdee = calcTDEE({ tmb, activityLevel: input.activityLevel });
    const calories = adjustByGoal({ tdee, goal: input.goal });
    return {
        calorie_goal: Math.round(calories),
        ...splitMacros(calories),
    };
};
