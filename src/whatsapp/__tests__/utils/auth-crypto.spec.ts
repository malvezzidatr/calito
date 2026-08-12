import { randomBytes } from 'crypto';
import { decryptJson, encryptJson, isEncryptedPayload, loadAuthEncryptionKey } from '../../utils/auth-crypto';
import { ConfigurationError } from '../../../common/errors/configuration.error';

describe('loadAuthEncryptionKey', () => {
  it('throws when no key is configured', () => {
    expect(() => loadAuthEncryptionKey(undefined)).toThrow(ConfigurationError);
  });

  it('throws when the decoded key is not 32 bytes', () => {
    expect(() => loadAuthEncryptionKey(Buffer.from('too-short').toString('base64'))).toThrow(ConfigurationError);
  });

  it('accepts a valid 32-byte base64 key', () => {
    const key = randomBytes(32).toString('base64');
    expect(loadAuthEncryptionKey(key)).toHaveLength(32);
  });
});

describe('encryptJson / decryptJson', () => {
  const key = randomBytes(32);

  it('round-trips an arbitrary JSON-serializable value', () => {
    const value = { creds: { noiseKey: 'abc' }, count: 3, nested: { ok: true } };
    const encrypted = encryptJson(value, key);

    expect(decryptJson(encrypted, key)).toEqual(value);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const value = { same: 'value' };
    const first = encryptJson(value, key);
    const second = encryptJson(value, key);

    expect(first.data).not.toBe(second.data);
    expect(first.iv).not.toBe(second.iv);
  });

  it('fails to decrypt with the wrong key (auth tag mismatch)', () => {
    const encrypted = encryptJson({ secret: true }, key);
    const wrongKey = randomBytes(32);

    expect(() => decryptJson(encrypted, wrongKey)).toThrow();
  });
});

describe('isEncryptedPayload', () => {
  it('recognizes a well-formed payload', () => {
    const key = randomBytes(32);
    expect(isEncryptedPayload(encryptJson({ a: 1 }, key))).toBe(true);
  });

  it('rejects plain unencrypted data (pre-migration records)', () => {
    expect(isEncryptedPayload({ noiseKey: 'abc' })).toBe(false);
    expect(isEncryptedPayload(null)).toBe(false);
    expect(isEncryptedPayload('string')).toBe(false);
  });
});
