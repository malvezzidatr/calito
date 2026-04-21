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
    const text = this.extractText(msg);

    this.logger.log(`Msg de ${from}: ${text ?? '[não-texto]'}`);

    if (!text || !/^\s*calito\b/i.test(text)) return;

    await this.whatsapp.sendText(from, 'Oi');
  }

  private extractText(msg: IncomingMessage): string | undefined {
    const inner =
      msg.message?.ephemeralMessage?.message ??
      msg.message?.viewOnceMessage?.message ??
      msg.message?.viewOnceMessageV2?.message ??
      msg.message?.documentWithCaptionMessage?.message ??
      msg.message;

    return (
      inner?.conversation ??
      inner?.extendedTextMessage?.text ??
      inner?.imageMessage?.caption ??
      inner?.videoMessage?.caption ??
      undefined
    );
  }
}
