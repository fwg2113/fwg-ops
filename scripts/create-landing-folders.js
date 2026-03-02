// Run this locally: node scripts/create-landing-folders.js
// Creates the folder structure in the fwg-landing R2 bucket.
// Requires these env vars (or paste them in a .env.local):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = 'fwg-landing'

const folders = [
  // commercial-vehicle-wraps
  'commercial-vehicle-wraps/hero/',
  'commercial-vehicle-wraps/service-1/',
  'commercial-vehicle-wraps/service-2/',
  'commercial-vehicle-wraps/service-3/',
  'commercial-vehicle-wraps/service-4/',
  // vehicle-lettering-graphics
  'vehicle-lettering-graphics/hero/',
  'vehicle-lettering-graphics/service-1/',
  'vehicle-lettering-graphics/service-2/',
  'vehicle-lettering-graphics/service-3/',
  'vehicle-lettering-graphics/service-4/',
  // fleet-wraps
  'fleet-wraps/hero/',
  'fleet-wraps/service-1/',
  'fleet-wraps/service-2/',
  'fleet-wraps/service-3/',
  'fleet-wraps/service-4/',
  // get-quote
  'get-quote/hero/',
  'get-quote/service-1/',
  'get-quote/service-2/',
  'get-quote/service-3/',
  // before-after
  'before-after/before-1/',
  'before-after/after-1/',
  'before-after/before-2/',
  'before-after/after-2/',
  'before-after/before-3/',
  'before-after/after-3/',
]

async function main() {
  console.log(`Creating ${folders.length} folders in ${BUCKET}...\n`)

  for (const folder of folders) {
    await S3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: folder,
      Body: '',
      ContentLength: 0,
    }))
    console.log(`  ✓ ${folder}`)
  }

  console.log(`\nDone! All ${folders.length} folders created.`)
  console.log('Now go to Cloudflare > R2 > fwg-landing and drop photos into each folder.')
}

main().catch(e => { console.error(e); process.exit(1) })
