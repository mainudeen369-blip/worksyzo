require('dotenv').config({ path: '.env' });
const {
  S3Client,
  ListBucketsCommand,
  PutObjectCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function main() {
  console.log('bucket env =', process.env.R2_BUCKET);
  try {
    const lb = await client.send(new ListBucketsCommand({}));
    console.log(
      'ListBuckets OK:',
      (lb.Buckets || []).map((b) => b.Name),
    );
  } catch (e) {
    console.log('ListBuckets FAIL:', e.name, e.message);
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
    console.log('HeadBucket OK');
  } catch (e) {
    console.log('HeadBucket FAIL:', e.name, e.message);
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: 'healthcheck/test.txt',
        Body: Buffer.from('ok'),
        ContentType: 'text/plain',
      }),
    );
    console.log('PutObject OK');
  } catch (e) {
    console.log('PutObject FAIL:', e.name, e.message);
  }
}

main();
