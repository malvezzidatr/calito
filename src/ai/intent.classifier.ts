import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { INTENT_CLASSIFIER_PROMPT } from './prompts/intent.prompt';
import { Intent, isIntent } from './intents';

@Injectable()
export class IntentClassifier {
  private readonly logger = new Logger(IntentClassifier.name);

  constructor(private readonly ai: AiService) {}

  async classify(text: string): Promise<Intent> {
    let reply: string;
    try {
      reply = await this.ai.chat(
        [{ role: 'user', content: text }],
        {
          temperature: 0,
          responseFormat: 'json',
          systemPrompt: INTENT_CLASSIFIER_PROMPT,
          model: 'llama-3.1-8b-instant',
        },
      );
    } catch (err) {
      this.logger.warn(`Falha ao chamar Groq: ${(err as Error).message}`);
      return 'unknown';
    }

    try {
      const parsed = JSON.parse(reply) as { intent?: unknown };
      if (isIntent(parsed.intent)) return parsed.intent;
      this.logger.warn(`Intent inválido: ${reply} (mensagem: "${text}")`);
      return 'unknown';
    } catch {
      this.logger.warn(`JSON inválido: ${reply} (mensagem: "${text}")`);
      return 'unknown';
    }
  }
}
