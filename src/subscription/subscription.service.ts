import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UsersRepository } from '../users/users.repository';
import { Intent } from '../ai/intents';
import { PaymentService } from './payment.service';
import { isSubscriptionActive, intentRequiresSubscription } from './utils/subscription.access';
import {
  formatPaywallMessage,
  formatCheckoutMessage,
  formatSubscriptionActivated,
  formatTrialStarted,
  CHECKOUT_ERROR,
} from './messages/subscription.messages';

const DEFAULT_MONTHLY_PRICE_BRL = 9.9;
const SUBSCRIPTION_DAYS = 30;
const TRIAL_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const APPROVED = 'approved';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly paymentService: PaymentService,
  ) {}

  isActive(user: User): boolean {
    return isSubscriptionActive(user, new Date());
  }

  requiresSubscription(intent: Intent): boolean {
    return intentRequiresSubscription(intent);
  }

  getMonthlyPriceBRL(): number {
    const configured = this.config.get<string>('SUBSCRIPTION_PRICE_BRL');
    const price = configured !== undefined ? Number(configured) : DEFAULT_MONTHLY_PRICE_BRL;
    return Number.isFinite(price) && price > 0 ? price : DEFAULT_MONTHLY_PRICE_BRL;
  }

  async sendPaywall(jid: string): Promise<void> {
    await this.whatsapp.sendText(jid, formatPaywallMessage(this.getMonthlyPriceBRL()));
  }

  /**
   * Concede o trial de 3 dias no fim do onboarding e avisa o usuário. O acesso
   * durante o trial é resolvido por `trial_ends_at` em isSubscriptionActive — o
   * status segue INACTIVE (reservado pra assinatura paga).
   */
  async startTrial(phone: string, jid: string): Promise<void> {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * DAY_MS);
    await this.usersRepository.update(phone, { trial_ends_at: trialEndsAt });
    await this.whatsapp.sendText(jid, formatTrialStarted(trialEndsAt, TRIAL_DAYS));
  }

  async startCheckout(phone: string, jid: string): Promise<void> {
    const price = this.getMonthlyPriceBRL();

    let charge;
    try {
      charge = await this.paymentService.createPixCharge({
        amountBRL: price,
        description: 'Assinatura mensal Calito',
        payerEmail: `${phone}@calito.app`,
        externalReference: phone,
      });
    } catch (err) {
      this.logger.error(`Falha ao gerar cobrança Pix de ${phone}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, CHECKOUT_ERROR);
      return;
    }

    await this.usersRepository.update(phone, { subscription_id: charge.paymentId });

    await this.whatsapp.sendText(jid, formatCheckoutMessage(price));
    await this.whatsapp.sendText(jid, charge.qrCode);
  }

  async activateFromPayment(paymentId: string): Promise<void> {
    const payment = await this.paymentService.getPayment(paymentId);

    if (payment.status !== APPROVED) {
      this.logger.log(`Pagamento ${paymentId} ignorado (status=${payment.status})`);
      return;
    }

    const phone = payment.externalReference;
    if (!phone) {
      this.logger.warn(`Pagamento ${paymentId} aprovado sem external_reference`);
      return;
    }

    const user = await this.usersRepository.findByPhone(phone);
    if (!user) {
      this.logger.warn(`Pagamento ${paymentId} aprovado para phone desconhecido ${phone}`);
      return;
    }

    // idempotência: webhook pode chegar duplicado para o mesmo pagamento
    if (user.subscription_id === paymentId && this.isActive(user)) {
      this.logger.log(`Pagamento ${paymentId} já processado para ${phone}`);
      return;
    }

    const expiresAt = new Date(Date.now() + SUBSCRIPTION_DAYS * DAY_MS);
    await this.usersRepository.update(phone, {
      status: 'ACTIVE',
      subscription_expires_at: expiresAt,
      subscription_id: paymentId,
    });

    await this.whatsapp.sendText(`${phone}@s.whatsapp.net`, formatSubscriptionActivated(expiresAt));
  }
}
