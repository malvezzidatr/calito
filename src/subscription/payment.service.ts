import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { MercadoPagoConfig, Order, Payment } from 'mercadopago';
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
  private order?: Order;

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

  private orderClient(): Order {
    if (!this.order) {
      const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
      if (!accessToken) throw new ConfigurationError('MP_ACCESS_TOKEN não configurada');
      this.order = new Order(new MercadoPagoConfig({ accessToken }));
    }
    return this.order;
  }

  async createPixCharge(input: {
    amountBRL: number;
    description: string;
    payerEmail: string;
    externalReference: string;
  }): Promise<PixCharge> {
    const amount = input.amountBRL.toFixed(2);
    const result = await this.orderClient().create({
      body: {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amount,
        description: input.description,
        payer: { email: input.payerEmail },
        external_reference: input.externalReference,
        transactions: { payments: [{ amount, payment_method: { id: 'pix', type: 'bank_transfer' } }] },
      },
      requestOptions: { idempotencyKey: randomUUID() },
    });

    const transaction = result.transactions?.payments?.[0]?.payment_method;
    if (!result.id || !transaction?.qr_code) throw new Error('Order Pix sem ID ou código de pagamento');
    return {
      paymentId: String(result.id),
      qrCode: transaction?.qr_code ?? '',
      qrCodeBase64: transaction?.qr_code_base64 ?? '',
    };
  }

  async getPayment(paymentId: string): Promise<PaymentInfo> {
    if (paymentId.startsWith('ORD')) {
      const result = await this.orderClient().get({ id: paymentId });
      const transaction = result.transactions?.payments?.[0];
      const approved = result.status === 'processed' && transaction?.status === 'processed';
      const pending = result.status === 'action_required' && transaction?.status_detail === 'waiting_transfer';
      return {
        id: result.id ?? paymentId,
        status: approved ? 'approved' : pending ? 'pending' : result.status ?? 'unknown',
        externalReference: result.external_reference ?? null,
        qrCode: transaction?.payment_method?.qr_code ?? '',
      };
    }
    const result = await this.client().get({ id: paymentId });
    return {
      id: String(result.id),
      status: result.status ?? 'unknown',
      externalReference: result.external_reference ?? null,
      qrCode: result.point_of_interaction?.transaction_data?.qr_code ?? '',
    };
  }
}
