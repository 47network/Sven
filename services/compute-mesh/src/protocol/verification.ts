// ---------------------------------------------------------------------------
// Protocol — Result integrity verification (SHA-256)
// ---------------------------------------------------------------------------
// Workers compute a SHA-256 hash of the plaintext result before encrypting.
// The coordinator decrypts the result, recomputes the hash, and compares.
// Mismatches indicate tampering or corruption — the unit is rejected and
// reassigned to a different device.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

export function computeHash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function verifyHash(data: Buffer, expectedHash: string): boolean {
  const actual = computeHash(data);
  // Constant-time comparison to prevent timing attacks
  if (actual.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) {
    mismatch |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

export function hashJson(data: unknown): string {
  const serialized = Buffer.from(JSON.stringify(data), 'utf-8');
  return computeHash(serialized);
}

export function verifyJsonHash(data: unknown, expectedHash: string): boolean {
  const serialized = Buffer.from(JSON.stringify(data), 'utf-8');
  return verifyHash(serialized, expectedHash);
}
