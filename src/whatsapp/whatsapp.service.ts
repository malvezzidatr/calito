import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import { createPrismaAuthState } from './prisma-auth-state';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappNotConnectedError } from './exceptions/whatsapp.errors';

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_CAP_MS = 5 * 60 * 1_000;

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock!: WASocket;
  private readyAt = 0;
  private reconnectAttempt = 0;

  constructor(private readonly eventEmitter: EventEmitter2, private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.sock?.end(undefined);
  }

  private async connect() {
    const { state, saveCreds } = await createPrismaAuthState(this.prisma);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.logger.log(
      `Usando WA v${version.join('.')} (latest=${isLatest})`,
    );

    this.sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('QR code gerado — escaneia com o WhatsApp:');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this.readyAt = Math.floor(Date.now() / 1000) - 60;
        this.reconnectAttempt = 0;
        this.logger.log('WhatsApp conectado');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          this.logger.warn(
            'Sessão encerrada pelo usuário. Limpando credenciais e reiniciando pareamento...',
          );
          this.reconnectAttempt = 0;
          await this.clearAuthState();
          void this.connect();
          return;
        }

        const delayMs = this.nextReconnectDelayMs();
        this.logger.warn(
          `Conexão caiu (code=${statusCode}). Reconectando em ${delayMs}ms (tentativa ${this.reconnectAttempt})...`,
        );
        setTimeout(() => void this.connect(), delayMs);
      }
    });

    this.sock.ev.on('messages.upsert', ({ messages, type }) => {

      if (type !== 'notify') return;

      for (const msg of messages) {
        const ts = Number(msg.messageTimestamp ?? 0);
        if (ts < this.readyAt) continue;

        this.eventEmitter.emit('whatsapp.message', msg);
      }
    });
  }

  nextReconnectDelayMs(): number {
    const delay = Math.min(Math.pow(2, this.reconnectAttempt) * RECONNECT_BASE_MS, RECONNECT_CAP_MS);
    this.reconnectAttempt++;
    return delay;
  }

  private async clearAuthState() {
    const { count } = await this.prisma.whatsappAuth.deleteMany({});
    this.logger.log(`Credenciais do WhatsApp removidas do banco (${count} registros).`);
  }

  async sendText(to: string, text: string) {
    if (!this.sock) {
      throw new WhatsappNotConnectedError();
    }

    try {
      await this.sock.presenceSubscribe(to);
      await this.sock.sendPresenceUpdate('composing', to);
    } catch (err) {
      this.logger.warn(`Falha ao enviar presence: ${(err as Error).message}`);
    }

    const typingMs = Math.min(
      6000,
      800 + text.length * 40 + Math.floor(Math.random() * 1500),
    );
    await new Promise((resolve) => setTimeout(resolve, typingMs));

    try {
      await this.sock.sendPresenceUpdate('paused', to);
    } catch {
      // presence paused falhando não é crítico
    }

    return this.sock.sendMessage(to, { text });
  }

  getSocket(): WASocket {
    return this.sock;
  }
}

export type IncomingMessage = WAMessage;
