import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsappService, type IncomingMessage } from '../whatsapp/whatsapp.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { UsersService } from '../users/users.service';
import { UserPendingState } from '../users/utils/user-states';
import { IntentClassifier } from '../ai/intent.classifier';
import { IntentRouter } from './intent.router';
import { SubscriptionService } from '../subscription/subscription.service';
import { MEDIA_NOT_SUPPORTED, MESSAGE_TOO_LONG, RATE_LIMITED } from './messages/general.messages';
import { UserMessageLock } from './user-message.lock';
import { MessageRateLimiter } from './message-rate-limiter';
import { MessageIdempotency } from './message-idempotency';
import { redactPhone, redactText } from '../common/utils/log-redactor';

const MAX_TEXT_LENGTH = 1000;

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
    private readonly rateLimiter: MessageRateLimiter,
    private readonly idempotency: MessageIdempotency,
  ) {}

  @OnEvent('whatsapp.message')
  async handle(msg: IncomingMessage) {
    const from = msg.key.remoteJid;
    if (!from || from === 'status@broadcast' || from.endsWith('@g.us')) return;

    // CS-138: a janela de reconexão do WhatsappService pode reentregar uma
    // mensagem já processada — sem isso, uma refeição pode duplicar.
    const messageId = msg.key.id;
    if (messageId) {
      if (this.idempotency.wasSeen(messageId)) {
        this.logger.warn(`Mensagem duplicada ignorada (id=${messageId})`);
        return;
      }
      this.idempotency.markSeen(messageId);
    }

    // Quando o WhatsApp usa LID (remoteJid = <id>@lid), o telefone real
    // vem em remoteJidAlt como <phone>@s.whatsapp.net.
    const fromPhone = msg.key.remoteJidAlt ?? from;
    const phone = fromPhone.split('@')[0];

    // CS-125: limita rajadas por telefone antes de gastar cota de IA.
    if (!this.rateLimiter.allow(phone)) {
      this.logger.warn(`Rate limit atingido pra ${redactPhone(from)}`);
      await this.whatsapp.sendText(fromPhone, RATE_LIMITED);
      return;
    }

    await this.lock.run(phone, () => this.process(msg, phone, fromPhone));
  }

  private async process(msg: IncomingMessage, phone: string, fromPhone: string) {
    const from = msg.key.remoteJid!;
    const text = this.extractText(msg);

    this.logger.log(`Msg de ${redactPhone(from)}: ${text ? redactText(text) : '[não-texto]'}`);

    // Sem texto utilizável: se for mídia (foto/áudio/figurinha) de um usuário já
    // cadastrado, responde que ainda não lê esse formato em vez de ignorar.
    if (!text) {
      if (this.isMediaMessage(msg)) {
        const knownUser = await this.users.findByPhone(phone);
        if (knownUser) await this.whatsapp.sendText(fromPhone, MEDIA_NOT_SUPPORTED);
      }
      return;
    }

    // CS-139: mensagem gigante viraria prompt gigante pra IA — corta cedo.
    if (text.length > MAX_TEXT_LENGTH) {
      this.logger.warn(`Mensagem de ${redactPhone(from)} rejeitada por tamanho (${text.length} chars)`);
      await this.whatsapp.sendText(fromPhone, MESSAGE_TOO_LONG);
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

    if (this.onboarding.needsReconsent(user)) {
      await this.onboarding.requestReconsent(phone, fromPhone);
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

    if (user.onboarding_step === UserPendingState.WaitingHeightUpdate) {
      await this.users.handleHeightUpdate(phone, realText, fromPhone);
      return;
    }

    if (user.onboarding_step === UserPendingState.WaitingAgeUpdate) {
      await this.users.handleAgeUpdate(phone, realText, fromPhone);
      return;
    }

    if (user.onboarding_step === UserPendingState.WaitingGenderUpdate) {
      await this.users.handleGenderUpdate(phone, realText, fromPhone);
      return;
    }

    if (user.onboarding_step === UserPendingState.WaitingActivityUpdate) {
      await this.users.handleActivityUpdate(phone, realText, fromPhone);
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
