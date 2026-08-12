import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  update(phone: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { phone },
      data,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  findOnboardedWithMealsInRange(startInclusive: Date, endExclusive: Date) {
    return this.prisma.user.findMany({
      where: {
        onboarding_step: null,
        meals: { some: { created_at: { gte: startInclusive, lt: endExclusive } } },
      },
    });
  }

  /** Usuários em trial (ainda não pagantes) cujo fim do trial cai no intervalo. */
  findTrialEndingBetween(startInclusive: Date, endExclusive: Date) {
    return this.prisma.user.findMany({
      where: {
        onboarding_step: null,
        status: { not: 'ACTIVE' },
        trial_ends_at: { gte: startInclusive, lt: endExclusive },
      },
    });
  }

  /** Assinantes pagos cuja assinatura vence no intervalo. */
  findSubscriptionExpiringBetween(startInclusive: Date, endExclusive: Date) {
    return this.prisma.user.findMany({
      where: {
        onboarding_step: null,
        status: 'ACTIVE',
        subscription_expires_at: { gte: startInclusive, lt: endExclusive },
      },
    });
  }

  deleteByPhone(phone: string) {
    return this.prisma.user.delete({
      where: { phone },
    });
  }

  /** Assinantes cancelados sem atividade há mais que o prazo de retenção (Art. 15-16 LGPD). */
  findCancelledInactiveBefore(cutoff: Date) {
    return this.prisma.user.findMany({
      where: { status: 'CANCELLED', updated_at: { lt: cutoff } },
    });
  }

  /**
   * Onboarding travado antes do consentimento por mais que o prazo de retenção —
   * defensivo: recusa explícita já é apagada na hora (ver OnboardingService), isto
   * cobre quem simplesmente nunca respondeu (minimização, Art. 6 III).
   */
  findStaleUnconsentedBefore(cutoff: Date) {
    return this.prisma.user.findMany({
      where: { consent_given: false, onboarding_step: { not: null }, created_at: { lt: cutoff } },
    });
  }
}
