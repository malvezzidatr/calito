import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { User } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { ParsedMessagesRepository } from '../meals/parsed-messages.repository';
import { EstimatedFoodsRepository } from '../foods/estimated-foods.repository';

const RETENTION_CRON = '0 4 * * 0'; // domingo, 4h
const RETENTION_TIMEZONE = 'America/Sao_Paulo';

/**
 * Prazos de retenção (Art. 15-16 LGPD): sem finalidade ativa que justifique
 * guardar o dado além desses períodos.
 */
const CANCELLED_ACCOUNT_RETENTION_DAYS = 365; // assinante cancelado sem retomar em 1 ano
const UNCONSENTED_ONBOARDING_RETENTION_DAYS = 30; // onboarding travado antes do "sim"/"não"
const CACHE_RETENTION_DAYS = 180; // caches de otimização (ParsedMessageCache, EstimatedFood)

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly parsedMessages: ParsedMessagesRepository,
    private readonly estimatedFoods: EstimatedFoodsRepository,
  ) {}

  @Cron(RETENTION_CRON, { name: 'data-retention-purge', timeZone: RETENTION_TIMEZONE })
  async purge(): Promise<void> {
    await this.purgeCancelledAccounts();
    await this.purgeStaleUnconsentedAccounts();
    await this.purgeStaleCaches();
  }

  private async purgeCancelledAccounts(): Promise<void> {
    const cutoff = this.daysAgo(CANCELLED_ACCOUNT_RETENTION_DAYS);
    const stale = await this.usersRepository.findCancelledInactiveBefore(cutoff);
    await this.deleteAll(stale, 'assinatura cancelada há mais de 1 ano sem retomar');
  }

  private async purgeStaleUnconsentedAccounts(): Promise<void> {
    const cutoff = this.daysAgo(UNCONSENTED_ONBOARDING_RETENTION_DAYS);
    const stale = await this.usersRepository.findStaleUnconsentedBefore(cutoff);
    await this.deleteAll(stale, 'onboarding travado sem consentimento há mais de 30 dias');
  }

  private async deleteAll(users: User[], reason: string): Promise<void> {
    if (users.length === 0) return;

    let deletedCount = 0;
    for (const user of users) {
      try {
        await this.usersRepository.deleteByPhone(user.phone);
        deletedCount++;
      } catch (err) {
        this.logger.warn(`Falha ao purgar conta ${user.id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Retenção — ${reason}: ${deletedCount}/${users.length} conta(s) apagada(s)`);
  }

  private async purgeStaleCaches(): Promise<void> {
    const cutoff = this.daysAgo(CACHE_RETENTION_DAYS);

    const parsedMessagesDeleted = await this.parsedMessages.deleteOlderThan(cutoff);
    const estimatedFoodsDeleted = await this.estimatedFoods.deleteOlderThan(cutoff);

    this.logger.log(
      `Retenção — caches: ${parsedMessagesDeleted} mensagem(ns) e ${estimatedFoodsDeleted} estimativa(s) de alimento purgadas`,
    );
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * DAY_MS);
  }
}
