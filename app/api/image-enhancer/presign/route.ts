import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

/**
 * POST /api/image-enhancer/presign
 *
 * Proxied upload: receives the file directly and uploads to R2 server-side.
 * This avoids CORS issues with direct browser-to-R2 uploads.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `fwg-ops/image-enhancer-temp/${timestamp}-${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: file.type || 'application/octet-stream',
      Body: buffer,
    })

    await S3.send(command)

    const fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`
    return NextResponse.json({ fileUrl })
  } catch (err: any) {
    console.error('[image-enhancer/presign] upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
