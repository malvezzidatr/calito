import { Module } from '@nestjs/common';
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
  providers: [MealsRepository, MealsService, DailyRecapService, ParsedMessagesRepository],
  exports: [MealsRepository, MealsService],
})
export class MealsModule {}
