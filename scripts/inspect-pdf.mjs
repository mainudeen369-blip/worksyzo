import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import zlib from 'node:zlib';
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
  console.log('Listing objects in bucket:', bucket);
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
  console.log('Objects found in R2:', (list.Contents || []).map(c => ({ key: c.Key, size: c.Size })));
  
  const match = (list.Contents || []).find(c => c.Key.toLowerCase().includes('bbva') || c.Key.toLowerCase().includes('factsheet'));
  let key;
  if (match) {
    key = match.Key;
  } else if (list.Contents && list.Contents.length > 0) {
    key = list.Contents[0].Key;
  } else {
    throw new Error('No objects found in R2 bucket');
  }

  console.log(`\nFetching object key: ${key}`);
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await res.Body.transformToByteArray();
  return { key, buffer: Buffer.from(bytes) };
}

async function inspectPdf() {
  const { key, buffer } = await getPdfBuffer();
  console.log(`\n=== PDF INSPECTION REPORT FOR: ${key} ===`);
  console.log(`Total Buffer Size: ${buffer.length} bytes`);
  console.log('Header preview:', JSON.stringify(buffer.slice(0, 30).toString('latin1')));
  
  // 1. Test pdf-parse
  console.log('\n--- 1. Testing standard pdf-parse ---');
  try {
    const parsed = await pdfParse(buffer);
    console.log('pdf-parse numpages:', parsed.numpages);
    console.log('pdf-parse info:', JSON.stringify(parsed.info, null, 2));
    console.log('pdf-parse metadata:', JSON.stringify(parsed.metadata, null, 2));
    console.log('pdf-parse text length:', parsed.text ? parsed.text.length : 0);
    console.log('pdf-parse extracted text snippet (first 1000 chars):');
    console.log(parsed.text ? parsed.text.slice(0, 1000) : 'EMPTY');
  } catch (err) {
    console.error('pdf-parse threw error:', err);
  }

  // 2. Low-level PDF Object & Stream Analysis
  console.log('\n--- 2. Low-level PDF Object & Stream Analysis ---');
  const latin1Str = buffer.toString('latin1');
  
  const objRegex = /([0-9]+)\s+([0-9]+)\s+obj([\s\S]*?)endobj/g;
  let objMatch;
  let objCount = 0;
  const objects = [];
  
  while ((objMatch = objRegex.exec(latin1Str)) !== null) {
    objCount++;
    const objNum = objMatch[1];
    const genNum = objMatch[2];
    const objBody = objMatch[3];
    
    const hasStream = objBody.includes('stream') && objBody.includes('endstream');
    let dictPart = hasStream ? objBody.substring(0, objBody.indexOf('stream')) : objBody;
    
    const typeMatch = dictPart.match(/\/Type\s*\/([A-Za-z0-9]+)/);
    const subtypeMatch = dictPart.match(/\/Subtype\s*\/([A-Za-z0-9]+)/);
    const filterMatch = dictPart.match(/\/Filter\s*(\/?\[?[A-Za-z0-9\s/]+\]?)/);
    
    objects.push({
      objNum,
      genNum,
      hasStream,
      type: typeMatch ? typeMatch[1] : null,
      subtype: subtypeMatch ? subtypeMatch[1] : null,
      filter: filterMatch ? filterMatch[1].trim() : null,
      dictPart: dictPart.trim().slice(0, 200),
      fullBody: objBody,
    });
  }
  
  console.log(`Total PDF Objects: ${objCount}`);
  const typeCounts = {};
  for (const o of objects) {
    const k = `Type: ${o.type || 'none'}, Subtype: ${o.subtype || 'none'}, HasStream: ${o.hasStream}`;
    typeCounts[k] = (typeCounts[k] || 0) + 1;
  }
  console.table(typeCounts);

  // 3. Examine Streams & FlateDecode Content
  console.log('\n--- 3. Decompressing and Inspecting Streams ---');
  let streamCount = 0;
  const streamRegex = /<<([\s\S]*?)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let sMatch;
  
  while ((sMatch = streamRegex.exec(latin1Str)) !== null) {
    streamCount++;
    const dict = sMatch[1];
    const rawStreamData = sMatch[2];
    const rawBuf = Buffer.from(rawStreamData, 'latin1');
    
    let decompressed = null;
    let decompressErr = null;
    try {
      decompressed = zlib.inflateSync(rawBuf);
    } catch (e) {
      try {
        decompressed = zlib.inflateRawSync(rawBuf);
      } catch (e2) {
        decompressErr = e.message;
      }
    }

    const payload = decompressed || rawBuf;
    const payloadStr = payload.toString('latin1');
    
    const isToUnicode = dict.includes('/ToUnicode') || payloadStr.includes('begincmap') || payloadStr.includes('beginbfchar');
    const isFont = dict.includes('/Font') || dict.includes('/FontFile') || dict.includes('FontDescriptor');
    const hasTextOps = payloadStr.includes('BT') && payloadStr.includes('ET');
    
    console.log(`Stream #${streamCount}: Raw size=${rawBuf.length}, Decomp size=${decompressed ? decompressed.length : 'FAIL: ' + decompressErr}`);
    console.log(`  Dict: ${dict.replace(/\s+/g, ' ').slice(0, 120)}`);
    console.log(`  Features: hasTextOps=${hasTextOps}, isToUnicode=${isToUnicode}, isFont=${isFont}`);
    
    if (isToUnicode || payloadStr.includes('begincmap')) {
      console.log('  --- CMap / ToUnicode stream snippet: ---');
      console.log(payloadStr.slice(0, 400));
    }
    
    if (hasTextOps) {
      console.log('  --- Text Operations BT...ET snippet: ---');
      const btRegex = /BT([\s\S]*?)ET/g;
      let btMatch;
      let btc = 0;
      while ((btMatch = btRegex.exec(payloadStr)) !== null && btc < 10) {
        btc++;
        console.log(`    BT[${btc}]: ${btMatch[1].replace(/\s+/g, ' ').slice(0, 160)}`);
      }
    }
  }
  
  // 4. Check Font Objects
  console.log('\n--- 4. Checking Font Objects ---');
  for (const o of objects.filter(x => x.type === 'Font' || x.dictPart.includes('/Font'))) {
    console.log(`Font obj #${o.objNum}: ${o.dictPart.replace(/\s+/g, ' ')}`);
  }
}

inspectPdf().catch(console.error);
