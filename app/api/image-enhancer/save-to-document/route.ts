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
    let documentId: string, filename: string, contentType: string, buffer: Buffer

    const ct = req.headers.get('content-type') || ''

    if (ct.includes('multipart/form-data')) {
      // FormData upload (handles large files without JSON size limits)
      const formData = await req.formData()
      documentId = formData.get('documentId') as string
      filename = formData.get('filename') as string
      contentType = formData.get('contentType') as string || 'application/octet-stream'
      const file = formData.get('file') as File | null
      const imageData = formData.get('imageData') as string | null

      if (file) {
        buffer = Buffer.from(await file.arrayBuffer())
      } else if (imageData) {
        // SVG or base64 string sent as text field
        if (imageData.startsWith('data:')) {
          buffer = Buffer.from(imageData.split(',')[1], 'base64')
        } else if (imageData.startsWith('<svg') || imageData.startsWith('<?xml')) {
          buffer = Buffer.from(imageData, 'utf-8')
        } else {
          buffer = Buffer.from(imageData, 'base64')
        }
      } else {
        return NextResponse.json({ error: 'No file or image data provided' }, { status: 400 })
      }
    } else {
      // Legacy JSON body (for smaller payloads)
      const body = await req.json()
      documentId = body.documentId
      filename = body.filename
      contentType = body.contentType || 'application/octet-stream'
      const imageBase64 = body.imageBase64

      if (imageBase64.startsWith('data:')) {
        buffer = Buffer.from(imageBase64.split(',')[1], 'base64')
      } else if (imageBase64.startsWith('<svg') || imageBase64.startsWith('<?xml')) {
        buffer = Buffer.from(imageBase64, 'utf-8')
      } else {
        buffer = Buffer.from(imageBase64, 'base64')
      }
    }

    if (!documentId || !filename) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
      .select('attachments, doc_number, doc_type, customer_id')
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

    // Sync file to customer's Files & Assets
    if (doc.customer_id) {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('project_files_json')
          .eq('id', doc.customer_id)
          .single()
        if (customer) {
          const existing = customer.project_files_json ? JSON.parse(customer.project_files_json) : []
          const existingUrls = new Set(existing.map((f: any) => f.url))
          if (!existingUrls.has(publicUrl)) {
            existing.push(newAttachment)
            await supabase
              .from('customers')
              .update({ project_files_json: JSON.stringify(existing) })
              .eq('id', doc.customer_id)
          }
        }
      } catch (syncErr) {
        console.error('[save-to-document] customer sync error:', syncErr)
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key,
      docNumber: doc.doc_number,
      docType: doc.doc_type,
    })
  } catch (err: any) {
    console.error('[save-to-document] error:', err)
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 })
  }
}
