import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagesModule } from './messages/messages.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [PrismaModule, UsersModule, WhatsappModule, EventEmitterModule.forRoot(), MessagesModule, OnboardingModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
