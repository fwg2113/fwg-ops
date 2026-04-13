// Email Smart Buckets — bucket computation logic
// Determines which bucket a thread belongs to based on message history

export type Bucket = 'need_to_respond' | 'responded' | 'waiting_on_task' | 'follow_up' | 'archived'
export type FollowUpTier = '2_3_days' | '6_8_days' | '10_14_days' | '1_3_months' | '3_plus_months'

export type BucketResult = {
  bucket: Bucket
  followUpTier: FollowUpTier | null
  lastMessageIsOurs: boolean
  firstUnansweredReplyDate: Date | null
}

type MessageInfo = {
  from: string
  internalDate: string // milliseconds timestamp as string (Gmail format)
  labelIds?: string[]
}

type ExistingFlags = {
  waiting_on_task_flag: boolean
  archived_flag: boolean
}

const OUR_DOMAIN = '@frederickwraps.com'

// Extract email address from "Name <email>" format
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).toLowerCase().trim()
}

function isOurEmail(from: string): boolean {
  return extractEmail(from).endsWith(OUR_DOMAIN)
}

// Compute follow-up tier based on days since first unanswered reply
export function computeFollowUpTier(firstUnansweredReplyDate: Date): FollowUpTier {
  const days = (Date.now() - firstUnansweredReplyDate.getTime()) / (1000 * 60 * 60 * 24)

  if (days < 4) return '2_3_days'
  if (days < 9) return '6_8_days'
  if (days < 15) return '10_14_days'
  if (days < 91) return '1_3_months'
  return '3_plus_months'
}

// Display labels for follow-up tiers
export const FOLLOW_UP_TIER_LABELS: Record<FollowUpTier, string> = {
  '2_3_days': '2-3 days',
  '6_8_days': '6-8 days',
  '10_14_days': '10-14 days',
  '1_3_months': '1-3 months',
  '3_plus_months': '3+ months',
}

// Display labels for buckets
export const BUCKET_LABELS: Record<Bucket, string> = {
  need_to_respond: 'Need to Respond',
  responded: 'Responded / Waiting',
  waiting_on_task: 'Waiting on Task',
  follow_up: 'Follow-Up',
  archived: 'Archived',
}

// Main bucket computation
// Messages must be sorted by internalDate ascending (oldest first)
export function computeBucket(
  messages: MessageInfo[],
  flags: ExistingFlags
): BucketResult {
  // Manual overrides take priority
  if (flags.archived_flag) {
    return {
      bucket: 'archived',
      followUpTier: null,
      lastMessageIsOurs: false,
      firstUnansweredReplyDate: null,
    }
  }

  // Filter out draft-only messages (no SENT label, has DRAFT label)
  const sentMessages = messages.filter(m => {
    const labels = m.labelIds || []
    const isDraftOnly = labels.includes('DRAFT') && !labels.includes('SENT')
    return !isDraftOnly
  })

  // If no sent messages (all drafts), treat as need to respond
  if (sentMessages.length === 0) {
    return {
      bucket: 'need_to_respond',
      followUpTier: null,
      lastMessageIsOurs: false,
      firstUnansweredReplyDate: null,
    }
  }

  // Determine who sent the last message
  const lastMessage = sentMessages[sentMessages.length - 1]
  const lastMessageIsOurs = isOurEmail(lastMessage.from)

  // If waiting_on_task is flagged, it takes priority (but only if we've responded)
  if (flags.waiting_on_task_flag) {
    return {
      bucket: 'waiting_on_task',
      followUpTier: null,
      lastMessageIsOurs,
      firstUnansweredReplyDate: null,
    }
  }

  // Customer sent the last message — we need to respond
  if (!lastMessageIsOurs) {
    return {
      bucket: 'need_to_respond',
      followUpTier: null,
      lastMessageIsOurs: false,
      firstUnansweredReplyDate: null, // reset: customer broke the chain
    }
  }

  // We sent the last message — calculate first unanswered reply date
  // Walk backward from end to find the first consecutive "our" message
  let firstOurIdx = sentMessages.length - 1
  for (let i = sentMessages.length - 2; i >= 0; i--) {
    if (isOurEmail(sentMessages[i].from)) {
      firstOurIdx = i
    } else {
      break // hit a customer message
    }
  }

  const firstUnansweredReplyDate = new Date(parseInt(sentMessages[firstOurIdx].internalDate))
  const daysSinceReply = (Date.now() - firstUnansweredReplyDate.getTime()) / (1000 * 60 * 60 * 24)

  // Less than 2 days — still fresh, in "Responded" bucket
  if (daysSinceReply < 2) {
    return {
      bucket: 'responded',
      followUpTier: null,
      lastMessageIsOurs: true,
      firstUnansweredReplyDate,
    }
  }

  // 2+ days — moves to Follow-Up with time tier
  return {
    bucket: 'follow_up',
    followUpTier: computeFollowUpTier(firstUnansweredReplyDate),
    lastMessageIsOurs: true,
    firstUnansweredReplyDate,
  }
}

// Extract thread metadata from a Gmail thread object for upserting into email_threads
export function extractThreadData(thread: any) {
  const messages = thread.messages || []
  if (messages.length === 0) return null

  const parsedMessages: MessageInfo[] = messages.map((msg: any) => {
    const headers = msg.payload?.headers || []
    const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')
    return {
      from: fromHeader?.value || '',
      internalDate: msg.internalDate,
      labelIds: msg.labelIds || [],
    }
  })

  // Sort by internalDate ascending
  parsedMessages.sort((a, b) => parseInt(a.internalDate) - parseInt(b.internalDate))

  // Check if ALL messages are draft-only (skip thread entirely)
  const allDrafts = parsedMessages.every(m => {
    const labels = m.labelIds || []
    return labels.includes('DRAFT') && !labels.includes('SENT')
  })
  if (allDrafts) return null

  // Get subject from first message
  const firstMsg = messages[0]
  const subjectHeader = (firstMsg.payload?.headers || []).find(
    (h: any) => h.name.toLowerCase() === 'subject'
  )
  const subject = subjectHeader?.value || '(no subject)'

  // Check unread and attachments across all messages
  const isUnread = messages.some((m: any) => (m.labelIds || []).includes('UNREAD'))
  const hasAttachments = messages.some((m: any) => {
    const parts = m.payload?.parts || []
    return parts.some((p: any) => p.filename && p.body?.attachmentId)
  })

  // Collect all label IDs
  const allLabelIds = new Set<string>()
  messages.forEach((m: any) => (m.labelIds || []).forEach((l: string) => allLabelIds.add(l)))

  // Collect unique participants
  const participants = new Set<string>()
  parsedMessages.forEach(m => {
    if (m.from) participants.add(m.from)
  })

  // Last message info
  const sentMessages = parsedMessages.filter(m => {
    const labels = m.labelIds || []
    return !(labels.includes('DRAFT') && !labels.includes('SENT'))
  })
  const lastMsg = sentMessages.length > 0 ? sentMessages[sentMessages.length - 1] : parsedMessages[parsedMessages.length - 1]

  return {
    gmail_thread_id: thread.id,
    subject,
    snippet: thread.snippet || '',
    message_count: messages.length,
    is_unread: isUnread,
    has_attachments: hasAttachments,
    last_message_from: lastMsg.from,
    last_message_date: new Date(parseInt(lastMsg.internalDate)).toISOString(),
    participants: Array.from(participants),
    gmail_label_ids: Array.from(allLabelIds),
    parsedMessages, // used for bucket computation, not stored
  }
}
