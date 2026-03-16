import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function getAuth() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set')
  }
  const credentials = JSON.parse(serviceAccountJson)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

// Extract Google Drive folder ID from a share URL
function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

// Uploads a single file to Drive. If folderId is provided, uploads there directly.
// If not, looks up the customer's Drive folder and creates a subfolder.
// Returns the folderId so subsequent calls can reuse it.
export async function POST(req: NextRequest) {
  try {
    const { customerId, orderNumber, filename, pdfBase64, folderId } = await req.json() as {
      customerId: string
      orderNumber: string
      filename: string
      pdfBase64: string
      folderId?: string // reuse subfolder from a previous call
    }

    if (!filename || !pdfBase64) {
      return NextResponse.json({ error: 'Missing filename or pdfBase64' }, { status: 400 })
    }

    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    let targetFolderId = folderId

    // If no folderId provided, create the subfolder
    if (!targetFolderId) {
      if (!customerId) {
        return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
      }

      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('drive_folder_url')
        .eq('id', customerId)
        .single()

      if (custErr || !customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }

      if (!customer.drive_folder_url) {
        return NextResponse.json({ error: 'Customer has no Google Drive folder configured' }, { status: 400 })
      }

      const parentFolderId = extractFolderId(customer.drive_folder_url)
      if (!parentFolderId) {
        return NextResponse.json({ error: 'Could not parse Drive folder URL' }, { status: 400 })
      }

      const subfolderName = `${orderNumber || 'prints'} - Team Prints`
      const folderRes = await drive.files.create({
        requestBody: {
          name: subfolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id',
        supportsAllDrives: true,
      })
      targetFolderId = folderRes.data.id!
    }

    // Upload the PDF
    const { Readable } = await import('stream')
    const buffer = Buffer.from(pdfBase64, 'base64')
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)

    const driveFile = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [targetFolderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      fields: 'id,name',
      supportsAllDrives: true,
    })

    return NextResponse.json({
      success: true,
      folderId: targetFolderId,
      fileId: driveFile.data.id,
      filename: driveFile.data.name,
    })
  } catch (err: any) {
    console.error('[upload-to-drive] error:', err)
    return NextResponse.json({ error: err.message || 'Drive upload failed' }, { status: 500 })
  }
}
