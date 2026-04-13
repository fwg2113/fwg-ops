import { useState, useCallback } from 'react'
import type { Bucket, FollowUpTier } from '../../../lib/email-buckets'

export type CachedThread = {
  id: string
  gmail_thread_id: string
  subject: string
  snippet: string
  message_count: number
  is_unread: boolean
  has_attachments: boolean
  last_message_from: string
  last_message_date: string
  last_message_is_ours: boolean
  first_unanswered_reply_date: string | null
  participants: string[]
  bucket: Bucket
  follow_up_tier: FollowUpTier | null
  waiting_on_task_flag: boolean
  archived_flag: boolean
  gmail_label_ids: string[]
}

export type BucketCounts = {
  counts: Record<string, number>
  followUpTiers: Record<string, number>
}

export function useBuckets() {
  const [threads, setThreads] = useState<CachedThread[]>([])
  const [activeBucket, setActiveBucket] = useState<Bucket>('need_to_respond')
  const [activeFollowUpTier, setActiveFollowUpTier] = useState<FollowUpTier | null>(null)
  const [counts, setCounts] = useState<BucketCounts>({ counts: {}, followUpTiers: {} })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadBucket = useCallback(async (bucket?: Bucket, tier?: FollowUpTier | null, pg?: number) => {
    const b = bucket ?? activeBucket
    const t = tier !== undefined ? tier : activeFollowUpTier
    const p = pg ?? page
    setLoading(true)
    try {
      const params = new URLSearchParams({ bucket: b, page: String(p), pageSize: '50' })
      if (b === 'follow_up' && t) params.set('followUpTier', t)
      const res = await fetch(`/api/gmail/buckets?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setThreads(data.threads || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error('Failed to load bucket:', e)
      setThreads([])
    }
    setLoading(false)
  }, [activeBucket, activeFollowUpTier, page])

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/buckets/counts')
      const data = await res.json()
      if (!data.error) setCounts(data)
    } catch (e) {
      console.error('Failed to load counts:', e)
    }
  }, [])

  const switchBucket = useCallback((bucket: Bucket, tier?: FollowUpTier | null) => {
    setActiveBucket(bucket)
    setActiveFollowUpTier(tier || null)
    setPage(1)
    loadBucket(bucket, tier || null, 1)
  }, [loadBucket])

  const toggleFlag = useCallback(async (threadId: string, flag: 'waiting_on_task_flag' | 'archived_flag', value: boolean) => {
    try {
      const res = await fetch(`/api/gmail/buckets/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [flag]: value }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Remove thread from current list if bucket changed
      setThreads(prev => prev.filter(t => t.gmail_thread_id !== threadId))
      // Refresh counts
      loadCounts()
      return data
    } catch (e) {
      console.error('Failed to toggle flag:', e)
      return null
    }
  }, [loadCounts])

  const refresh = useCallback(() => {
    loadBucket()
    loadCounts()
  }, [loadBucket, loadCounts])

  return {
    threads, activeBucket, activeFollowUpTier, counts, loading, page, total,
    setPage, switchBucket, toggleFlag, refresh, loadBucket, loadCounts,
    setThreads,
  }
}
