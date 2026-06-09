import { UserStatus } from '@prisma/client';
import { Intent } from '../../ai/intents';

type SubscriptionView = {
  status: UserStatus;
  subscription_expires_at: Date | null;
};

/**
 * Portão único de acesso: a assinatura está ativa se o usuário está marcado
 * como ACTIVE e a validade ainda não passou. Para adicionar trial/uso grátis
 * no futuro, basta acrescentar uma cláusula aqui (ex.: free_meals_remaining > 0).
 */
export function isSubscriptionActive(user: SubscriptionView, now: Date): boolean {
  return (
    user.status === 'ACTIVE' &&
    user.subscription_expires_at !== null &&
    user.subscription_expires_at.getTime() > now.getTime()
  );
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
