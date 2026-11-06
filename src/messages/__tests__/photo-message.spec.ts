jest.mock('../../whatsapp/whatsapp.service', () => ({ WhatsappService: class {} }));
import { MessagesHandler } from '../messages.handler';

describe('photo message routing', () => {
  let handler: MessagesHandler;
  let onboarding: any, users: any, subscription: any, whatsapp: any, photos: any, classifier: any, config: any, router: any;
  const user = { id: 'u1', onboarding_step: null };
  const message = (caption?: string) => ({ key: { id: 'm1', remoteJid: '123@s.whatsapp.net' }, message: { imageMessage: { mimetype: 'image/jpeg', caption } } }) as any;

  beforeEach(() => {
    onboarding = { needsReconsent: jest.fn().mockReturnValue(false), startNewUser: jest.fn(), requestReconsent: jest.fn() };
    users = { findByPhone: jest.fn().mockResolvedValue(user) };
    subscription = { isActive: jest.fn().mockReturnValue(true), sendPaywall: jest.fn() };
    whatsapp = { sendText: jest.fn() };
    photos = { receive: jest.fn(), handlePending: jest.fn().mockResolvedValue(false) };
    classifier = { classify: jest.fn() };
    config = { get: jest.fn() };
    router = { route: jest.fn() };
    handler = new MessagesHandler(onboarding, users, classifier, router, subscription, whatsapp,
      { run: (_id, fn) => fn() } as any, { allow: () => true } as any,
      { wasSeen: () => false, markSeen: () => {} } as any, photos, config);
  });

  it('blocks photos without processing their captions when disabled', async () => {
    config.get.mockReturnValue('false');
    await handler.handle(message('almoço'));
    expect(photos.receive).not.toHaveBeenCalled();
    expect(classifier.classify).not.toHaveBeenCalled();
    expect(whatsapp.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('indisponível'));
  });

  it('routes text normally without consuming pending photo drafts when disabled', async () => {
    config.get.mockReturnValue('false');
    classifier.classify.mockResolvedValue('other');
    subscription.requiresSubscription = jest.fn().mockReturnValue(false);
    await handler.handle({ key: { remoteJid: '123@s.whatsapp.net' }, message: { conversation: 'olá' } } as any);
    expect(photos.handlePending).not.toHaveBeenCalled();
    expect(classifier.classify).toHaveBeenCalledWith('olá');
  });

  it.each([undefined, 'almoço'])('routes image with caption %s without classifying text', async caption => {
    const msg = message(caption);
    await handler.handle(msg);
    expect(photos.receive).toHaveBeenCalledWith(user, '123@s.whatsapp.net', msg, msg.message.imageMessage, caption ?? '');
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it('blocks an inactive subscription before image processing', async () => {
    subscription.isActive.mockReturnValue(false);
    await handler.handle(message());
    expect(subscription.sendPaywall).toHaveBeenCalled();
    expect(photos.receive).not.toHaveBeenCalled();
  });

  it('requires consent before image processing', async () => {
    onboarding.needsReconsent.mockReturnValue(true);
    await handler.handle(message());
    expect(onboarding.requestReconsent).toHaveBeenCalled();
    expect(photos.receive).not.toHaveBeenCalled();
  });

  it('requires onboarding before image processing', async () => {
    users.findByPhone.mockResolvedValue({ ...user, onboarding_step: 'waiting_name' });
    await handler.handle(message());
    expect(whatsapp.sendText).toHaveBeenCalled();
    expect(photos.receive).not.toHaveBeenCalled();
  });
});
