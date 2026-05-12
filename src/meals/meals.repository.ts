import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MealType } from '@prisma/client';

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
}
