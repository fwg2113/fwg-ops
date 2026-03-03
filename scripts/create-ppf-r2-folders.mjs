// Creates all missing PPF landing page folders in the fwg-landing R2 bucket.
// Reads R2 credentials from .env.local
//
// Usage: node scripts/create-ppf-r2-folders.mjs

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'

// Read .env.local
const env = {}
try {
  const lines = readFileSync('.env.local', 'utf8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) env[match[1].trim()] = match[2].trim()
  }
} catch {
  console.error('Could not read .env.local — make sure it exists with R2 credentials.')
  process.exit(1)
}

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

const BUCKET = 'fwg-landing'

const PAGE_SLUGS = ['ppf', 'ppf-pricing', 'ppf-tesla', 'ppf-luxury']
const PAGE_FOLDERS = ['hero', 'service-1', 'service-2', 'service-3', 'service-4']

const PPF_BA_FOLDERS = [
  'ppf-before-after/before-1',
  'ppf-before-after/after-1',
  'ppf-before-after/before-2',
  'ppf-before-after/after-2',
  'ppf-before-after/before-3',
  'ppf-before-after/after-3',
]

async function main() {
  const existing = await S3.send(new ListObjectsV2Command({ Bucket: BUCKET }))
  const existingKeys = new Set((existing.Contents ?? []).map(o => o.Key))
  console.log(`Found ${existingKeys.size} existing objects in ${BUCKET}\n`)

  const folders = []
  for (const slug of PAGE_SLUGS) {
    for (const folder of PAGE_FOLDERS) {
      folders.push(`${slug}/${folder}`)
    }
  }
  for (const folder of PPF_BA_FOLDERS) {
    folders.push(folder)
  }

  let created = 0
  for (const folder of folders) {
    const key = `${folder}/.gitkeep`
    const hasContent = [...existingKeys].some(k => k.startsWith(folder + '/'))
    if (hasContent) {
      console.log(`  ✓ ${folder}/ (already exists)`)
      continue
    }

    await S3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: 'placeholder',
      ContentType: 'text/plain',
    }))
    console.log(`  → ${folder}/ (created)`)
    created++
  }

  console.log(`\nDone! Created ${created} new folders.`)
  console.log('Go to: https://dash.cloudflare.com → R2 → fwg-landing')
  console.log('Drop your images into each folder.')
}

main().catch(console.error)
