import { Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_WINDOW = 20;

/**
 * Limita a frequência de mensagens processadas por telefone (CS-125).
 * Sem isso, um único usuário em rajada consome cota de IA compartilhada
 * (Groq) e degrada o serviço pra todo mundo. UserMessageLock só serializa,
 * não limita — este limiter roda antes dele.
 */
@Injectable()
export class MessageRateLimiter {
  private readonly hits = new Map<string, number[]>();

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
}
