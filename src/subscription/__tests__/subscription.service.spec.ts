jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { User } from '@prisma/client';
import { SubscriptionService } from '../subscription.service';
import { PAYWALL_MESSAGE } from '../messages/subscription.messages';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let sendText: jest.Mock;

  beforeEach(() => {
    sendText = jest.fn().mockResolvedValue(undefined);
    service = new SubscriptionService({ sendText } as never);
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

  it('sendPaywall sends the paywall message to the jid', async () => {
    await service.sendPaywall('jid-1');
    expect(sendText).toHaveBeenCalledWith('jid-1', PAYWALL_MESSAGE);
  });
});
