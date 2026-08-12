import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { UsersModule } from '../users/users.module';
import { MealsModule } from '../meals/meals.module';
import { FoodsModule } from '../foods/foods.module';

@Module({
  imports: [UsersModule, MealsModule, FoodsModule],
  providers: [RetentionService],
})
export class RetentionModule {}
