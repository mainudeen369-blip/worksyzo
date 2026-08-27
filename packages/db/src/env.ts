import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

/** Walk up from this package to the monorepo root and load the shared .env. */
function loadRootEnv(): void {
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dotenv.config();
}

loadRootEnv();

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '' || value.includes('PASTE_')) {
    throw new Error(
      `Missing ${key}. Open .env and paste your Neon connection string into DATABASE_URL=`,
    );
  }
  return value;
}

export function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
}

/**
 * Single paste UX: only DATABASE_URL is required.
 * Optional DATABASE_ADMIN_URL overrides the owner/migrate connection
 * (used after npm run db:provision creates worksyzo_app).
 */
export const dbEnv = {
  get appUrl(): string {
    return requireEnv('DATABASE_URL');
  },
  get adminUrl(): string {
    const admin = process.env.DATABASE_ADMIN_URL;
    if (admin && admin.trim() !== '' && !admin.includes('PASTE_')) {
      return admin;
    }
    return requireEnv('DATABASE_URL');
  },
  get embeddingDimensions(): number {
    return Number(optionalEnv('EMBEDDING_DIMENSIONS', '1536'));
  },
};
