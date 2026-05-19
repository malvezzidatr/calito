import { MealType } from '@prisma/client';

const TZ = 'America/Sao_Paulo';

const hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: '2-digit',
  hour12: false,
});

export function inferMealTypeByHour(now: Date): MealType {
  const hour = Number(hourFormatter.format(now)) % 24;
  if (hour >= 5 && hour < 11) return 'BREAKFAST';
  if (hour >= 11 && hour < 15) return 'LUNCH';
  if (hour >= 18 && hour < 23) return 'DINNER';
  return 'SNACK';
}
