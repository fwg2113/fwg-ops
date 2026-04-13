import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getGmailAccessToken, sendEmail, getThread } from '../../../lib/gmail'
import { computeBucket, extractThreadData } from '../../../lib/email-buckets'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  try {
    const { to, from, subject, body, threadId, inReplyTo, references, cc, bcc } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
    }

    const result = await sendEmail(accessToken, {
      to,
      from: from || 'info@frederickwraps.com',
      subject,
      body,
      threadId,
      inReplyTo,
      references,
      cc,
      bcc,
    })

    // Recompute bucket for this thread after sending
    const sentThreadId = result.threadId
    if (sentThreadId) {
      try {
        const supabase = getSupabase()
        const thread = await getThread(accessToken, sentThreadId)
        const threadData = extractThreadData(thread)

        if (threadData) {
          const { parsedMessages, ...dbFields } = threadData

          // Get existing flags
          const { data: existing } = await supabase
            .from('email_threads')
            .select('waiting_on_task_flag, archived_flag')
            .eq('gmail_thread_id', sentThreadId)
            .single()

          const flags = {
            waiting_on_task_flag: existing?.waiting_on_task_flag || false,
            archived_flag: false, // un-archive if we're sending in the thread
          }

          const bucketResult = computeBucket(parsedMessages, flags)

          await supabase.from('email_threads').upsert({
            ...dbFields,
            last_message_is_ours: bucketResult.lastMessageIsOurs,
            first_unanswered_reply_date: bucketResult.firstUnansweredReplyDate?.toISOString() || null,
            bucket: bucketResult.bucket,
            follow_up_tier: bucketResult.followUpTier,
            waiting_on_task_flag: flags.waiting_on_task_flag,
            archived_flag: flags.archived_flag,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'gmail_thread_id' })
        }
      } catch (syncError) {
        // Don't fail the send if bucket sync fails
        console.error('Post-send bucket sync error:', syncError)
      }
    }

    return NextResponse.json({ success: true, messageId: result.id, threadId: result.threadId })
  } catch (error: any) {
    console.error('Gmail send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
