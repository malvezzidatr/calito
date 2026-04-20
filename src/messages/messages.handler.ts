import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WhatsappService,
  type IncomingMessage,
} from '../whatsapp/whatsapp.service';

@Injectable()
export class MessagesHandler {
  private readonly logger = new Logger(MessagesHandler.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  @OnEvent('whatsapp.message')
  async handle(msg: IncomingMessage) {
    const from = msg.key.remoteJid;
    if (!from || from === 'status@broadcast') return;

    const text =
      msg.message?.conversation ?? msg.message?.extendedTextMessage?.text;

    this.logger.log(`Msg de ${from}: ${text ?? '[não-texto]'}`);

    if (!text || !/^\s*calito\b/i.test(text)) return;

    await this.whatsapp.sendText(from, 'Oi');
  }
}
