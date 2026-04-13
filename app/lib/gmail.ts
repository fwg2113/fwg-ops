import { supabase } from './supabase'

// Get valid Gmail access token (with auto-refresh)
export async function getGmailAccessToken(): Promise<string | null> {
  const { data: settings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'google_gmail_tokens')
    .single()

  if (!settings?.value) return null

  const tokens = JSON.parse(settings.value)

  // Check if token is expired (with 5 min buffer)
  if (Date.now() > tokens.expiry_date - 300000) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const newTokens = await response.json()

    if (newTokens.access_token) {
      const updatedTokens = {
        access_token: newTokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (newTokens.expires_in * 1000),
      }

      await supabase.from('settings').upsert({
        key: 'google_gmail_tokens',
        value: JSON.stringify(updatedTokens),
      }, { onConflict: 'key' })

      return newTokens.access_token
    }
    return null
  }

  return tokens.access_token
}

// Gmail API base URL
const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me'

// Helper to make Gmail API calls
async function gmailFetch(path: string, accessToken: string, options?: RequestInit) {
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return response
}

// Get send-as aliases
export async function getAliases(accessToken: string) {
  const res = await gmailFetch('/settings/sendAs', accessToken)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to get aliases')
  return data.sendAs || []
}

// List threads (inbox)
export async function listThreads(
  accessToken: string,
  options: {
    maxResults?: number
    pageToken?: string
    q?: string
    labelIds?: string[]
  } = {}
) {
  const params = new URLSearchParams()
  params.set('maxResults', String(options.maxResults || 25))
  if (options.pageToken) params.set('pageToken', options.pageToken)
  if (options.q) params.set('q', options.q)
  if (options.labelIds?.length) {
    options.labelIds.forEach(id => params.append('labelIds', id))
  }

  const res = await gmailFetch(`/threads?${params.toString()}`, accessToken)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to list threads')
  return data
}

// Get a single thread with all messages
export async function getThread(accessToken: string, threadId: string) {
  const res = await gmailFetch(`/threads/${threadId}?format=full`, accessToken)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to get thread')
  return data
}

// Get a single message
export async function getMessage(accessToken: string, messageId: string) {
  const res = await gmailFetch(`/messages/${messageId}?format=full`, accessToken)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to get message')
  return data
}

// Modify message labels (mark read/unread, archive, etc.)
export async function modifyMessage(
  accessToken: string,
  messageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[]
) {
  const res = await gmailFetch(`/messages/${messageId}/modify`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to modify message')
  return data
}

// Attachment type for sending emails with files
export type EmailAttachment = {
  filename: string
  mimeType: string
  data: Buffer // raw file data
}

// Send an email (with optional attachments)
export async function sendEmail(
  accessToken: string,
  options: {
    to: string
    from: string
    subject: string
    body: string
    threadId?: string
    inReplyTo?: string
    references?: string
    cc?: string
    bcc?: string
    attachments?: EmailAttachment[]
  }
) {
  const hasAttachments = options.attachments && options.attachments.length > 0
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const headers = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `MIME-Version: 1.0`,
  ]

  if (options.cc) headers.splice(2, 0, `Cc: ${options.cc}`)
  if (options.bcc) headers.splice(2, 0, `Bcc: ${options.bcc}`)
  if (options.inReplyTo) {
    headers.push(`In-Reply-To: ${options.inReplyTo}`)
    headers.push(`References: ${options.references || options.inReplyTo}`)
  }

  let rawMessage: string

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    const parts: string[] = []

    // HTML body part
    parts.push(`--${boundary}`)
    parts.push(`Content-Type: text/html; charset=utf-8`)
    parts.push(`Content-Transfer-Encoding: 7bit`)
    parts.push('')
    parts.push(options.body)

    // Attachment parts
    for (const att of options.attachments!) {
      parts.push(`--${boundary}`)
      parts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`)
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      parts.push(`Content-Transfer-Encoding: base64`)
      parts.push('')
      parts.push(att.data.toString('base64'))
    }

    parts.push(`--${boundary}--`)

    rawMessage = headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n')
  } else {
    headers.push(`Content-Type: text/html; charset=utf-8`)
    rawMessage = headers.join('\r\n') + '\r\n\r\n' + options.body
  }

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const payload: any = { raw: encoded }
  if (options.threadId) payload.threadId = options.threadId

  const res = await gmailFetch('/messages/send', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to send email')
  return data
}

// List history changes since a given historyId (for incremental sync)
export async function listHistory(
  accessToken: string,
  startHistoryId: string,
  options: { labelId?: string; maxResults?: number } = {}
) {
  const params = new URLSearchParams()
  params.set('startHistoryId', startHistoryId)
  if (options.labelId) params.set('labelId', options.labelId)
  if (options.maxResults) params.set('maxResults', String(options.maxResults))
  params.set('historyTypes', 'messageAdded')
  params.append('historyTypes', 'messageDeleted')
  params.append('historyTypes', 'labelAdded')
  params.append('historyTypes', 'labelRemoved')

  const res = await gmailFetch(`/history?${params.toString()}`, accessToken)
  const data = await res.json()

  // 404 means historyId expired — caller should fall back to full sync
  if (res.status === 404) {
    return { expired: true, history: [], historyId: null }
  }

  if (!res.ok) throw new Error(data.error?.message || 'Failed to list history')

  return {
    expired: false,
    history: data.history || [],
    historyId: data.historyId || null,
    nextPageToken: data.nextPageToken,
  }
}

// Parse email headers from a Gmail message
export function parseHeaders(headers: Array<{ name: string; value: string }>) {
  const result: Record<string, string> = {}
  headers.forEach(h => {
    result[h.name.toLowerCase()] = h.value
  })
  return result
}

// Decode email body from Gmail message parts
export function decodeBody(message: any): string {
  // Simple message with body data directly
  if (message.body?.data) {
    return Buffer.from(message.body.data, 'base64url').toString('utf-8')
  }

  // Multipart message
  if (message.parts) {
    // Prefer HTML
    const htmlPart = findPart(message.parts, 'text/html')
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8')
    }

    // Fall back to plain text
    const textPart = findPart(message.parts, 'text/plain')
    if (textPart?.body?.data) {
      const text = Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
      return text.replace(/\n/g, '<br>')
    }
  }

  return '<em>Unable to display message content</em>'
}

function findPart(parts: any[], mimeType: string): any {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part
    if (part.parts) {
      const found = findPart(part.parts, mimeType)
      if (found) return found
    }
  }
  return null
}

// Get attachments info from a message
export function getAttachments(message: any): Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> {
  const attachments: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = []

  function walkParts(parts: any[]) {
    if (!parts) return
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId,
          size: part.body.size || 0,
        })
      }
      if (part.parts) walkParts(part.parts)
    }
  }

  walkParts(message.payload?.parts || [])
  return attachments
}
