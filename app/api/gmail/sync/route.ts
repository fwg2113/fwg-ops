import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getGmailAccessToken, listThreads, getThread, listHistory } from '../../../lib/gmail'
import { computeBucket, extractThreadData } from '../../../lib/email-buckets'

// Create Supabase client per-request (safe for Vercel serverless)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Process a single Gmail thread and upsert into email_threads
async function processThread(
  supabase: ReturnType<typeof getSupabase>,
  accessToken: string,
  threadId: string
) {
  const thread = await getThread(accessToken, threadId)
  const threadData = extractThreadData(thread)

  // Skip draft-only threads
  if (!threadData) return null

  const { parsedMessages, ...dbFields } = threadData

  // Get existing flags (preserve manual overrides)
  const { data: existing } = await supabase
    .from('email_threads')
    .select('waiting_on_task_flag, archived_flag')
    .eq('gmail_thread_id', threadId)
    .single()

  const flags = {
    waiting_on_task_flag: existing?.waiting_on_task_flag || false,
    archived_flag: existing?.archived_flag || false,
  }

  // If thread was archived but a new message came in from customer, un-archive
  const lastMsgFrom = dbFields.last_message_from.toLowerCase()
  const customerReplied = !lastMsgFrom.includes('@frederickwraps.com')
  if (flags.archived_flag && customerReplied && existing) {
    flags.archived_flag = false
  }

  const bucketResult = computeBucket(parsedMessages, flags)

  const upsertData = {
    ...dbFields,
    last_message_is_ours: bucketResult.lastMessageIsOurs,
    first_unanswered_reply_date: bucketResult.firstUnansweredReplyDate?.toISOString() || null,
    bucket: bucketResult.bucket,
    follow_up_tier: bucketResult.followUpTier,
    waiting_on_task_flag: flags.waiting_on_task_flag,
    archived_flag: flags.archived_flag,
    last_synced_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('email_threads')
    .upsert(upsertData, { onConflict: 'gmail_thread_id' })

  if (error) {
    console.error(`Failed to upsert thread ${threadId}:`, error.message)
    return null
  }

  return upsertData
}

// Process threads in batches with concurrency control
async function processThreadBatch(
  supabase: ReturnType<typeof getSupabase>,
  accessToken: string,
  threadIds: string[],
  concurrency: number = 5
) {
  let processed = 0
  const results: any[] = []

  for (let i = 0; i < threadIds.length; i += concurrency) {
    const batch = threadIds.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(id => processThread(supabase, accessToken, id))
    )
    batchResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value)
        processed++
      }
    })
  }

  return { processed, results }
}

// Full sync: paginate through all inbox threads
async function fullSync(supabase: ReturnType<typeof getSupabase>, accessToken: string) {
  // Mark sync in progress
  await supabase.from('email_sync_state').update({
    sync_in_progress: true,
    sync_started_at: new Date().toISOString(),
  }).eq('id', 1)

  let allThreadIds: string[] = []
  let pageToken: string | undefined
  let historyId: string | null = null

  try {
    // Paginate through all inbox threads
    do {
      const result = await listThreads(accessToken, {
        maxResults: 100,
        pageToken,
        labelIds: ['INBOX'],
      })

      if (result.threads) {
        allThreadIds = allThreadIds.concat(result.threads.map((t: any) => t.id))
      }

      // Capture historyId from first page
      if (!historyId && result.threads?.[0]) {
        const firstThread = await getThread(accessToken, result.threads[0].id)
        historyId = firstThread.messages?.[0]?.historyId || null
      }

      pageToken = result.nextPageToken
    } while (pageToken)

    // Process all threads
    const { processed } = await processThreadBatch(supabase, accessToken, allThreadIds)

    // Remove threads from cache that are no longer in inbox
    if (allThreadIds.length > 0) {
      await supabase
        .from('email_threads')
        .delete()
        .not('gmail_thread_id', 'in', `(${allThreadIds.join(',')})`)
        .eq('archived_flag', false) // don't delete manually archived threads
    }

    // Update sync state
    await supabase.from('email_sync_state').update({
      gmail_history_id: historyId,
      last_full_sync_at: new Date().toISOString(),
      sync_in_progress: false,
      total_threads_cached: processed,
    }).eq('id', 1)

    return { success: true, threadsUpdated: processed, mode: 'full' }
  } catch (error: any) {
    // Clear sync lock on error
    await supabase.from('email_sync_state').update({
      sync_in_progress: false,
    }).eq('id', 1)
    throw error
  }
}

// Incremental sync: use Gmail history API for changes since last sync
async function incrementalSync(supabase: ReturnType<typeof getSupabase>, accessToken: string) {
  // Get current sync state
  const { data: syncState } = await supabase
    .from('email_sync_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (!syncState?.gmail_history_id) {
    // No history ID — fall back to full sync
    return fullSync(supabase, accessToken)
  }

  // Check for stale sync lock (older than 5 minutes)
  if (syncState.sync_in_progress && syncState.sync_started_at) {
    const lockAge = Date.now() - new Date(syncState.sync_started_at).getTime()
    if (lockAge < 5 * 60 * 1000) {
      return { success: true, threadsUpdated: 0, mode: 'skipped', reason: 'sync_in_progress' }
    }
  }

  await supabase.from('email_sync_state').update({
    sync_in_progress: true,
    sync_started_at: new Date().toISOString(),
  }).eq('id', 1)

  try {
    const historyResult = await listHistory(accessToken, syncState.gmail_history_id)

    // History expired — fall back to full sync
    if (historyResult.expired) {
      await supabase.from('email_sync_state').update({ sync_in_progress: false }).eq('id', 1)
      return fullSync(supabase, accessToken)
    }

    // Collect unique thread IDs from history
    const changedThreadIds = new Set<string>()
    for (const record of historyResult.history) {
      const allMessages = [
        ...(record.messagesAdded || []),
        ...(record.messagesDeleted || []),
        ...(record.labelsAdded || []),
        ...(record.labelsRemoved || []),
      ]
      allMessages.forEach((item: any) => {
        if (item.message?.threadId) {
          changedThreadIds.add(item.message.threadId)
        }
      })
    }

    let processed = 0
    if (changedThreadIds.size > 0) {
      const result = await processThreadBatch(
        supabase,
        accessToken,
        Array.from(changedThreadIds)
      )
      processed = result.processed
    }

    // Also re-compute follow-up tiers for existing follow_up threads
    // (they age over time even without new messages)
    await refreshFollowUpTiers(supabase)

    // Update sync state
    await supabase.from('email_sync_state').update({
      gmail_history_id: historyResult.historyId || syncState.gmail_history_id,
      last_incremental_sync_at: new Date().toISOString(),
      sync_in_progress: false,
    }).eq('id', 1)

    return { success: true, threadsUpdated: processed, mode: 'incremental' }
  } catch (error: any) {
    await supabase.from('email_sync_state').update({ sync_in_progress: false }).eq('id', 1)
    throw error
  }
}

// Refresh follow-up tiers for threads that may have aged into a new tier
async function refreshFollowUpTiers(supabase: ReturnType<typeof getSupabase>) {
  const { data: followUpThreads } = await supabase
    .from('email_threads')
    .select('gmail_thread_id, first_unanswered_reply_date, follow_up_tier, bucket')
    .in('bucket', ['responded', 'follow_up'])
    .not('first_unanswered_reply_date', 'is', null)

  if (!followUpThreads) return

  const { computeFollowUpTier } = await import('../../../lib/email-buckets')

  for (const thread of followUpThreads) {
    const replyDate = new Date(thread.first_unanswered_reply_date)
    const daysSince = (Date.now() - replyDate.getTime()) / (1000 * 60 * 60 * 24)

    if (thread.bucket === 'responded' && daysSince >= 2) {
      // Should move to follow_up
      const tier = computeFollowUpTier(replyDate)
      await supabase.from('email_threads').update({
        bucket: 'follow_up',
        follow_up_tier: tier,
      }).eq('gmail_thread_id', thread.gmail_thread_id)
    } else if (thread.bucket === 'follow_up') {
      // Check if tier needs updating
      const newTier = computeFollowUpTier(replyDate)
      if (newTier !== thread.follow_up_tier) {
        await supabase.from('email_threads').update({
          follow_up_tier: newTier,
        }).eq('gmail_thread_id', thread.gmail_thread_id)
      }
    }
  }
}

export async function POST(request: Request) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  try {
    const { mode = 'incremental' } = await request.json()
    const supabase = getSupabase()

    let result
    if (mode === 'full') {
      result = await fullSync(supabase, accessToken)
    } else {
      result = await incrementalSync(supabase, accessToken)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
