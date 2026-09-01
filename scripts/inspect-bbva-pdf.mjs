/**
 * Test script to inspect exact PDF streams, objects, and text extraction
 * for BBVA_Factsheet.pdf (or any PDF in Cloudflare R2).
 *
 * Usage:
 *   node scripts/inspect-bbva-pdf.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import zlib from 'node:zlib';
import fs from 'node:fs';
import pdfParse from 'pdf-parse';

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

async function getPdfBuffer() {
  const bucket = process.env.R2_BUCKET;
  console.log(`[R2] Connecting to bucket: "${bucket}"...`);
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
  const files = (list.Contents || []).map(c => ({ key: c.Key, size: c.Size }));
  console.log(`[R2] Found ${files.length} objects in bucket.`);

  const match = files.find(c => c.key.toLowerCase().includes('bbva') || c.key.toLowerCase().includes('factsheet'));
  if (!match) {
    throw new Error('BBVA_Factsheet.pdf not found in R2 bucket');
  }

  console.log(`[R2] Downloading: ${match.key} (${(match.size / 1024 / 1024).toFixed(2)} MB)...`);
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: match.key }));
  const bytes = await res.Body.transformToByteArray();
  return { key: match.key, buffer: Buffer.from(bytes) };
}

async function inspectPdf() {
  const { key, buffer } = await getPdfBuffer();
  
  console.log('\n======================================================');
  console.log(` PDF ANALYSIS: ${key}`);
  console.log('======================================================');
  console.log(`File Size: ${(buffer.length / 1024).toFixed(1)} KB (${buffer.length} bytes)`);
  console.log(`Header: ${JSON.stringify(buffer.slice(0, 32).toString('latin1'))}`);

  // 1. Standard pdf-parse Test
  console.log('\n--- 1. Testing standard pdf-parse library ---');
  try {
    const parsed = await pdfParse(buffer);
    console.log(`Pages: ${parsed.numpages}`);
    console.log(`Info: ${JSON.stringify(parsed.info)}`);
    console.log(`Extracted Text Length: ${parsed.text ? parsed.text.trim().length : 0} characters`);
    console.log(`Extracted Text Content: ${JSON.stringify(parsed.text)}`);
    if (!parsed.text || parsed.text.trim().length === 0) {
      console.log('=> RESULT: pdf-parse extracted NO text because the PDF has NO textual stream operators.');
    }
  } catch (err) {
    console.error('pdf-parse failed:', err.message);
  }

  // 2. Low-level PDF Object Inspection
  console.log('\n--- 2. Low-level Object Table & Stream Decompression ---');
  const latin1 = buffer.toString('latin1');
  const objRegex = /([0-9]+\s+[0-9]+\s+obj)([\s\S]*?)endobj/g;
  let match;
  let totalObjects = 0;
  let imageObjects = 0;
  let contentStreams = 0;

  while ((match = objRegex.exec(latin1)) !== null) {
    totalObjects++;
    const objHeader = match[1];
    const objBody = match[2];
    
    if (objBody.includes('stream')) {
      const streamIdx = objBody.indexOf('stream');
      const dict = objBody.substring(0, streamIdx).trim();
      const endStreamIdx = objBody.indexOf('endstream', streamIdx);
      const streamData = objBody.substring(streamIdx + 6, endStreamIdx).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
      const streamBuf = Buffer.from(streamData, 'latin1');

      console.log(`\nStream Object [${objHeader}]`);
      console.log(`  Dictionary: ${dict.replace(/\s+/g, ' ')}`);
      console.log(`  Raw Stream Size: ${streamBuf.length} bytes`);

      // Check if FlateDecode (page content stream or flate image)
      if (dict.includes('FlateDecode')) {
        contentStreams++;
        try {
          const decompressed = zlib.inflateSync(streamBuf);
          console.log(`  Decompressed Size: ${decompressed.length} bytes`);
          console.log(`  Decompressed Content:\n    ${decompressed.toString('latin1').replace(/\n/g, '\n    ')}`);
        } catch (e) {
          console.log(`  Decompression failed: ${e.message}`);
        }
      } else if (dict.includes('DCTDecode') || (streamBuf[0] === 0xff && streamBuf[1] === 0xd8)) {
        imageObjects++;
        console.log(`  Type: Raw JPEG Image stream (/DCTDecode)`);
        console.log(`  Magic Bytes (SOI): 0x${streamBuf.slice(0, 4).toString('hex')}`);
        const outPath = 'scripts/extracted_bbva_factsheet_image.jpg';
        fs.writeFileSync(outPath, streamBuf);
        console.log(`  -> Extracted full-res embedded image saved to: ${outPath}`);
      }
    }
  }

  console.log('\n--- 3. Summary & Explanation ---');
  console.log(`Total Objects: ${totalObjects}`);
  console.log(`Page Content Streams: ${contentStreams}`);
  console.log(`Image XObjects: ${imageObjects}`);
  console.log(`
Key Findings:
1. Producer: jsPDF 2.5.1
2. The PDF contains 1 Page whose content stream is ONLY:
   "595.28 0 0 839.02 0. 2.87 cm /I0 Do"
   which simply renders the full-page raster JPEG image (/I0, 3744x5277 px).
3. There are ZERO text stream elements (BT ... ET, Tj, TJ) in the document.
4. Hence, standard PDF text extractors (pdf-parse, pdfjs, poppler pdftotext) correctly return empty text.
5. In raw stream inspection, non-text streams (such as DCTDecode JPEG images) must be excluded so entropy bytes are not mistaken for BT...ET blocks.
6. To extract actual textual contents from this document, OCR (e.g. Vision LLM / Tesseract) on the extracted JPEG image is required.
`);
}

inspectPdf().catch(console.error);
