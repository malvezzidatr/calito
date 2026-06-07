import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

type MercadoPagoNotification = {
  type?: string;
  data?: { id?: string | number };
};

@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(private readonly subscription: SubscriptionService) {}

  @Post()
  @HttpCode(200)
  async handle(@Body() body: MercadoPagoNotification): Promise<{ received: boolean }> {
    const paymentId = this.extractPaymentId(body);
    if (!paymentId) {
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

  private extractPaymentId(body: MercadoPagoNotification): string | null {
    if (body?.type === 'payment' && body.data?.id != null) {
      return String(body.data.id);
    }
    return null;
  }
}
