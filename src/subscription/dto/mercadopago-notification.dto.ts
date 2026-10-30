import { Transform, Type } from 'class-transformer';
import { Allow, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * Payload do webhook do Mercado Pago (CS-128). Antes o controller usava um
 * `type` (não validado pelo ValidationPipe global); agora é uma classe real
 * com class-validator, então whitelist/forbidNonWhitelisted/transform passam
 * a ter efeito de fato sobre esse body.
 */
class MercadoPagoNotificationDataDto {
  // O MP pode mandar id como string ou number; normaliza pra string antes de
  // validar. Objetos/arrays NÃO são coagidos — devem falhar IsString (CS-128:
  // antes String(objeto) virava "[object Object]" e passava silenciosamente).
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' || typeof value === 'number' ? String(value) : value))
  @IsString()
  id?: string | number;
}

export class MercadoPagoNotificationDto {
  // Campos de metadados enviados pelo Mercado Pago em notificações payment.
  // A validação global rejeita propriedades não declaradas; esses campos não
  // são usados para autorizar o pagamento, que é consultado na API após HMAC.
  @Allow()
  action?: unknown;

  @Allow()
  api_version?: unknown;

  @Allow()
  date_created?: unknown;

  @Allow()
  id?: unknown;

  @Allow()
  live_mode?: unknown;

  @Allow()
  user_id?: unknown;

  // O MP manda vários tipos de notificação ("payment", "plan",
  // "subscription_preapproval", etc.) — só validamos que é string; a
  // decisão de qual processar é do controller (extractPaymentId).
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoNotificationDataDto)
  data?: MercadoPagoNotificationDataDto;
}
