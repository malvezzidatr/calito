import { getTimeBucketInSP, isThanksMessage, pickGreeting } from '../../utils/greeting.picker';
import { GREETING_VARIANTS_BY_BUCKET, THANKS_VARIANTS } from '../../messages/general.messages';

describe('getTimeBucketInSP', () => {
  it.each([
    ['2026-05-28T05:00:00Z', 'dawn'      ],
    ['2026-05-28T08:00:00Z', 'dawn'      ],
    ['2026-05-28T10:00:00Z', 'morning'   ],
    ['2026-05-28T15:00:00Z', 'afternoon' ],
    ['2026-05-28T20:00:00Z', 'afternoon' ],
    ['2026-05-28T22:00:00Z', 'evening'   ],
    ['2026-05-28T01:00:00Z', 'evening'   ],
  ] as const)('classifies UTC %s as %s in SP', (iso, expectedBucket) => {
    expect(getTimeBucketInSP(new Date(iso))).toBe(expectedBucket);
  });

  it('boundary: 06:00 SP is morning (not dawn)', () => {
    expect(getTimeBucketInSP(new Date('2026-05-28T09:00:00Z'))).toBe('morning');
  });

  it('boundary: 05:59 SP is dawn', () => {
    expect(getTimeBucketInSP(new Date('2026-05-28T08:59:00Z'))).toBe('dawn');
  });

  it('boundary: 12:00 SP is afternoon', () => {
    expect(getTimeBucketInSP(new Date('2026-05-28T15:00:00Z'))).toBe('afternoon');
  });

  it('boundary: 18:00 SP is evening', () => {
    expect(getTimeBucketInSP(new Date('2026-05-28T21:00:00Z'))).toBe('evening');
  });
});

describe('isThanksMessage', () => {
  it.each(['obrigado', 'obrigada', 'OBRIGADO!', 'brigado', 'valeu', 'valeu mano', 'vlw', 'valew'])(
    'returns true for %p',
    (text) => {
      expect(isThanksMessage(text)).toBe(true);
    },
  );

  it.each(['oi', 'bom dia', 'boa tarde', 'ola', '', 'tudo bem?'])('returns false for %p', (text) => {
    expect(isThanksMessage(text)).toBe(false);
  });
});

describe('pickGreeting', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a thanks variant when message is a thanks', () => {
    const result = pickGreeting('valeu mano', new Date('2026-05-28T10:00:00Z'));
    expect(THANKS_VARIANTS).toContain(result);
  });

  it('returns a morning variant when SP time is morning and no thanks', () => {
    const result = pickGreeting('bom dia', new Date('2026-05-28T13:00:00Z')); // 10:00 SP
    expect(GREETING_VARIANTS_BY_BUCKET.morning).toContain(result);
  });

  it('returns an evening variant when SP time is evening', () => {
    const result = pickGreeting('boa noite', new Date('2026-05-28T23:00:00Z')); // 20:00 SP
    expect(GREETING_VARIANTS_BY_BUCKET.evening).toContain(result);
  });

  it('returns the first variant when Math.random is 0', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = pickGreeting('bom dia', new Date('2026-05-28T13:00:00Z')); // morning
    expect(result).toBe(GREETING_VARIANTS_BY_BUCKET.morning[0]);
  });
});
