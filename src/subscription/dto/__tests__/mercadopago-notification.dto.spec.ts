import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MercadoPagoNotificationDto } from '../mercadopago-notification.dto';

async function validatePlain(plain: unknown) {
  const instance = plainToInstance(MercadoPagoNotificationDto, plain);
  return validate(instance);
}

describe('MercadoPagoNotificationDto (CS-128)', () => {
  it('accepts a valid payment notification with string id', async () => {
    const errors = await validatePlain({ type: 'payment', data: { id: '12345' } });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payment notification with numeric id (normalized to string)', async () => {
    const errors = await validatePlain({ type: 'payment', data: { id: 12345 } });
    expect(errors).toHaveLength(0);

    const instance = plainToInstance(MercadoPagoNotificationDto, { type: 'payment', data: { id: 12345 } });
    expect(instance.data?.id).toBe('12345');
  });

  it('rejects data.id being an object instead of string/number', async () => {
    const errors = await validatePlain({ type: 'payment', data: { id: { evil: true } } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects data.id being an array instead of string/number', async () => {
    const errors = await validatePlain({ type: 'payment', data: { id: ['12345'] } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts other notification types the MP sends (plan, subscription_preapproval etc)', async () => {
    const errors = await validatePlain({ type: 'subscription_preapproval', data: { id: '12345' } });
    expect(errors).toHaveLength(0);
  });

  it('rejects type that is not a string', async () => {
    const errors = await validatePlain({ type: 123, data: { id: '12345' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a payload without data (ignored downstream by extractPaymentId)', async () => {
    const errors = await validatePlain({ type: 'plan' });
    expect(errors).toHaveLength(0);
  });
});
