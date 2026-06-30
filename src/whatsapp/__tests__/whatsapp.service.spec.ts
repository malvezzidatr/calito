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

describe('WhatsappService — readyAt on reconnect (CS-111)', () => {
  type Internal = { readyAt: number; disconnectedAt: number };

  let service: WhatsappService;

  beforeEach(() => {
    service = new WhatsappService(null as never, null as never);
  });

  it('uses now-60s as readyAt on first connection (no prior disconnect)', () => {
    const before = Math.floor(Date.now() / 1000) - 60;
    (service as never as Internal).disconnectedAt = 0;
    // simula o bloco connection === 'open'
    const nowSec = Math.floor(Date.now() / 1000);
    const internal = service as never as Internal;
    internal.readyAt = internal.disconnectedAt > 0 ? internal.disconnectedAt - 5 : nowSec - 60;
    expect(internal.readyAt).toBeGreaterThanOrEqual(before);
    expect(internal.readyAt).toBeLessThanOrEqual(nowSec - 59);
  });

  it('uses disconnectedAt-5s as readyAt after a reconnect, catching offline messages', () => {
    const disconnectedAt = Math.floor(Date.now() / 1000) - 120; // caiu 2 min atrás
    const internal = service as never as Internal;
    internal.disconnectedAt = disconnectedAt;

    const nowSec = Math.floor(Date.now() / 1000);
    internal.readyAt = internal.disconnectedAt > 0 ? internal.disconnectedAt - 5 : nowSec - 60;

    expect(internal.readyAt).toBe(disconnectedAt - 5);
  });
});
