import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'fwg-uploads'

/**
 * GET /api/fa-orders/print-file?session_token=xxx
 *
 * Lists objects in fa/artwork/{session_token}/print-ready/ and returns
 * the first file found as { key, url }.
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.nextUrl.searchParams.get('session_token')

  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token is required' }, { status: 400 })
  }

  try {
    const prefix = `fa/artwork/${sessionToken}/print-ready/`

    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: 10,
    }))

    const files = (result.Contents || []).filter(obj => obj.Key && obj.Key !== prefix)

    if (files.length === 0) {
      return NextResponse.json({ error: 'No print file found' }, { status: 404 })
    }

    const key = files[0].Key!
    const url = `https://assets.frederickapparel.com/${key}`

    return NextResponse.json({ key, url })
  } catch (error) {
    console.error('Print file lookup error:', error)
    return NextResponse.json({ error: 'Failed to look up print file' }, { status: 500 })
  }
}
