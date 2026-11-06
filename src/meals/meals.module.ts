import { Module } from '@nestjs/common';
import { PhotoMealService } from './photo-meal.service';
import { MealsRepository } from './meals.repository';
import { MealsService } from './meals.service';
import { DailyRecapService } from './daily-recap.service';
import { ParsedMessagesRepository } from './parsed-messages.repository';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { FoodsModule } from '../foods/foods.module';

@Module({
  imports: [AiModule, UsersModule, WhatsappModule, FoodsModule],
  providers: [PhotoMealService, MealsRepository, MealsService, DailyRecapService, ParsedMessagesRepository],
  exports: [PhotoMealService, MealsRepository, MealsService, ParsedMessagesRepository],
})
export class MealsModule {}
