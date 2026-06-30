import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { User } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SubscriptionService } from './subscription.service';
import { formatTrialEndingReminder, formatPaywallMessage } from './messages/subscription.messages';

const TRIAL_REMINDER_CRON = '0 12 * * *';
const REMINDER_TIMEZONE = 'America/Sao_Paulo';
const DAY_MS = 24 * 60 * 60 * 1000;
const THROTTLE_BASE_MS = 1500;
const THROTTLE_JITTER_MS = 1500;

@Injectable()
export class TrialReminderService {
  private readonly logger = new Logger(TrialReminderService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly whatsapp: WhatsappService,
    private readonly subscription: SubscriptionService,
  ) {}

  /**
   * Roda 1x/dia. As janelas de 24h se encaixam entre execuções consecutivas,
   * então cada usuário recebe exatamente um lembrete "termina amanhã" e, no dia
   * seguinte, um aviso de "trial expirado" — sem precisar de flag de controle.
   */
  @Cron(TRIAL_REMINDER_CRON, { name: 'trial-reminder', timeZone: REMINDER_TIMEZONE })
  async sendTrialReminders(): Promise<void> {
    const now = new Date();
    const price = this.subscription.getMonthlyPriceBRL();

    const expiringSoon = await this.usersRepository.findTrialEndingBetween(now, new Date(now.getTime() + DAY_MS));
    await this.notifyAll(expiringSoon, formatTrialEndingReminder(price), 'fim de trial (D-1)');

    const justEnded = await this.usersRepository.findTrialEndingBetween(new Date(now.getTime() - DAY_MS), now);
    await this.notifyAll(justEnded, formatPaywallMessage(price), 'trial expirado (D0)');
  }

  private async notifyAll(recipients: User[], message: string, label: string): Promise<void> {
    this.logger.log(`Lembrete ${label}: ${recipients.length} usuário(s) elegível(is)`);

    let sentCount = 0;
    for (const [index, recipient] of recipients.entries()) {
      try {
        await this.whatsapp.sendText(this.toJid(recipient), message);
        sentCount++;
      } catch (err) {
        this.logger.warn(`Falha ao avisar user ${recipient.id}: ${(err as Error).message}`);
      }

      const isLastRecipient = index === recipients.length - 1;
      if (!isLastRecipient) await this.sleep(this.throttleMs());
    }

    this.logger.log(`Lembrete ${label} enviado para ${sentCount}/${recipients.length}`);
  }

  private toJid(user: User): string {
    return `${user.phone}@s.whatsapp.net`;
  }

  private throttleMs(): number {
    return THROTTLE_BASE_MS + Math.floor(Math.random() * THROTTLE_JITTER_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
