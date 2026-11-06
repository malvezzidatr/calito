import { Injectable, Logger } from '@nestjs/common';
import { User } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { FoodsService } from '../foods/foods.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncomingMessage, WhatsappService } from '../whatsapp/whatsapp.service';
import { validateMealParserResult } from './utils/meal.parser.validation';
import { buildParserEditMessage, isMealParserClarification, MEAL_PARSER_PROMPT, MealParserExtraction } from './utils/meal.parser.prompt';
import { inferMealTypeByHour } from './utils/meal-type.infer';
import { parseYesNo } from '../common/utils/yes-no.parser';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DRAFT_TTL = 24 * 60 * 60 * 1000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function matchesImageType(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return mime === 'image/webp' && buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}
const VISION_PROMPT = `Identifique alimentos visíveis na imagem e use a legenda como contexto. Não invente ingredientes ocultos. Retorne apenas JSON no formato {"foods":[{"food":"nome em português","quantity":1,"unit":"unidade"}],"meal_type":null}. Unidades permitidas: unidade, g, ml, colher, concha, fatia, copo, scoop, prato, porcao. Estime quantidades quando possível; se não houver comida, a imagem estiver ilegível ou for impossível estimar quantidades, retorne {"needs_clarification":"pergunta curta em português pedindo descrição ou foto melhor"}.`;

@Injectable()
export class PhotoMealService {
  private readonly logger = new Logger(PhotoMealService.name);
  private readonly imageHits = new Map<string, number[]>();
  constructor(private readonly ai: AiService, private readonly foods: FoodsService,
    private readonly prisma: PrismaService, private readonly whatsapp: WhatsappService) {}

  private format(parsed: MealParserExtraction): string {
    const items = parsed.foods.map(f => `• ${f.quantity} ${f.unit} de ${f.food}`).join('\n');
    return `Identifiquei estes alimentos (as quantidades são estimadas):\n${items}\n\nResponda *sim* para registrar, *cancelar* para descartar ou escreva uma correção.`;
  }

  async receive(user: User, jid: string, msg: IncomingMessage, image: { mimetype?: string | null; fileLength?: unknown }, caption: string): Promise<void> {
    const now = Date.now();
    for (const [id, hits] of this.imageHits) if (!hits.some(t => t > now - 60_000)) this.imageHits.delete(id);
    const hits = (this.imageHits.get(user.id) ?? []).filter(t => t > now - 60_000);
    if (hits.length >= 5) { await this.whatsapp.sendText(jid, 'Você enviou muitas fotos. Aguarde um minuto e tente novamente.'); return; }
    hits.push(now); this.imageHits.set(user.id, hits);
    const mime = image.mimetype ?? '';
    if (!IMAGE_TYPES.has(mime) || (image.fileLength != null && Number(image.fileLength) > MAX_IMAGE_BYTES)) {
      await this.whatsapp.sendText(jid, 'Envie uma foto JPEG, PNG ou WEBP de até 5 MB.'); return;
    }
    try {
      const existing = await this.prisma.photoMealDraft.findUnique({ where: { user_id: user.id } });
      if (existing?.message_id && existing.message_id === msg.key.id) return;
      if (msg.key.id && await this.prisma.meal.findUnique({ where: { photo_message_id: msg.key.id } })) return;
      const buffer = await this.whatsapp.downloadImage(msg);
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) { await this.whatsapp.sendText(jid, 'A foto deve ter até 5 MB.'); return; }
      if (!matchesImageType(buffer, mime)) { await this.whatsapp.sendText(jid, 'Não consegui reconhecer o formato da foto. Envie uma imagem JPEG, PNG ou WEBP.'); return; }
      const parsed = validateMealParserResult(JSON.parse(await this.ai.analyzeImage(buffer, mime, caption, VISION_PROMPT)));
      if (isMealParserClarification(parsed)) { await this.whatsapp.sendText(jid, parsed.needs_clarification); return; }
      await this.prisma.photoMealDraft.upsert({ where: { user_id: user.id },
        create: { user_id: user.id, foods: parsed.foods, meal_type: parsed.meal_type, message_id: msg.key.id ?? null, expires_at: new Date(now + DRAFT_TTL) },
        update: { foods: parsed.foods, meal_type: parsed.meal_type, message_id: msg.key.id ?? null, expires_at: new Date(now + DRAFT_TTL) } });
      await this.whatsapp.sendText(jid, (existing ? 'A análise anterior foi substituída.\n\n' : '') + this.format(parsed));
    } catch (err) {
      this.logger.warn(`Falha na análise de foto: ${(err as Error).name}`);
      await this.whatsapp.sendText(jid, 'Não consegui analisar essa foto. Tente novamente ou descreva sua refeição em texto.');
    }
  }

  async handlePending(user: User, jid: string, text: string, active = true): Promise<boolean> {
    const draft = await this.prisma.photoMealDraft.findUnique({ where: { user_id: user.id } });
    if (!draft) return false;
    if (draft.expires_at <= new Date()) {
      await this.prisma.photoMealDraft.deleteMany({ where: { id: draft.id } });
      await this.whatsapp.sendText(jid, 'A análise da foto expirou. Envie uma nova foto para registrar a refeição.');
      return true;
    }
    const answer = parseYesNo(text);
    if (answer === 'no' || /^(cancelar|cancela)$/i.test(text.trim())) {
      await this.prisma.photoMealDraft.deleteMany({ where: { id: draft.id } });
      await this.whatsapp.sendText(jid, 'Análise cancelada.'); return true;
    }
    if (!active) {
      await this.whatsapp.sendText(jid, 'Sua assinatura ou período de teste terminou. Renove sua assinatura para registrar esta refeição, ou responda cancelar.');
      return true;
    }
    const parsed = validateMealParserResult({ foods: draft.foods, meal_type: draft.meal_type });
    if (isMealParserClarification(parsed)) return true;
    if (answer !== 'yes' && !/^(confirmar|confirmo)$/i.test(text.trim())) {
      try {
        const description = parsed.foods.map(f => `${f.quantity} ${f.unit} de ${f.food}`).join(', ');
        const response = await this.ai.chat([{ role: 'user', content: buildParserEditMessage(description, text) }], { systemPrompt: MEAL_PARSER_PROMPT, responseFormat: 'json', temperature: 0.2 });
        const corrected = validateMealParserResult(JSON.parse(response));
        if (isMealParserClarification(corrected)) { await this.whatsapp.sendText(jid, corrected.needs_clarification); return true; }
        await this.prisma.photoMealDraft.updateMany({ where: { id: draft.id }, data: { foods: corrected.foods, meal_type: corrected.meal_type ?? draft.meal_type } });
        await this.whatsapp.sendText(jid, this.format(corrected));
      } catch { await this.whatsapp.sendText(jid, 'Não consegui aplicar a correção. Tente novamente ou responda cancelar.'); }
      return true;
    }
    try {
      const calc = await this.foods.calculateWithFallback(parsed.foods);
      if (calc.failed.length || (!calc.matched.length && !calc.estimated.length)) {
        const names = calc.failed.map(f => f.input.food).join(', ') || 'os alimentos';
        await this.whatsapp.sendText(jid, `Não consegui calcular ${names}. Corrija esses itens ou responda cancelar.`); return true;
      }
      const description = parsed.foods.map(f => `${f.quantity} ${f.unit} de ${f.food}`).join(', ');
      const mealType = parsed.meal_type ?? inferMealTypeByHour(new Date());
      const created = await this.prisma.$transaction(async tx => {
        const claimed = await tx.photoMealDraft.deleteMany({ where: { id: draft.id, updated_at: draft.updated_at, expires_at: { gt: new Date() } } });
        if (claimed.count !== 1) return false;
        await tx.meal.create({ data: { user_id: user.id, meal_type: mealType, description, photo_message_id: draft.message_id, ...calc.totals } });
        return true;
      });
      if (created) {
        try {
          await this.whatsapp.sendText(jid, `Refeição registrada! ✅\n${description}\nEstimativa: ${calc.totals.calories} kcal | proteínas ${calc.totals.protein} g | carboidratos ${calc.totals.carbs} g | gorduras ${calc.totals.fat} g.`);
        } catch (err) {
          this.logger.warn(`Refeição salva, mas confirmação não enviada: ${(err as Error).name}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Falha ao registrar foto: ${(err as Error).name}`);
      await this.whatsapp.sendText(jid, 'Não consegui registrar a refeição. Tente confirmar novamente.');
    }
    return true;
  }
}
