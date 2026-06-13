import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { ConfigurationError } from '../common/errors/configuration.error';

export type PixCharge = {
  paymentId: string;
  qrCode: string; // copia-e-cola
  qrCodeBase64: string; // imagem do QR em base64
};

export type PaymentInfo = {
  id: string;
  status: string; // 'approved' | 'pending' | 'rejected' | 'cancelled' | ...
  externalReference: string | null;
  qrCode: string; // copia-e-cola atual; vazio quando o Pix não está mais disponível
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private payment?: Payment;

  constructor(private readonly config: ConfigService) {}

  // Inicialização preguiçosa: o app sobe mesmo sem MP_ACCESS_TOKEN; só falha
  // quando alguém de fato tenta cobrar (token entra via env no deploy/demo).
  private client(): Payment {
    if (!this.payment) {
      const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
      if (!accessToken) throw new ConfigurationError('MP_ACCESS_TOKEN não configurada');
      this.payment = new Payment(new MercadoPagoConfig({ accessToken }));
    }
    return this.payment;
  }

  async createPixCharge(input: {
    amountBRL: number;
    description: string;
    payerEmail: string;
    externalReference: string;
  }): Promise<PixCharge> {
    const notificationUrl = this.config.get<string>('MP_WEBHOOK_URL');
    const result = await this.client().create({
      body: {
        transaction_amount: input.amountBRL,
        description: input.description,
        payment_method_id: 'pix',
        payer: { email: input.payerEmail },
        external_reference: input.externalReference,
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      },
    });

    const transaction = result.point_of_interaction?.transaction_data;
    return {
      paymentId: String(result.id),
      qrCode: transaction?.qr_code ?? '',
      qrCodeBase64: transaction?.qr_code_base64 ?? '',
    };
  }

  async getPayment(paymentId: string): Promise<PaymentInfo> {
    const result = await this.client().get({ id: paymentId });
    return {
      id: String(result.id),
      status: result.status ?? 'unknown',
      externalReference: result.external_reference ?? null,
      qrCode: result.point_of_interaction?.transaction_data?.qr_code ?? '',
    };
  }
}
