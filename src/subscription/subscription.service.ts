import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Intent } from '../ai/intents';
import { isSubscriptionActive, intentRequiresSubscription } from './utils/subscription.access';
import { PAYWALL_MESSAGE } from './messages/subscription.messages';

@Injectable()
export class SubscriptionService {
  constructor(private readonly whatsapp: WhatsappService) {}

  isActive(user: User): boolean {
    return isSubscriptionActive(user, new Date());
  }

  requiresSubscription(intent: Intent): boolean {
    return intentRequiresSubscription(intent);
  }

  async sendPaywall(jid: string): Promise<void> {
    await this.whatsapp.sendText(jid, PAYWALL_MESSAGE);
  }
}
