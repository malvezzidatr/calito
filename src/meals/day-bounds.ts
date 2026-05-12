const TZ = 'America/Sao_Paulo';
const SP_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function startOfDay(d: Date): Date {
  const [y, m, day] = dayFormatter.format(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, SP_OFFSET_HOURS, 0, 0, 0));
}

export function startOfNextDay(d: Date): Date {
  return new Date(startOfDay(d).getTime() + DAY_MS);
}
