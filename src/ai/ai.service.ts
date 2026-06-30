import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from './prompts/ai.prompts';
import { ConfigurationError } from '../common/errors/configuration.error';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatOptions = {
  temperature?: number;
  responseFormat?: 'json' | 'text';
  systemPrompt?: string;
  model?: string;
};

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private client!: Groq;
  private model!: string;
  private defaultTemperature!: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) throw new ConfigurationError('GROQ_API_KEY não configurada');

    this.client = new Groq({ apiKey });
    this.model = this.config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
    this.defaultTemperature = Number(this.config.get('GROQ_TEMPERATURE') ?? 0.2);
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const params = {
      model: opts.model ?? this.model,
      temperature: opts.temperature ?? this.defaultTemperature,
      ...(opts.responseFormat === 'json' && {
        response_format: { type: 'json_object' as const },
      }),
      messages: [
        { role: 'system' as const, content: opts.systemPrompt ?? SYSTEM_PROMPT },
        ...messages,
      ],
    };

    const completion = await this.withRetry(() => this.client.chat.completions.create(params));

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia do Groq');

    const usage = completion.usage;
    this.logger.debug(
      `tokens: prompt=${usage?.prompt_tokens} completion=${usage?.completion_tokens}`,
    );

    return content;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isRateLimit = (err as { status?: number }).status === 429;
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delayMs = Math.pow(2, attempt) * RETRY_BASE_MS;
          this.logger.warn(`Rate limit Groq — retry ${attempt + 1}/${MAX_RETRIES} em ${delayMs}ms`);
          await this.sleep(delayMs);
          continue;
        }
        throw err;
      }
    }
    throw new Error('unreachable');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
