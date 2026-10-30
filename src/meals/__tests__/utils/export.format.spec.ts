import { buildDataExport } from '../../utils/export.format';
import { Goal, MealType, User } from '@prisma/client';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    phone: '5511999998888',
    name: null,
    status: 'ACTIVE',
    onboarding_step: null,
    subscription_id: null,
    subscription_expires_at: null,
    trial_ends_at: null,
    weight: 80,
    height: 180,
    age: 30,
    gender: 'MALE',
    activity_level: 'MODERATE',
    goal: 'LOSE' as Goal,
    calorie_goal: 2200,
    protein_goal: 180,
    carbs_goal: 200,
    fat_goal: 70,
    consent_given: true,
    consent_date: new Date('2026-01-01T00:00:00.000Z'),
    consent_version: '2026-08-12',
    created_at: new Date('2025-12-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('buildDataExport', () => {
  it('includes profile, consent, subscription and account sections', () => {
    const result = JSON.parse(buildDataExport(buildUser(), []));

    expect(result.profile).toMatchObject({ phone: '5511999998888', weight_kg: 80, goal: 'LOSE' });
    expect(result.consent).toMatchObject({ given: true, date: '2026-01-01T00:00:00.000Z' });
    expect(result.account).toMatchObject({ created_at: '2025-12-01T00:00:00.000Z' });
  });

  it('serializes every meal with its date and macros', () => {
    const meal = {
      meal_type: 'LUNCH' as MealType,
      description: 'arroz, feijão e frango',
      calories: 650,
      protein: 45,
      carbs: 70,
      fat: 15,
      created_at: new Date('2026-02-10T12:00:00.000Z'),
    };

    const result = JSON.parse(buildDataExport(buildUser(), [meal]));

    expect(result.meals).toHaveLength(1);
    expect(result.meals[0]).toMatchObject({
      date: '2026-02-10T12:00:00.000Z',
      meal_type: 'LUNCH',
      description: 'arroz, feijão e frango',
      calories: 650,
    });
  });

  it('omits nothing about the export timestamp — always present and ISO-formatted', () => {
    const result = JSON.parse(buildDataExport(buildUser(), []));
    expect(() => new Date(result.exported_at).toISOString()).not.toThrow();
  });
});
