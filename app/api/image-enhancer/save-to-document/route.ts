import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { documentId, filename, contentType, imageBase64 } = await req.json()

    if (!documentId || !filename || !imageBase64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Decode base64 data URL to buffer
    let buffer: Buffer
    if (imageBase64.startsWith('data:')) {
      const base64Data = imageBase64.split(',')[1]
      buffer = Buffer.from(base64Data, 'base64')
    } else if (imageBase64.startsWith('<svg') || imageBase64.startsWith('<?xml')) {
      buffer = Buffer.from(imageBase64, 'utf-8')
    } else {
      buffer = Buffer.from(imageBase64, 'base64')
    }

    const timestamp = Date.now()
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `fwg-ops/enhanced-artwork/${documentId}/${timestamp}-${safeName}`

    await S3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    }))

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

    // Fetch current attachments
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('attachments, doc_number, doc_type')
      .eq('id', documentId)
      .single()

    if (fetchErr || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const newAttachment = {
      url: publicUrl,
      key,
      filename,
      contentType: contentType || 'application/octet-stream',
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    }

    const updatedAttachments = [...(doc.attachments || []), newAttachment]

    const { error: updateErr } = await supabase
      .from('documents')
      .update({ attachments: updatedAttachments })
      .eq('id', documentId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      docNumber: doc.doc_number,
      docType: doc.doc_type,
    })
  } catch (err: any) {
    console.error('[save-to-document] error:', err)
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 })
  }
}
