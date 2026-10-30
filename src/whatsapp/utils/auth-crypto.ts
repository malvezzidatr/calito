import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigurationError } from '../../common/errors/configuration.error';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

export type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

/** Chave fora do banco (env) pra cifrar WhatsappAuth.data — segredo de sessão, não dado de aplicação comum. */
export function loadAuthEncryptionKey(rawKey: string | undefined): Buffer {
  if (!rawKey) {
    throw new ConfigurationError('WHATSAPP_AUTH_ENCRYPTION_KEY não configurada (chave base64 de 32 bytes)');
  }
  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new ConfigurationError(
      `WHATSAPP_AUTH_ENCRYPTION_KEY precisa decodificar pra ${KEY_LENGTH_BYTES} bytes em base64 (veio ${key.length})`,
    );
  }
  return key;
}

export function encryptJson(value: unknown, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

export function decryptJson<T>(payload: EncryptedPayload, key: Buffer): T {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { v?: unknown }).v === 1 &&
    typeof (value as { iv?: unknown }).iv === 'string' &&
    typeof (value as { tag?: unknown }).tag === 'string' &&
    typeof (value as { data?: unknown }).data === 'string'
  );
}
