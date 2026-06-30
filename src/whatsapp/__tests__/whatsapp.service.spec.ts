jest.mock('@whiskeysockets/baileys', () => ({
  makeWASocket: jest.fn(),
  fetchLatestBaileysVersion: jest.fn(),
  DisconnectReason: {},
}));
jest.mock('pino', () => () => ({ level: 'silent' }));
jest.mock('qrcode-terminal', () => ({ generate: jest.fn() }));
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../prisma-auth-state', () => ({ createPrismaAuthState: jest.fn() }));

import { WhatsappService } from '../whatsapp.service';

describe('WhatsappService — reconnect backoff', () => {
  let service: WhatsappService;

  beforeEach(() => {
    service = new WhatsappService(null as never, null as never);
  });

  it('starts at 2s on first disconnect', () => {
    expect(service.nextReconnectDelayMs()).toBe(2_000);
  });

  it('doubles each attempt: 2s → 4s → 8s → 16s', () => {
    const delays = [1, 2, 3, 4].map(() => service.nextReconnectDelayMs());
    expect(delays).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it('caps at 5 minutes regardless of attempt count', () => {
    for (let i = 0; i < 20; i++) service.nextReconnectDelayMs();
    expect(service.nextReconnectDelayMs()).toBe(5 * 60 * 1_000);
  });

  it('resets to 2s after reconnect (simulated via resetReconnectAttempt)', () => {
    service.nextReconnectDelayMs();
    service.nextReconnectDelayMs();
    (service as never as { reconnectAttempt: number }).reconnectAttempt = 0;
    expect(service.nextReconnectDelayMs()).toBe(2_000);
  });
});
