import { NextResponse } from 'next/server'
import { getGmailAccessToken, getThread, parseHeaders, decodeBody, getAttachments, modifyMessage } from '../../../../lib/gmail'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  const { id: threadId } = await params

  try {
    const thread = await getThread(accessToken, threadId)

    // Mark all unread messages as read
    const unreadMessages = thread.messages.filter((m: any) =>
      m.labelIds?.includes('UNREAD')
    )
    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map((m: any) =>
          modifyMessage(accessToken, m.id, undefined, ['UNREAD'])
        )
      )
    }

    // Parse each message
    const messages = thread.messages.map((msg: any) => {
      const headers = parseHeaders(msg.payload.headers)
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: headers.from || '',
        to: headers.to || '',
        cc: headers.cc || '',
        bcc: headers.bcc || '',
        subject: headers.subject || '(no subject)',
        date: headers.date || '',
        internalDate: msg.internalDate,
        messageId: headers['message-id'] || '',
        references: headers.references || '',
        body: decodeBody(msg.payload),
        labelIds: msg.labelIds || [],
        attachments: getAttachments(msg),
      }
    })

    return NextResponse.json({
      id: thread.id,
      messages,
      subject: messages[0]?.subject || '(no subject)',
    })
  } catch (error: any) {
    console.error('Gmail thread detail error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  const { id: threadId } = await params

  try {
    const body = await request.json()
    const { messageId, addLabelIds, removeLabelIds } = body

    // If messageId provided, modify that specific message
    // Otherwise, modify all messages in the thread
    if (messageId) {
      await modifyMessage(
        accessToken,
        messageId,
        addLabelIds || undefined,
        removeLabelIds || undefined
      )
    } else {
      // Get all messages in thread and modify each
      const thread = await getThread(accessToken, threadId)
      await Promise.all(
        thread.messages.map((m: any) =>
          modifyMessage(
            accessToken,
            m.id,
            addLabelIds || undefined,
            removeLabelIds || undefined
          )
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Gmail modify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
