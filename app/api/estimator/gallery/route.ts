// app/api/estimator/gallery/route.ts
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'fwg-uploads';
const R2_PUBLIC_URL = 'https://pub-2ae8eecf3c4d4b5f84b0dcf3aebb2ac9.r2.dev';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicle = searchParams.get('vehicle');

    if (!vehicle) {
      return corsResponse({ ok: false, error: 'vehicle parameter required' }, 400);
    }

    const prefix = `gallery/${vehicle}/`;

    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const result = await s3.send(command);
    const contents = result.Contents || [];

    const photosByType: Record<string, Array<{ url: string; filename: string }>> = {};

    for (const obj of contents) {
      if (!obj.Key) continue;

      const parts = obj.Key.replace(prefix, '').split('/');
      if (parts.length < 2) continue;

      const projectType = parts[0];
      const filename = parts.slice(1).join('/');

      if (!filename || filename.startsWith('.')) continue;

      const ext = filename.toLowerCase().split('.').pop();
      if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) continue;

      if (!photosByType[projectType]) {
        photosByType[projectType] = [];
      }

      photosByType[projectType].push({
        url: `${R2_PUBLIC_URL}/${obj.Key}`,
        filename: filename,
      });
    }

    for (const type of Object.keys(photosByType)) {
      photosByType[type].sort((a, b) => a.filename.localeCompare(b.filename));
    }

    return corsResponse({ ok: true, vehicle, photos: photosByType });

  } catch (err: any) {
    console.error('Gallery API error:', err);
    return corsResponse({ ok: false, error: 'Internal server error' }, 500);
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

function corsResponse(body: any, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET');
  return response;
}
