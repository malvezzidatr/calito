import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { verifyMercadoPagoSignature } from './utils/mercadopago.signature';

type MercadoPagoNotification = {
  type?: string;
  data?: { id?: string | number };
};

@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private readonly subscription: SubscriptionService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Body() body: MercadoPagoNotification,
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
  ): Promise<{ received: boolean }> {
    const paymentId = this.extractPaymentId(body);
    if (!paymentId) {
      return { received: true };
    }

    if (!this.isAuthentic(paymentId, signature, requestId)) {
      this.logger.warn(`Webhook do pagamento ${paymentId} rejeitado: assinatura inválida`);
      return { received: true };
    }

    try {
      await this.subscription.activateFromPayment(paymentId);
    } catch (err) {
      // Responde 200 mesmo em erro pra o MP não ficar reenviando em loop;
      // o reprocessamento pode ser feito sob demanda se necessário.
      this.logger.error(`Falha ao processar webhook do pagamento ${paymentId}: ${(err as Error).message}`);
    }

    return { received: true };
  }

  /**
   * Sem MP_WEBHOOK_SECRET a validação fica desativada (boot sem segredo, igual
   * ao MP_ACCESS_TOKEN lazy) — o segredo entra via env no deploy. Com o segredo
   * configurado, só passa quem traz a assinatura HMAC correta.
   */
  private isAuthentic(paymentId: string, signature?: string, requestId?: string): boolean {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('MP_WEBHOOK_SECRET não configurada — validação de assinatura do webhook desativada');
      return true;
    }
    return verifyMercadoPagoSignature({ dataId: paymentId, signatureHeader: signature, requestId, secret });
  }

  private extractPaymentId(body: MercadoPagoNotification): string | null {
    if (body?.type === 'payment' && body.data?.id != null) {
      return String(body.data.id);
    }
    return null;
  }
}
