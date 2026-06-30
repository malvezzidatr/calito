import { createHmac } from 'crypto';
import { verifyMercadoPagoSignature } from '../../utils/mercadopago.signature';

describe('verifyMercadoPagoSignature', () => {
  const secret = 'webhook-secret';
  const dataId = '12345';
  const requestId = 'req-1';
  const ts = '1700000000';

  const signFor = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

  it('accepts a signature whose hash matches the manifest', () => {
    const v1 = signFor(`id:${dataId};request-id:${requestId};ts:${ts};`);
    expect(
      verifyMercadoPagoSignature({ dataId, requestId, secret, signatureHeader: `ts=${ts},v1=${v1}` }),
    ).toBe(true);
  });

  it('omits the request-id segment when it is absent', () => {
    const v1 = signFor(`id:${dataId};ts:${ts};`);
    expect(
      verifyMercadoPagoSignature({ dataId, secret, signatureHeader: `ts=${ts},v1=${v1}` }),
    ).toBe(true);
  });

  it('rejects a tampered hash', () => {
    expect(
      verifyMercadoPagoSignature({ dataId, requestId, secret, signatureHeader: `ts=${ts},v1=deadbeef` }),
    ).toBe(false);
  });

  it('rejects a signature signed with a different secret', () => {
    const v1 = createHmac('sha256', 'other-secret').update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    expect(
      verifyMercadoPagoSignature({ dataId, requestId, secret, signatureHeader: `ts=${ts},v1=${v1}` }),
    ).toBe(false);
  });

  it('rejects a malformed or missing header', () => {
    expect(verifyMercadoPagoSignature({ dataId, secret, signatureHeader: undefined })).toBe(false);
    expect(verifyMercadoPagoSignature({ dataId, secret, signatureHeader: 'garbage' })).toBe(false);
    expect(verifyMercadoPagoSignature({ dataId, secret, signatureHeader: `ts=${ts}` })).toBe(false);
  });
});
