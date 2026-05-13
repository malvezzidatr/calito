import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MealType } from '@prisma/client';
import { startOfDay, startOfNextDay } from './day-bounds';

type CreateMealInput = {
  user_id: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};


@Injectable()
export class MealsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateMealInput) {
    return this.prisma.meal.create({
    data: {
        meal_type: data.meal_type,
        description: data.description,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        user: { connect: { id: data.user_id } },
    },
    });
  }

  async sumDailyByUser(user_id: string, day: Date) {
    const response = await this.prisma.meal.aggregate({
      where: {
        user_id,
        created_at: { gte: startOfDay(day), lt: startOfNextDay(day) },
      },
      _sum: { calories: true, protein: true, carbs: true, fat: true },
    });
    return {
      calories: response._sum.calories ?? 0,
      protein:  response._sum.protein  ?? 0,
      carbs:    response._sum.carbs    ?? 0,
      fat:      response._sum.fat      ?? 0,
    };
  }

  findDailyByUser(user_id: string, day: Date) {
    return this.prisma.meal.findMany({
      where: {
        user_id,
        created_at: { gte: startOfDay(day), lt: startOfNextDay(day) },
      },
      orderBy: { created_at: 'asc' },
      select: { meal_type: true, calories: true },
    });
  }

  findInRangeByUser(user_id: string, startInclusive: Date, endExclusive: Date) {
    return this.prisma.meal.findMany({
      where: {
        user_id,
        created_at: { gte: startInclusive, lt: endExclusive },
      },
      orderBy: { created_at: 'asc' },
      select: { created_at: true, meal_type: true, calories: true, protein: true, carbs: true, fat: true },
    });
  }

}
