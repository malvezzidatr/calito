import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagesModule } from './messages/messages.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ConfigModule } from '@nestjs/config';
import { MealsModule } from './meals/meals.module';
import { FoodsModule } from './foods/foods.module';

@Module({
  imports: [MealsModule, PrismaModule, UsersModule, WhatsappModule, EventEmitterModule.forRoot(), MessagesModule, OnboardingModule, ConfigModule.forRoot({ isGlobal: true }), FoodsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
