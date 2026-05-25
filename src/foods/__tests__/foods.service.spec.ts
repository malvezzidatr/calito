import { Test } from '@nestjs/testing';
import { FoodsService } from '../foods.service';
import { FoodEstimator } from '../food.estimator';

describe('FoodsService', () => {
  let service: FoodsService;
  let estimator: { estimate: jest.Mock };

  beforeEach(async () => {
    estimator = { estimate: jest.fn().mockResolvedValue({ estimated: [], failed: [] }) };
    const module = await Test.createTestingModule({
      providers: [
        FoodsService,
        { provide: FoodEstimator, useValue: estimator },
      ],
    }).compile();
    service = module.get(FoodsService);
    service.onModuleInit();
  });

  it('loads the seed catalog at boot', () => {
    expect(service.size()).toBeGreaterThanOrEqual(30);
  });

  it('getById returns the matching entry', () => {
    const ovo = service.getById('ovo');
    expect(ovo).not.toBeNull();
    expect(ovo?.name).toBe('Ovo de galinha');
    expect(ovo?.units.unidade?.grams).toBe(50);
  });

  it('getById returns null for unknown id', () => {
    expect(service.getById('foo-bar')).toBeNull();
  });

  it('getAll returns every loaded entry', () => {
    const all = service.getAll();
    expect(all.length).toBe(service.size());
    expect(all.every((e) => typeof e.id === 'string')).toBe(true);
  });

  it('getByCategory filters by the requested category', () => {
    const carnes = service.getByCategory('carnes');
    expect(carnes.length).toBeGreaterThan(0);
    expect(carnes.every((e) => e.category === 'carnes')).toBe(true);
  });

  it('getByCategory returns empty array when no entry matches', () => {
    const empty = service.getByCategory('inexistente' as never);
    expect(empty).toEqual([]);
  });
});
