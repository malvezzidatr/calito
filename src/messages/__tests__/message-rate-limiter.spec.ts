import { MessageRateLimiter } from '../message-rate-limiter';

describe('MessageRateLimiter', () => {
  it('allows messages under the limit', () => {
    const limiter = new MessageRateLimiter();
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
      expect(limiter.allow('5511999999999', now + i)).toBe(true);
    }
  });

  it('blocks the message that exceeds the limit within the window', () => {
    const limiter = new MessageRateLimiter();
    const now = Date.now();

    for (let i = 0; i < 20; i++) limiter.allow('5511999999999', now + i);

    expect(limiter.allow('5511999999999', now + 20)).toBe(false);
  });

  it('tracks limits independently per phone', () => {
    const limiter = new MessageRateLimiter();
    const now = Date.now();

    for (let i = 0; i < 20; i++) limiter.allow('5511999999999', now + i);

    expect(limiter.allow('5511888888888', now)).toBe(true);
  });

  it('allows again once the window has slid past the old hits', () => {
    const limiter = new MessageRateLimiter();
    const now = Date.now();

    for (let i = 0; i < 20; i++) limiter.allow('5511999999999', now + i);
    expect(limiter.allow('5511999999999', now + 20)).toBe(false);

    expect(limiter.allow('5511999999999', now + 61_000)).toBe(true);
  });
});
