import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import zlib from 'node:zlib';

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

  console.log('=== EXACT PDF OBJECTS DUMP ===\n');
  const objRegex = /([0-9]+\s+[0-9]+\s+obj)([\s\S]*?)endobj/g;
  let match;
  while ((match = objRegex.exec(latin1)) !== null) {
    const objHeader = match[1];
    const objBody = match[2];
    
    if (objBody.includes('stream')) {
      const streamIdx = objBody.indexOf('stream');
      const dict = objBody.substring(0, streamIdx).trim();
      const endStreamIdx = objBody.indexOf('endstream', streamIdx);
      const streamBytes = objBody.substring(streamIdx + 6, endStreamIdx).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
      const streamBuf = Buffer.from(streamBytes, 'latin1');
      
      console.log(`${objHeader} ${dict}`);
      console.log(`  -> Stream length: ${streamBuf.length} bytes`);
      
      // Try inflate
      try {
        const inflated = zlib.inflateSync(streamBuf);
        console.log(`  -> FlateDecoded content (${inflated.length} bytes):`);
        console.log(`     ${inflated.toString('latin1')}`);
      } catch (e) {
        console.log(`  -> Inflate failed (${e.message}), first 64 bytes (hex): ${streamBuf.slice(0, 64).toString('hex')}`);
        // Check if JPEG SOI header (ffd8ffe0 / ffd8ffe1)
        if (streamBuf[0] === 0xff && streamBuf[1] === 0xd8) {
          console.log(`  -> Stream is a JPEG image (SOI marker 0xFF 0xD8 found!)`);
        }
      }
    } else {
      console.log(`${objHeader} ${objBody.trim()}`);
    }
    console.log('----------------------------------------------------');
  }
}

main().catch(console.error);
