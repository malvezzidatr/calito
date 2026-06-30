import { isSubscriptionActive, isInTrial, intentRequiresSubscription } from '../utils/subscription.access';

describe('isSubscriptionActive', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const future = new Date('2026-06-30T12:00:00Z');
  const past = new Date('2026-05-30T12:00:00Z');

  it('is active when status is ACTIVE and expiry is in the future', () => {
    expect(isSubscriptionActive({ status: 'ACTIVE', subscription_expires_at: future }, now)).toBe(true);
  });

  it('is not active when the expiry has passed', () => {
    expect(isSubscriptionActive({ status: 'ACTIVE', subscription_expires_at: past }, now)).toBe(false);
  });

  it('is not active when there is no expiry (never paid)', () => {
    expect(isSubscriptionActive({ status: 'ACTIVE', subscription_expires_at: null }, now)).toBe(false);
  });

  it('is not active when the status is not ACTIVE', () => {
    expect(isSubscriptionActive({ status: 'INACTIVE', subscription_expires_at: future }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'CANCELLED', subscription_expires_at: future }, now)).toBe(false);
  });

  it('is active during the trial even when there is no paid subscription', () => {
    expect(
      isSubscriptionActive({ status: 'INACTIVE', subscription_expires_at: null, trial_ends_at: future }, now),
    ).toBe(true);
  });

  it('is not active once the trial has ended and nothing was paid', () => {
    expect(
      isSubscriptionActive({ status: 'INACTIVE', subscription_expires_at: null, trial_ends_at: past }, now),
    ).toBe(false);
  });
});

describe('isInTrial', () => {
  const now = new Date('2026-06-02T12:00:00Z');

  it('is true while the trial end is in the future', () => {
    expect(isInTrial({ trial_ends_at: new Date('2026-06-05T12:00:00Z') }, now)).toBe(true);
  });

  it('is false when the trial end has passed', () => {
    expect(isInTrial({ trial_ends_at: new Date('2026-06-01T12:00:00Z') }, now)).toBe(false);
  });

  it('is false when no trial was granted', () => {
    expect(isInTrial({ trial_ends_at: null }, now)).toBe(false);
    expect(isInTrial({ trial_ends_at: undefined }, now)).toBe(false);
  });
});

describe('intentRequiresSubscription', () => {
  it.each(['help', 'subscribe', 'delete_account', 'greeting'] as const)(
    'lets %s through without a subscription',
    (intent) => {
      expect(intentRequiresSubscription(intent)).toBe(false);
    },
  );

  it.each(['register_meal', 'query_daily', 'view_profile', 'update_goal', 'update_weight'] as const)(
    'requires a subscription for %s',
    (intent) => {
      expect(intentRequiresSubscription(intent)).toBe(true);
    },
  );
});
