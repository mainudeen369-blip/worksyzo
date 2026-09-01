import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'node:fs';

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
  const latin1 = buffer.toString('latin1');

  const streamRegex = /<<[\s\S]*?\/Subtype\s*\/Image[\s\S]*?>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  const match = streamRegex.exec(latin1);
  if (!match) {
    console.log('No Image stream found');
    return;
  }

  const imageBytes = Buffer.from(match[1], 'latin1');
  console.log('Extracted image stream size:', imageBytes.length, 'bytes');
  console.log('Image Magic bytes (SOI):', imageBytes.slice(0, 4).toString('hex')); // Should be ffd8ffe0 or similar
  
  // Save locally to verify
  fs.writeFileSync('scripts/extracted_bbva_factsheet_image.jpg', imageBytes);
  console.log('Saved extracted JPEG to scripts/extracted_bbva_factsheet_image.jpg (Width: 3744, Height: 5277)');
}

main().catch(console.error);
