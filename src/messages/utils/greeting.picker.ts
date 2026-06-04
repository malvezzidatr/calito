import { pickRandom } from '../../common/utils/pick-random';
import { GREETING_VARIANTS_BY_BUCKET, GreetingBucket, THANKS_VARIANTS } from '../messages/general.messages';

const HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: 'numeric',
  hour12: false,
});

const THANKS_PATTERN = /brigad|valeu|valew|vlw/i;

export function isThanksMessage(text: string): boolean {
  return THANKS_PATTERN.test(text);
}

export function getTimeBucketInSP(date: Date): GreetingBucket {
  const hour = Number(HOUR_FORMATTER.format(date));
  if (hour < 6)  return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function pickGreeting(text: string, now: Date): string {
  if (isThanksMessage(text)) return pickRandom(THANKS_VARIANTS);
  return pickRandom(GREETING_VARIANTS_BY_BUCKET[getTimeBucketInSP(now)]);
}
