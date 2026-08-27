import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { optionalEnv, requireEnv } from '@worksyzo/db';
import type { ObjectStorage } from './types';

/**
 * Cloudflare R2 (S3-compatible). Primary production storage for Worksyzo docs.
 *
 * Required env:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET
 * Optional:
 *   R2_ENDPOINT  (defaults to https://{accountId}.r2.cloudflarestorage.com)
 *   R2_REGION    (defaults to auto)
 */
export class R2ObjectStorage implements ObjectStorage {
  readonly driver = 'r2' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor() {
    const accountId = requireEnv('R2_ACCOUNT_ID');
    this.bucket = requireEnv('R2_BUCKET');
    this.endpoint = optionalEnv(
      'R2_ENDPOINT',
      `https://${accountId}.r2.cloudflarestorage.com`,
    );
    this.client = new S3Client({
      region: optionalEnv('R2_REGION', 'auto'),
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
      // R2 is path-style friendly; also avoids some virtual-host edge cases.
      forcePathStyle: true,
      // AWS SDK v3 default checksums break many R2 puts ("Access Denied").
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  describe(): string {
    return `Cloudflare R2 → bucket "${this.bucket}" @ ${this.endpoint}`;
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`R2 object missing body: ${key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    ).catch(() => undefined);
  }
}
