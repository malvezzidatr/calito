import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [PrismaModule, UsersModule, WhatsappModule, EventEmitterModule.forRoot(), MessagesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
