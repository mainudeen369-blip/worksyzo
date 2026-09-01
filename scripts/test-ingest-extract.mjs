import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { extractTextFromBuffer } from '../packages/ingest/dist/extract.js';

const client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function main() {
  const bucket = process.env.R2_BUCKET;
  const key = 'orgs/38d90c42-1c75-4d69-b2b8-915bc40c9162/documents/a6e3b8da-8a77-4f24-bc11-a27bb2ac4ebc/BBVA_Factsheet.pdf';
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buffer = Buffer.from(await res.Body.transformToByteArray());

  console.log('Testing extractTextFromBuffer on BBVA_Factsheet.pdf:');
  const extracted = await extractTextFromBuffer(buffer, 'application/pdf', 'BBVA_Factsheet.pdf');
  console.log('--- EXTRACTED OUTPUT ---');
  console.log(extracted);
  console.log('------------------------');
  console.log('Length:', extracted.length);
}

main().catch(console.error);
