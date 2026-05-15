import { ActivityLevel, Gender, Goal } from '@prisma/client';

type TMBInput = { gender: Gender; weight: number; height: number; age: number };
type TDEEInput = { tmb: number; activityLevel: ActivityLevel };
type GoalAdjustInput = { tdee: number; goal: Goal };
type SplitMacrosInput = { calories: number; weight: number; gender: Gender };
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

const PROTEIN_PER_KG: Record<Gender, number> = { MALE: 1.8, FEMALE: 1.0 };
const FAT_PER_KG = 1.0;
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

export const splitMacros = ({ calories, weight, gender }: SplitMacrosInput) => {
    const protein_goal = Math.round(weight * PROTEIN_PER_KG[gender]);
    const fat_goal = Math.round(weight * FAT_PER_KG);
    const remainingCalories = calories - protein_goal * KCAL_PER_GRAM.protein - fat_goal * KCAL_PER_GRAM.fat;
    const carbs_goal = Math.round(remainingCalories / KCAL_PER_GRAM.carbs);
    return { protein_goal, carbs_goal, fat_goal };
};

export const calcGoals = (input: GoalsInput): Goals => {
    const tmb = calcTMB(input);
    const tdee = calcTDEE({ tmb, activityLevel: input.activityLevel });
    const calories = adjustByGoal({ tdee, goal: input.goal });
    return {
        calorie_goal: Math.round(calories),
        ...splitMacros({ calories, weight: input.weight, gender: input.gender }),
    };
};
