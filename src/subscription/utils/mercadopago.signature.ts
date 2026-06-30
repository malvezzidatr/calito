import { createHmac, timingSafeEqual } from 'crypto';

type SignatureInput = {
  dataId: string;
  signatureHeader?: string;
  requestId?: string;
  secret: string;
};

/** Parseia o header `x-signature` do Mercado Pago, no formato "ts=...,v1=...". */
function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
  const parts: { ts?: string; v1?: string } = {};
  for (const segment of header.split(',')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (key === 'ts') parts.ts = value;
    if (key === 'v1') parts.v1 = value;
  }
  return parts;
}

/**
 * Valida a assinatura HMAC-SHA256 do webhook do Mercado Pago. O manifesto segue
 * o template `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (segmentos
 * ausentes são omitidos) e o hash é comparado em tempo constante com o v1.
 */
export function verifyMercadoPagoSignature(input: SignatureInput): boolean {
  if (!input.signatureHeader) return false;

  const { ts, v1 } = parseSignatureHeader(input.signatureHeader);
  if (!ts || !v1) return false;

  let manifest = `id:${input.dataId.toLowerCase()};`;
  if (input.requestId) manifest += `request-id:${input.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(v1);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
