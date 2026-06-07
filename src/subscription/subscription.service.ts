import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Intent } from '../ai/intents';
import { isSubscriptionActive, intentRequiresSubscription } from './utils/subscription.access';
import { formatPaywallMessage } from './messages/subscription.messages';

const DEFAULT_MONTHLY_PRICE_BRL = 9.9;

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
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
}
