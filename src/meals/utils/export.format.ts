import { Gender, ActivityLevel, Goal, MealType, User } from '@prisma/client';

type ExportMeal = {
  meal_type: MealType;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: Date;
};

/**
 * Payload estruturado (JSON) com tudo o que o Calito guarda sobre o titular:
 * perfil + histórico completo de refeições. Cobre acesso e portabilidade
 * (Art. 18 II e V LGPD) — o formatProfile em texto cobre só acesso resumido.
 */
export function buildDataExport(user: User, meals: ExportMeal[]): string {
  const payload = {
    exported_at: new Date().toISOString(),
    profile: {
      phone: user.phone,
      name: user.name,
      weight_kg: user.weight,
      height_cm: user.height,
      age: user.age,
      gender: user.gender as Gender | null,
      activity_level: user.activity_level as ActivityLevel | null,
      goal: user.goal as Goal | null,
      calorie_goal: user.calorie_goal,
      protein_goal: user.protein_goal,
      carbs_goal: user.carbs_goal,
      fat_goal: user.fat_goal,
    },
    consent: {
      given: user.consent_given,
      date: user.consent_date?.toISOString() ?? null,
    },
    subscription: {
      status: user.status,
      trial_ends_at: user.trial_ends_at?.toISOString() ?? null,
      subscription_expires_at: user.subscription_expires_at?.toISOString() ?? null,
    },
    account: {
      created_at: user.created_at.toISOString(),
    },
    meals: meals.map((meal) => ({
      date: meal.created_at.toISOString(),
      meal_type: meal.meal_type,
      description: meal.description,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    })),
  };

  return JSON.stringify(payload, null, 2);
}
