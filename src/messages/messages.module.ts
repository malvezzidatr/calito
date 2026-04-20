import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MessagesHandler } from './messages.handler';

@Module({
  imports: [WhatsappModule],
  providers: [MessagesHandler],
})
export class MessagesModule {}
