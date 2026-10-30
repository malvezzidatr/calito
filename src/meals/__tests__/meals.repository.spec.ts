import { MealsRepository } from '../meals.repository';

describe('MealsRepository (CS-129)', () => {
  let repo: MealsRepository;
  let mealDelete: jest.Mock;
  let mealUpdate: jest.Mock;

  beforeEach(() => {
    mealDelete = jest.fn().mockResolvedValue({});
    mealUpdate = jest.fn().mockResolvedValue({});
    const prisma = { meal: { delete: mealDelete, update: mealUpdate } };
    repo = new MealsRepository(prisma as never);
  });

  it('deleteById scopes the delete by both id and user_id', async () => {
    await repo.deleteById('meal-1', 'user-1');

    expect(mealDelete).toHaveBeenCalledWith({ where: { id: 'meal-1', user_id: 'user-1' } });
  });

  it('updateById scopes the update by both id and user_id', async () => {
    await repo.updateById('meal-1', 'user-1', {
      meal_type: 'LUNCH',
      description: 'arroz e frango',
      calories: 500,
      protein: 40,
      carbs: 50,
      fat: 10,
    });

    expect(mealUpdate).toHaveBeenCalledWith({
      where: { id: 'meal-1', user_id: 'user-1' },
      data: {
        meal_type: 'LUNCH',
        description: 'arroz e frango',
        calories: 500,
        protein: 40,
        carbs: 50,
        fat: 10,
      },
    });
  });
});
