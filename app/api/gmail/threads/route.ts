import { NextResponse } from 'next/server'
import { getGmailAccessToken, listThreads, getThread, parseHeaders, decodeBody, getAttachments } from '../../../lib/gmail'

export async function GET(request: Request) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageToken = searchParams.get('pageToken') || undefined
  const q = searchParams.get('q') || undefined
  const label = searchParams.get('label') || ''
  const maxResults = parseInt(searchParams.get('maxResults') || '25')

  try {
    // Get thread list
    const threadList = await listThreads(accessToken, {
      maxResults,
      pageToken,
      q,
      ...(label ? { labelIds: [label] } : {}),
    })

    if (!threadList.threads?.length) {
      return NextResponse.json({
        threads: [],
        nextPageToken: null,
        resultSizeEstimate: 0,
      })
    }

    // Fetch each thread's details (first message only for list view)
    const threadDetails = await Promise.all(
      threadList.threads.map(async (t: any) => {
        try {
          const thread = await getThread(accessToken, t.id)
          const firstMsg = thread.messages[0]
          const lastMsg = thread.messages[thread.messages.length - 1]
          const headers = parseHeaders(lastMsg.payload.headers)
          const firstHeaders = parseHeaders(firstMsg.payload.headers)

          // Check if any message is unread
          const isUnread = thread.messages.some((m: any) =>
            m.labelIds?.includes('UNREAD')
          )

          // Get snippet from the last message
          const snippet = lastMsg.snippet || ''

          return {
            id: thread.id,
            messageCount: thread.messages.length,
            snippet,
            isUnread,
            subject: firstHeaders.subject || '(no subject)',
            from: headers.from || '',
            to: headers.to || '',
            date: headers.date || '',
            internalDate: lastMsg.internalDate,
            labelIds: lastMsg.labelIds || [],
            hasAttachments: thread.messages.some((m: any) =>
              getAttachments(m).length > 0
            ),
          }
        } catch (err) {
          console.error(`Error fetching thread ${t.id}:`, err)
          return null
        }
      })
    )

    return NextResponse.json({
      threads: threadDetails.filter(Boolean),
      nextPageToken: threadList.nextPageToken || null,
      resultSizeEstimate: threadList.resultSizeEstimate || 0,
    })
  } catch (error: any) {
    console.error('Gmail threads error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
