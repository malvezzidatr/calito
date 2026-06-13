import { UserStatus } from '@prisma/client';
import { Intent } from '../../ai/intents';

type SubscriptionView = {
  status: UserStatus;
  subscription_expires_at: Date | null;
  trial_ends_at?: Date | null;
};

/** Assinatura paga ativa: marcado como ACTIVE e a validade ainda não passou. */
function isPaidActive(user: SubscriptionView, now: Date): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.subscription_expires_at !== null &&
    user.subscription_expires_at.getTime() > now.getTime()
  );
}

/** Trial em andamento: o fim do trial (3 dias do onboarding) ainda não passou. */
export function isInTrial(user: Pick<SubscriptionView, 'trial_ends_at'>, now: Date): boolean {
  return user.trial_ends_at != null && user.trial_ends_at.getTime() > now.getTime();
}

/**
 * Portão único de acesso: liberado quando há assinatura paga ativa OU o trial
 * ainda está valendo.
 */
export function isSubscriptionActive(user: SubscriptionView, now: Date): boolean {
  return isPaidActive(user, now) || isInTrial(user, now);
}

const FREE_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  'help',
  'subscribe',
  'delete_account',
  'greeting',
]);

/** Intents que continuam liberados mesmo sem assinatura (ajuda, assinar, apagar conta, saudação). */
export function intentRequiresSubscription(intent: Intent): boolean {
  return !FREE_INTENTS.has(intent);
}
