import { Injectable, OnModuleDestroy } from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_WINDOW = 20;
const CLEANUP_INTERVAL_MS = 10 * 60_000;

/**
 * Limita a frequência de mensagens processadas por telefone (CS-125).
 * Sem isso, um único usuário em rajada consome cota de IA compartilhada
 * (Groq) e degrada o serviço pra todo mundo. UserMessageLock só serializa,
 * não limita — este limiter roda antes dele.
 */
@Injectable()
export class MessageRateLimiter implements OnModuleDestroy {
  private readonly hits = new Map<string, number[]>();
  // CS-141: sem isso, telefones que pararam de mandar mensagem nunca saem
  // do Map — memory leak lento proporcional a números únicos já vistos.
  private readonly cleanupTimer = setInterval(() => this.evictStale(), CLEANUP_INTERVAL_MS).unref();

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  /** true se a mensagem pode ser processada; false se o telefone estourou o limite. */
  allow(phone: string, now = Date.now()): boolean {
    const windowStart = now - WINDOW_MS;
    const recent = (this.hits.get(phone) ?? []).filter((ts) => ts > windowStart);

    if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
      this.hits.set(phone, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(phone, recent);
    return true;
  }

  private evictStale(now = Date.now()): void {
    const windowStart = now - WINDOW_MS;
    for (const [phone, hits] of this.hits) {
      if (!hits.some((ts) => ts > windowStart)) this.hits.delete(phone);
    }
  }
}
