import { Module } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { EstimatedFoodsRepository } from './estimated-foods.repository';
import { FoodEstimator } from './food.estimator';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  providers: [FoodsService, EstimatedFoodsRepository, FoodEstimator],
  exports:   [FoodsService, FoodEstimator],
})
export class FoodsModule {}
