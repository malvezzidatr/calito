import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsappService, type IncomingMessage } from '../whatsapp/whatsapp.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { UsersService } from '../users/users.service';
import { UserPendingState } from '../users/utils/user-states';
import { IntentClassifier } from '../ai/intent.classifier';
import { IntentRouter } from './intent.router';
import { SubscriptionService } from '../subscription/subscription.service';
import { MEDIA_NOT_SUPPORTED } from './messages/general.messages';
import { UserMessageLock } from './user-message.lock';

@Injectable()
export class MessagesHandler {
  private readonly logger = new Logger(MessagesHandler.name);
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly users: UsersService,
    private readonly classifier: IntentClassifier,
    private readonly router: IntentRouter,
    private readonly subscription: SubscriptionService,
    private readonly whatsapp: WhatsappService,
    private readonly lock: UserMessageLock,
  ) {}

  @OnEvent('whatsapp.message')
  async handle(msg: IncomingMessage) {
    const from = msg.key.remoteJid;
    if (!from || from === 'status@broadcast' || from.endsWith('@g.us')) return;

    // Quando o WhatsApp usa LID (remoteJid = <id>@lid), o telefone real
    // vem em remoteJidAlt como <phone>@s.whatsapp.net.
    const fromPhone = msg.key.remoteJidAlt ?? from;
    const phone = fromPhone.split('@')[0];

    await this.lock.run(phone, () => this.process(msg, phone, fromPhone));
  }

  private async process(msg: IncomingMessage, phone: string, fromPhone: string) {
    const from = msg.key.remoteJid!;
    const text = this.extractText(msg);

    this.logger.log(`Msg de ${from}: ${text ?? '[não-texto]'}`);

    // Sem texto utilizável: se for mídia (foto/áudio/figurinha) de um usuário já
    // cadastrado, responde que ainda não lê esse formato em vez de ignorar.
    if (!text) {
      if (this.isMediaMessage(msg)) {
        const knownUser = await this.users.findByPhone(phone);
        if (knownUser) await this.whatsapp.sendText(fromPhone, MEDIA_NOT_SUPPORTED);
      }
      return;
    }

    // Dev-only: só processa mensagens com prefixo "calito" pra não criar
    // User de terceiros no banco enquanto se testa no número pessoal.
    // Remover quando o bot for pra número dedicado (Épico 9 / deploy).
    if (!/^\s*calito\b/i.test(text)) return;
    const realText = text.replace(/^\s*calito\b\s*/i, '');

    const user = await this.users.findByPhone(phone);

    if (!user) {
      await this.onboarding.startNewUser(phone, fromPhone);
      return;
    }

    if (user.onboarding_step === UserPendingState.WaitingDeleteConfirm) {
      await this.users.handleDeleteConfirmation(phone, realText, fromPhone);
      return;
    }

    if (user.onboarding_step === UserPendingState.WaitingGoalChoice) {
      await this.users.handleGoalChoice(phone, realText, fromPhone);
      return;
    }

    if (user.onboarding_step === UserPendingState.WaitingWeightUpdate) {
      await this.users.handleWeightUpdate(phone, realText, fromPhone);
      return;
    }

    if (user.onboarding_step !== null) {
      const result = await this.onboarding.handleStep(user.onboarding_step, phone, realText, fromPhone);
      if (result === 'handled') return;
    }

    const intent = await this.classifier.classify(realText);
    this.logger.log(`Intent classificada: ${intent}`);

    if (this.subscription.requiresSubscription(intent) && !this.subscription.isActive(user)) {
      await this.subscription.sendPaywall(fromPhone);
      return;
    }

    await this.router.route(intent, phone, realText, fromPhone);
  }

  private unwrap(msg: IncomingMessage) {
    return (
      msg.message?.ephemeralMessage?.message ??
      msg.message?.viewOnceMessage?.message ??
      msg.message?.viewOnceMessageV2?.message ??
      msg.message?.documentWithCaptionMessage?.message ??
      msg.message
    );
  }

  private extractText(msg: IncomingMessage): string | undefined {
    const inner = this.unwrap(msg);
    return (
      inner?.conversation ??
      inner?.extendedTextMessage?.text ??
      inner?.imageMessage?.caption ??
      inner?.videoMessage?.caption ??
      undefined
    );
  }

  private isMediaMessage(msg: IncomingMessage): boolean {
    const inner = this.unwrap(msg);
    return Boolean(
      inner?.imageMessage ??
      inner?.audioMessage ??
      inner?.videoMessage ??
      inner?.stickerMessage ??
      inner?.documentMessage,
    );
  }
}
