import { createHash, randomBytes } from 'node:crypto';

/**
 * Session and invite tokens are opaque and stored only as SHA-256 digests, so
 * a database leak does not hand over live sessions. The raw value exists once,
 * in the response that created it.
 */
export function generateToken(prefix: string, bytes = 32): string {
  return `${prefix}_${randomBytes(bytes).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
