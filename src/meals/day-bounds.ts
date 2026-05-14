const TZ = 'America/Sao_Paulo';
const SP_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function startOfDay(date: Date): Date {
  const [y, m, day] = dayFormatter.format(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, SP_OFFSET_HOURS, 0, 0, 0));
}

export function startOfNextDay(date: Date): Date {
  return new Date(startOfDay(date).getTime() + DAY_MS);
}

export function startOfDaysAgo(date: Date, howManyDays: number): Date {
  return new Date(startOfDay(date).getTime() - howManyDays * DAY_MS);
}