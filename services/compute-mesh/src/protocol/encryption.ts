// ---------------------------------------------------------------------------
// Protocol — AES-256-GCM work unit payload encryption
// ---------------------------------------------------------------------------
// Every work unit payload is encrypted before transit. Workers receive the
// key ID and fetch the corresponding decryption key from the coordinator
// via a short-lived NATS request-reply exchange.
// ---------------------------------------------------------------------------

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 96-bit IV recommended for GCM
const KEY_LENGTH = 32;     // 256-bit key
const TAG_LENGTH = 16;     // 128-bit auth tag

export interface EncryptionKey {
  id: string;
  key: Buffer;
  createdAt: number;
}

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: string;
}

/* ─────────────────────────── Key management ───────────────────────────────── */

const keyStore = new Map<string, EncryptionKey>();

export function generateKey(): EncryptionKey {
  const id = randomBytes(8).toString('hex');
  const key = randomBytes(KEY_LENGTH);
  const entry: EncryptionKey = { id, key, createdAt: Date.now() };
  keyStore.set(id, entry);
  return entry;
}

export function getKey(id: string): EncryptionKey | undefined {
  return keyStore.get(id);
}

export function revokeKey(id: string): boolean {
  return keyStore.delete(id);
}

export function rotateKeys(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let revoked = 0;
  for (const [id, entry] of keyStore) {
    if (entry.createdAt < cutoff) {
      keyStore.delete(id);
      revoked++;
    }
  }
  return revoked;
}

/* ──────────────────────────── Encrypt / Decrypt ──────────────────────────── */

export function encrypt(plaintext: Buffer, encKey: EncryptionKey): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encKey.key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag, keyId: encKey.id };
}

export function decrypt(payload: EncryptedPayload): Buffer {
  const encKey = keyStore.get(payload.keyId);
  if (!encKey) {
    throw new Error(`Encryption key "${payload.keyId}" not found or revoked`);
  }
  const decipher = createDecipheriv(ALGORITHM, encKey.key, payload.iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
}

export function encryptJson(data: unknown, encKey: EncryptionKey): EncryptedPayload {
  const plaintext = Buffer.from(JSON.stringify(data), 'utf-8');
  return encrypt(plaintext, encKey);
}

export function decryptJson<T = unknown>(payload: EncryptedPayload): T {
  const plaintext = decrypt(payload);
  return JSON.parse(plaintext.toString('utf-8')) as T;
}

/* ──────────────────────────── Serialization helpers ──────────────────────── */

export function payloadToBase64(payload: EncryptedPayload): {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
} {
  return {
    ciphertext: payload.ciphertext.toString('base64'),
    iv: payload.iv.toString('base64'),
    authTag: payload.authTag.toString('base64'),
    keyId: payload.keyId,
  };
}

export function base64ToPayload(data: {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}): EncryptedPayload {
  return {
    ciphertext: Buffer.from(data.ciphertext, 'base64'),
    iv: Buffer.from(data.iv, 'base64'),
    authTag: Buffer.from(data.authTag, 'base64'),
    keyId: data.keyId,
  };
}
