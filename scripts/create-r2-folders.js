#!/usr/bin/env node

/**
 * Creates the complete R2 folder structure for the FWG gallery
 * Run with: node scripts/create-r2-folders.js
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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

// Vehicle categories (simplified for gallery)
const VEHICLE_CATEGORIES = [
  'SEDAN_COUPE',
  'SMALL_SUV',
  'LARGE_SUV',
  'PICKUP',        // Covers both PICKUP_STD and PICKUP_HD
  'CARGO_VAN',     // Covers both CARGO_VAN_SM and CARGO_VAN_LG
  'BOX_TRUCK',     // Covers both BOX_TRUCK_SM and BOX_TRUCK_LG
  'TRAILER',
  'WATERCRAFT',
  'GOLF_CART',
  'BUS',
  'FOOD_TRUCK',
  'ATV_UTV'
];

// Project types
const PROJECT_TYPES = [
  'FULL_WRAP',
  'PARTIAL_WRAP',
  'LETTERING'
];

async function createFolder(key) {
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(''),
      ContentType: 'application/x-directory'
    });

    await s3.send(command);
    console.log(`✓ Created: ${key}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed: ${key}`, error.message);
    return false;
  }
}

async function createAllFolders() {
  console.log('🚀 Creating R2 folder structure for FWG gallery...\n');
  console.log(`📦 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`📁 Base path: gallery/\n`);

  let created = 0;
  let failed = 0;

  // Create base gallery folder
  await createFolder('gallery/');
  created++;

  // Create all vehicle category folders
  for (const vehicle of VEHICLE_CATEGORIES) {
    // Create vehicle folder
    await createFolder(`gallery/${vehicle}/`);
    created++;

    // Create project type subfolders
    for (const project of PROJECT_TYPES) {
      const success = await createFolder(`gallery/${vehicle}/${project}/`);
      if (success) {
        created++;
      } else {
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Complete! Created ${created} folders`);
  if (failed > 0) {
    console.log(`⚠️  Failed: ${failed} folders`);
  }
  console.log('='.repeat(60));
  console.log('\n📸 You can now upload images to these folders:');
  console.log('   Example: gallery/CARGO_VAN_LG/FULL_WRAP/your-photo.jpg');
}

// Run the script
createAllFolders().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
