import { Injectable } from '@nestjs/common';

const TTL_MS = 10 * 60_000;

/**
 * Evita reprocessar a mesma mensagem do WhatsApp mais de uma vez (CS-138).
 * A janela de reconexão do WhatsappService reabre alguns segundos pro passado
 * pra não perder mensagem offline, o que pode reentregar msg.key.id já tratado
 * — sem isso, uma refeição pode ser registrada em duplicidade.
 */
@Injectable()
export class MessageIdempotency {
  private readonly seenAt = new Map<string, number>();

  /** true se o messageId já foi processado dentro da janela TTL. */
  wasSeen(messageId: string, now = Date.now()): boolean {
    this.evictExpired(now);
    return this.seenAt.has(messageId);
  }

  markSeen(messageId: string, now = Date.now()): void {
    this.seenAt.set(messageId, now);
  }

  private evictExpired(now: number): void {
    for (const [id, ts] of this.seenAt) {
      if (now - ts > TTL_MS) this.seenAt.delete(id);
    }
  }
}
