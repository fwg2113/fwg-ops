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
    const { documentId, files } = await req.json() as {
      documentId: string
      files: Array<{ filename: string; pdfBase64: string }>
    }

    if (!documentId || !files?.length) {
      return NextResponse.json({ error: 'Missing documentId or files' }, { status: 400 })
    }

    // Fetch document to get customer_id
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('attachments, customer_id')
      .eq('id', documentId)
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const timestamp = Date.now()
    const newAttachments: any[] = []

    // Upload each PDF to R2
    for (const file of files) {
      const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = `fwg-ops/team-prints/${documentId}/${timestamp}-${safeName}`
      const fileBuffer = Buffer.from(file.pdfBase64, 'base64')
      const isSvg = file.filename.endsWith('.svg')
      const contentType = isSvg ? 'image/svg+xml' : 'application/pdf'

      await S3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      }))

      const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`
      newAttachments.push({
        url: publicUrl,
        key,
        filename: file.filename,
        contentType,
        size: fileBuffer.length,
        uploadedAt: new Date().toISOString(),
      })
    }

    // Append to document attachments
    const updatedAttachments = [...(doc.attachments || []), ...newAttachments]
    await supabase
      .from('documents')
      .update({ attachments: updatedAttachments })
      .eq('id', documentId)

    // Sync to customer's Files & Assets
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
          const toAdd = newAttachments.filter(f => !existingUrls.has(f.url))
          if (toAdd.length > 0) {
            await supabase
              .from('customers')
              .update({ project_files_json: JSON.stringify([...existing, ...toAdd]) })
              .eq('id', doc.customer_id)
          }
        }
      } catch (syncErr) {
        console.error('[save-prints] customer sync error:', syncErr)
      }
    }

    return NextResponse.json({
      success: true,
      filesUploaded: newAttachments.length,
      urls: newAttachments.map(a => a.url),
    })
  } catch (err: any) {
    console.error('[save-prints] error:', err)
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 })
  }
}
