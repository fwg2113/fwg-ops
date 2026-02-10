#!/usr/bin/env node

/**
 * Deletes old R2 gallery folders that have been replaced with simplified structure
 * Run with: node scripts/cleanup-old-r2-folders.js
 */

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'fwg-uploads';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing R2 credentials in .env file');
  console.error('Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Old folders to delete (replaced by simplified structure)
const OLD_FOLDERS = [
  'gallery/SMALL_SUV/',
  'gallery/LARGE_SUV/',
  'gallery/CARGO_VAN_SM/',
  'gallery/CARGO_VAN_LG/',
  'gallery/PICKUP_STD/',
  'gallery/PICKUP_HD/',
  'gallery/BOX_TRUCK_SM/',
  'gallery/BOX_TRUCK_LG/'
];

async function listObjects(prefix) {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
  });

  const result = await s3.send(command);
  return result.Contents || [];
}

async function deleteObjects(keys) {
  if (keys.length === 0) return 0;

  const command = new DeleteObjectsCommand({
    Bucket: R2_BUCKET_NAME,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
      Quiet: false,
    },
  });

  const result = await s3.send(command);
  return result.Deleted?.length || 0;
}

async function cleanupFolder(prefix) {
  console.log(`\n🔍 Checking: ${prefix}`);

  try {
    const objects = await listObjects(prefix);

    if (objects.length === 0) {
      console.log(`   ℹ️  No objects found (already clean)`);
      return 0;
    }

    console.log(`   Found ${objects.length} objects to delete`);

    // Get all keys
    const keys = objects.map(obj => obj.Key).filter(Boolean);

    // Delete in batches of 1000 (S3 limit)
    let totalDeleted = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const deleted = await deleteObjects(batch);
      totalDeleted += deleted;
      console.log(`   ✓ Deleted ${deleted} objects`);
    }

    return totalDeleted;

  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
    return 0;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up old R2 gallery folders...\n');
  console.log(`📦 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`🗑️  Folders to remove: ${OLD_FOLDERS.length}\n`);

  let totalDeleted = 0;

  for (const folder of OLD_FOLDERS) {
    const deleted = await cleanupFolder(folder);
    totalDeleted += deleted;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Cleanup complete! Deleted ${totalDeleted} objects total`);
  console.log('='.repeat(60));
  console.log('\n✨ Your gallery now has the simplified structure:');
  console.log('   - CARGO_VAN (replaces SM + LG)');
  console.log('   - PICKUP (replaces STD + HD)');
  console.log('   - BOX_TRUCK (replaces SM + LG)');
}

// Run the script
cleanup().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
