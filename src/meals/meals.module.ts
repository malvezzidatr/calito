import { Module } from '@nestjs/common';
import { MealsRepository } from './meals.repository';
import { MealsService } from './meals.service';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [AiModule, UsersModule, WhatsappModule],
  providers: [MealsRepository, MealsService],
  exports: [MealsRepository, MealsService],
})
export class MealsModule {}
