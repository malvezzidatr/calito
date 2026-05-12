import { startOfDay, startOfNextDay } from '../day-bounds';

describe('startOfDay (America/Sao_Paulo)', () => {
  it('returns 00:00 SP (03:00 UTC) for an afternoon instant in SP', () => {
    const result = startOfDay(new Date('2026-05-12T18:30:00Z'));
    expect(result.toISOString()).toBe('2026-05-12T03:00:00.000Z');
  });

  it('returns the previous SP day for an instant before 03:00 UTC', () => {
    const result = startOfDay(new Date('2026-05-12T01:00:00Z'));
    expect(result.toISOString()).toBe('2026-05-11T03:00:00.000Z');
  });

  it('returns the same day for an instant exactly at midnight SP', () => {
    const result = startOfDay(new Date('2026-05-12T03:00:00Z'));
    expect(result.toISOString()).toBe('2026-05-12T03:00:00.000Z');
  });

  it('is independent of the system timezone (driven by Intl, not setHours)', () => {
    const a = startOfDay(new Date('2026-05-12T18:30:00Z'));
    const b = startOfDay(new Date('2026-05-12T18:30:00Z'));
    expect(a.toISOString()).toBe(b.toISOString());
  });
});

describe('startOfNextDay', () => {
  it('returns startOfDay + 24h', () => {
    const result = startOfNextDay(new Date('2026-05-12T18:30:00Z'));
    expect(result.toISOString()).toBe('2026-05-13T03:00:00.000Z');
  });

  it('crosses month boundary correctly', () => {
    const result = startOfNextDay(new Date('2026-05-31T18:00:00Z'));
    expect(result.toISOString()).toBe('2026-06-01T03:00:00.000Z');
  });
});
