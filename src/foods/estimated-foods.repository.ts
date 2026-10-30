import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type UpsertInput = {
  food_name: string;
  unit:      string;
  calories:  number;
  protein:   number;
  carbs:     number;
  fat:       number;
};

@Injectable()
export class EstimatedFoodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByNameAndUnit(food_name: string, unit: string) {
    return this.prisma.estimatedFood.findUnique({
      where: { food_name_unit: { food_name, unit } },
    });
  }

  upsert(data: UpsertInput) {
    return this.prisma.estimatedFood.upsert({
      where: { food_name_unit: { food_name: data.food_name, unit: data.unit } },
      create: {
        food_name: data.food_name,
        unit:      data.unit,
        calories:  data.calories,
        protein:   data.protein,
        carbs:     data.carbs,
        fat:       data.fat,
      },
      update: {
        calories: data.calories,
        protein:  data.protein,
        carbs:    data.carbs,
        fat:      data.fat,
      },
    });
  }

  /** Purga por idade (Art. 15 LGPD) — é cache de otimização, não histórico de negócio. */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.estimatedFood.deleteMany({
      where: { updated_at: { lt: cutoff } },
    });
    return result.count;
  }
}
