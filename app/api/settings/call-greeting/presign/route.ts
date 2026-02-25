import { NextResponse } from 'next/server'
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

// POST - generate a presigned URL for direct R2 upload
// This bypasses the Vercel 4.5MB serverless function body limit
export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json()

    if (!filename) {
      return NextResponse.json({ error: 'filename required' }, { status: 400 })
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/webm']
    if (contentType && !allowedTypes.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 })
    }

    const timestamp = Date.now()
    const ext = filename.split('.').pop() || 'wav'
    const key = `call-greetings/${timestamp}-greeting.${ext}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'audio/mpeg',
    })

    const presignedUrl = await getSignedUrl(S3, command, { expiresIn: 300 })
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ presignedUrl, publicUrl, r2Key: key })
  } catch (err: any) {
    console.error('Presign error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
