import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

const DRIVE_FOLDER_ID = '0AMNphJD70GPrUk9PVA'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await params
    const { printFileUrl, orderNumber } = await request.json()

    if (!printFileUrl || !orderNumber) {
      return NextResponse.json(
        { error: 'printFileUrl and orderNumber are required' },
        { status: 400 }
      )
    }

    // Download the file from R2
    const fileRes = await fetch(printFileUrl)
    if (!fileRes.ok) {
      return NextResponse.json(
        { error: 'Failed to download print file' },
        { status: 502 }
      )
    }

    const fileBuffer = Buffer.from(await fileRes.arrayBuffer())
    const contentType = fileRes.headers.get('content-type') || 'application/pdf'

    // Determine file extension from URL or content type
    const urlPath = new URL(printFileUrl).pathname
    const urlExt = urlPath.split('.').pop()
    const ext = urlExt && urlExt.length <= 5 ? `.${urlExt}` : '.pdf'
    const fileName = `${orderNumber}_print${ext}`

    // Upload to Google Drive
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    const { Readable } = await import('stream')
    const stream = new Readable()
    stream.push(fileBuffer)
    stream.push(null)

    const driveRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: contentType,
        body: stream,
      },
      fields: 'id,name',
      supportsAllDrives: true,
    })

    return NextResponse.json({
      success: true,
      fileId: driveRes.data.id,
      fileName: driveRes.data.name,
    })
  } catch (error) {
    console.error('Send to Drive error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload to Drive'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
