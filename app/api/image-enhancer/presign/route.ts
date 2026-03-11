import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json()

    if (!filename) {
      return NextResponse.json({ error: 'filename required' }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `fwg-ops/image-enhancer-temp/${timestamp}-${safeName}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    })

    const uploadUrl = await getSignedUrl(S3, command, { expiresIn: 300 })
    const fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ uploadUrl, fileUrl })
  } catch (err: any) {
    console.error('[image-enhancer/presign] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
