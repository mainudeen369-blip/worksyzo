import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { optionalEnv } from '@worksyzo/db';
import type { ObjectStorage } from './types';

/**
 * Local disk fallback. Path is fully configurable via STORAGE_LOCAL_DIR
 * (absolute or relative to the process working directory).
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  private readonly root: string;

  constructor(rootDir?: string) {
    this.root = path.resolve(rootDir || optionalEnv('STORAGE_LOCAL_DIR', './.data/storage'));
  }

  describe(): string {
    return `local disk → ${this.root}`;
  }

  private fullPath(key: string): string {
    const normalized = key.replace(/\\/g, '/');
    if (normalized.includes('..')) {
      throw new Error('Invalid storage key');
    }
    return path.join(this.root, ...normalized.split('/'));
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.fullPath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.fullPath(key)).catch(() => undefined);
  }
}
