import { NextResponse } from 'next/server'
import { getGmailAccessToken } from '../../../../lib/gmail'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  const { messageId } = await params
  const { searchParams } = new URL(request.url)
  const attachmentId = searchParams.get('attachmentId')
  const filename = searchParams.get('filename') || 'attachment'
  const mimeType = searchParams.get('mimeType') || 'application/octet-stream'

  if (!attachmentId) {
    return NextResponse.json({ error: 'Missing attachmentId' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Failed to get attachment')

    // Decode base64url data
    const buffer = Buffer.from(data.data, 'base64url')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error: any) {
    console.error('Gmail attachment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
