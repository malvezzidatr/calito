import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { User } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SubscriptionService } from './subscription.service';
import { formatRenewalReminder, formatSubscriptionExpired } from './messages/subscription.messages';

const RENEWAL_CRON = '0 12 * * *';
const REMINDER_TIMEZONE = 'America/Sao_Paulo';
const DAY_MS = 24 * 60 * 60 * 1000;
const THROTTLE_BASE_MS = 1500;
const THROTTLE_JITTER_MS = 1500;

@Injectable()
export class RenewalReminderService {
  private readonly logger = new Logger(RenewalReminderService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly whatsapp: WhatsappService,
    private readonly subscription: SubscriptionService,
  ) {}

  @Cron(RENEWAL_CRON, { name: 'renewal-reminder', timeZone: REMINDER_TIMEZONE })
  async sendRenewalReminders(): Promise<void> {
    const now = new Date();
    const price = this.subscription.getMonthlyPriceBRL();

    const expiringSoon = await this.usersRepository.findSubscriptionExpiringBetween(
      now,
      new Date(now.getTime() + DAY_MS),
    );
    for (const [i, user] of expiringSoon.entries()) {
      await this.notify(user, formatRenewalReminder(price, user.subscription_expires_at!), 'vence amanhã');
      if (i < expiringSoon.length - 1) await this.sleep(this.throttleMs());
    }

    const justExpired = await this.usersRepository.findSubscriptionExpiringBetween(
      new Date(now.getTime() - DAY_MS),
      now,
    );
    for (const [i, user] of justExpired.entries()) {
      await this.usersRepository.update(user.phone, { status: 'INACTIVE' });
      await this.notify(user, formatSubscriptionExpired(price), 'expirada (D0)');
      if (i < justExpired.length - 1) await this.sleep(this.throttleMs());
    }

    this.logger.log(
      `Renewal reminders: ${expiringSoon.length} D-1, ${justExpired.length} D0`,
    );
  }

  private async notify(user: User, message: string, label: string): Promise<void> {
    try {
      await this.whatsapp.sendText(`${user.phone}@s.whatsapp.net`, message);
    } catch (err) {
      this.logger.warn(`Falha ao avisar user ${user.id} (${label}): ${(err as Error).message}`);
    }
  }

  private throttleMs(): number {
    return THROTTLE_BASE_MS + Math.floor(Math.random() * THROTTLE_JITTER_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
