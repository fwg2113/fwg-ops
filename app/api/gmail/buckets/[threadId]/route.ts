import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeBucket, extractThreadData } from '../../../../lib/email-buckets'
import { getGmailAccessToken, getThread } from '../../../../lib/gmail'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    const body = await request.json()
    const supabase = getSupabase()

    // Get current thread state
    const { data: existing, error: fetchError } = await supabase
      .from('email_threads')
      .select('*')
      .eq('gmail_thread_id', threadId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Update manual flags
    const updates: any = {}

    if ('waiting_on_task_flag' in body) {
      updates.waiting_on_task_flag = body.waiting_on_task_flag
    }
    if ('archived_flag' in body) {
      updates.archived_flag = body.archived_flag
    }

    // Recompute bucket with updated flags
    const accessToken = await getGmailAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
    }

    const thread = await getThread(accessToken, threadId)
    const threadData = extractThreadData(thread)

    if (threadData) {
      const { parsedMessages } = threadData
      const flags = {
        waiting_on_task_flag: updates.waiting_on_task_flag ?? existing.waiting_on_task_flag,
        archived_flag: updates.archived_flag ?? existing.archived_flag,
      }

      const bucketResult = computeBucket(parsedMessages, flags)
      updates.bucket = bucketResult.bucket
      updates.follow_up_tier = bucketResult.followUpTier
      updates.first_unanswered_reply_date = bucketResult.firstUnansweredReplyDate?.toISOString() || null
      updates.last_message_is_ours = bucketResult.lastMessageIsOurs
    }

    const { data, error } = await supabase
      .from('email_threads')
      .update(updates)
      .eq('gmail_thread_id', threadId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
