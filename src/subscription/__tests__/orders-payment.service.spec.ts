import { PaymentService } from '../payment.service';

const create = jest.fn();
const getOrder = jest.fn();
const getPayment = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Order: class { create = create; get = getOrder; },
  Payment: class { get = getPayment; },
}));

describe('PaymentService Orders', () => {
  const service = new PaymentService({ get: () => 'test-token' } as never);
  beforeEach(() => jest.clearAllMocks());

  it('cria uma order Pix e retorna o código recebido', async () => {
    create.mockResolvedValue({ id: 'ORD123', transactions: { payments: [{ payment_method: { qr_code: 'pix', qr_code_base64: 'image' } }] } });
    const result = await service.createPixCharge({ amountBRL: 9.9, description: 'Mensalidade', payerEmail: 'payer@example.com', externalReference: '5511999' });
    expect(result).toEqual({ paymentId: 'ORD123', qrCode: 'pix', qrCodeBase64: 'image' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ type: 'online', processing_mode: 'automatic', total_amount: '9.90', transactions: { payments: [{ amount: '9.90', payment_method: { id: 'pix', type: 'bank_transfer' } }] } }),
      requestOptions: { idempotencyKey: expect.any(String) },
    }));
  });

  it('mapeia uma order Pix pendente e uma aprovada', async () => {
    getOrder.mockResolvedValueOnce({ id: 'ORD123', status: 'action_required', external_reference: '5511999', transactions: { payments: [{ status: 'action_required', status_detail: 'waiting_transfer', payment_method: { qr_code: 'pix' } }] } });
    expect(await service.getPayment('ORD123')).toMatchObject({ status: 'pending', qrCode: 'pix' });
    getOrder.mockResolvedValueOnce({ id: 'ORD123', status: 'processed', external_reference: '5511999', transactions: { payments: [{ status: 'processed' }] } });
    expect(await service.getPayment('ORD123')).toMatchObject({ status: 'approved', externalReference: '5511999' });
  });

  it('consulta IDs antigos pela API Payments', async () => {
    getPayment.mockResolvedValue({ id: 123, status: 'approved', external_reference: '5511999' });
    expect(await service.getPayment('123')).toMatchObject({ id: '123', status: 'approved' });
    expect(getPayment).toHaveBeenCalledWith({ id: '123' });
  });
});
