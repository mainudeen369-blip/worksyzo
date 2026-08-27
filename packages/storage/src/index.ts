import { optionalEnv } from '@worksyzo/db';
import { LocalObjectStorage } from './local';
import { R2ObjectStorage } from './r2';
import type { ObjectStorage } from './types';

let cached: ObjectStorage | null = null;

/**
 * STORAGE_DRIVER:
 *   r2     — Cloudflare R2 (recommended for real deploys)
 *   local  — disk path from STORAGE_LOCAL_DIR (dev / air-gapped fallback)
 */
export function getObjectStorage(): ObjectStorage {
  if (cached) return cached;

  const driver = optionalEnv('STORAGE_DRIVER', 'local').toLowerCase();
  if (driver === 'r2' || driver === 'cloudflare' || driver === 'cloudflare_r2') {
    cached = new R2ObjectStorage();
  } else if (driver === 'local') {
    cached = new LocalObjectStorage();
  } else {
    throw new Error(
      `Unknown STORAGE_DRIVER="${driver}". Use "r2" (Cloudflare) or "local".`,
    );
  }
  return cached;
}

/** Reset cache (tests / after env change in same process). */
export function resetObjectStorage(): void {
  cached = null;
}

export function storageSetupHint(): string {
  const driver = optionalEnv('STORAGE_DRIVER', 'local').toLowerCase();
  if (driver === 'r2' || driver === 'cloudflare' || driver === 'cloudflare_r2') {
    return 'Cloudflare R2 enabled. Ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET are set.';
  }
  return `Local disk enabled. Files go to STORAGE_LOCAL_DIR (${optionalEnv('STORAGE_LOCAL_DIR', './.data/storage')}). Set STORAGE_DRIVER=r2 for Cloudflare.`;
}

export * from './types';
export * from './local';
export * from './r2';
