jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { SubscriptionService } from '../subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let sendText: jest.Mock;
  let configGet: jest.Mock;

  beforeEach(() => {
    sendText = jest.fn().mockResolvedValue(undefined);
    configGet = jest.fn().mockReturnValue(undefined); // sem env -> usa default
    service = new SubscriptionService({ sendText } as never, { get: configGet } as never);
  });

  it('isActive is true for an ACTIVE user whose subscription has not expired', () => {
    const farFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const user = { status: 'ACTIVE', subscription_expires_at: farFuture } as unknown as User;
    expect(service.isActive(user)).toBe(true);
  });

  it('isActive is false for a user who never paid', () => {
    const user = { status: 'INACTIVE', subscription_expires_at: null } as unknown as User;
    expect(service.isActive(user)).toBe(false);
  });

  it('requiresSubscription gates paid intents but not free ones', () => {
    expect(service.requiresSubscription('register_meal')).toBe(true);
    expect(service.requiresSubscription('help')).toBe(false);
  });

  it('defaults the monthly price to 9.90 when not configured', () => {
    expect(service.getMonthlyPriceBRL()).toBe(9.9);
  });

  it('reads the monthly price from SUBSCRIPTION_PRICE_BRL when set', () => {
    configGet.mockReturnValue('19.90');
    expect(service.getMonthlyPriceBRL()).toBe(19.9);
  });

  it('sendPaywall sends a paywall message with the configured price', async () => {
    await service.sendPaywall('jid-1');
    const [jid, message] = sendText.mock.calls[0];
    expect(jid).toBe('jid-1');
    expect(message).toContain('R$ 9,90/mês');
  });
});
