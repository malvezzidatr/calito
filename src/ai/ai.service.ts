import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from './ai.prompts';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatOptions = {
  temperature?: number;
  responseFormat?: 'json' | 'text';
  systemPrompt?: string;
};

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private client!: Groq;
  private model!: string;
  private defaultTemperature!: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY não configurada');

    this.client = new Groq({ apiKey });
    this.model = this.config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
    this.defaultTemperature = Number(this.config.get('GROQ_TEMPERATURE') ?? 0.2);
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const completion = await this.client.chat.completions.create({
    model: this.model,
    temperature: opts.temperature ?? this.defaultTemperature,
    ...(opts.responseFormat === 'json' && {
      response_format: { type: 'json_object' as const },
    }),
    messages: [
      { role: 'system', content: opts.systemPrompt ?? SYSTEM_PROMPT },
      ...messages,
    ],
  });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia do Groq');

    const usage = completion.usage;
    this.logger.debug(
      `tokens: prompt=${usage?.prompt_tokens} completion=${usage?.completion_tokens}`,
    );

    return content;
  }
}
