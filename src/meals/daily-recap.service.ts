import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { User } from '@prisma/client';
import { MealsService } from './meals.service';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { startOfDay, startOfNextDay } from './utils/day-bounds';

const RECAP_CRON = '30 20 * * *';
const RECAP_TIMEZONE = 'America/Sao_Paulo';
const THROTTLE_BASE_MS = 1500;
const THROTTLE_JITTER_MS = 1500;

@Injectable()
export class DailyRecapService {
  private readonly logger = new Logger(DailyRecapService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mealsService: MealsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Cron(RECAP_CRON, { name: 'daily-recap', timeZone: RECAP_TIMEZONE })
  async sendDailyRecaps(): Promise<void> {
    const today = new Date();
    const recipients = await this.usersRepository.findOnboardedWithMealsInRange(
      startOfDay(today),
      startOfNextDay(today),
    );

    this.logger.log(`Resumo diário: ${recipients.length} usuário(s) elegível(is)`);

    let sentCount = 0;
    for (const [index, recipient] of recipients.entries()) {
      try {
        const message = await this.mealsService.buildDailyResumeMessage(recipient, today);
        await this.whatsappService.sendText(this.toJid(recipient), message);
        sentCount++;
      } catch (err) {
        this.logger.warn(`Falha ao enviar resumo pro user ${recipient.id}: ${(err as Error).message}`);
      }

      const isLastRecipient = index === recipients.length - 1;
      if (!isLastRecipient) await this.sleep(this.throttleMs());
    }

    this.logger.log(`Resumo diário enviado para ${sentCount}/${recipients.length}`);
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
