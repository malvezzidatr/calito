import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type IncomingMessage } from '../whatsapp/whatsapp.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { IntentClassifier } from 'src/ai/intent.classifier';
import { IntentRouter } from 'src/ai/intent.router';

@Injectable()
export class MessagesHandler {
  private readonly logger = new Logger(MessagesHandler.name);
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly classifier: IntentClassifier,
    private readonly router: IntentRouter
  ) {}

  @OnEvent('whatsapp.message')
  async handle(msg: IncomingMessage) {
    const from = msg.key.remoteJid;
    if (!from || from === 'status@broadcast' || from.endsWith('@g.us')) return;

    // Quando o WhatsApp usa LID (remoteJid = <id>@lid), o telefone real
    // vem em remoteJidAlt como <phone>@s.whatsapp.net.
    const fromPhone = msg.key.remoteJidAlt ?? from;
    const text = this.extractText(msg);

    this.logger.log(`Msg de ${from}: ${text ?? '[não-texto]'}`);

    // Dev-only: só processa mensagens com prefixo "calito" pra não criar
    // User de terceiros no banco enquanto se testa no número pessoal.
    // Remover quando o bot for pra número dedicado (Épico 9 / deploy).
    if (!text || !/^\s*calito\b/i.test(text)) return;
    const realText = text.replace(/^\s*calito\b\s*/i, '');

    const phone = fromPhone.split('@')[0];
    const result = await this.onboarding.routeMessage(phone, realText, fromPhone);

    if (result === 'delegate_to_ai') {
      const intent = await this.classifier.classify(realText);
      this.logger.log(`Intent classificada: ${intent}`);
      await this.router.route(intent, phone, realText, fromPhone);
    }
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
