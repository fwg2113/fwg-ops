import { useState, useCallback, useRef } from 'react'

export function useSync(onSyncComplete?: () => void) {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const syncingRef = useRef(false)

  const triggerSync = useCallback(async (mode: 'full' | 'incremental' = 'incremental') => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)

    try {
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()

      if (data.success) {
        setLastSync(new Date())
        onSyncComplete?.()
      }

      return data
    } catch (e) {
      console.error('Sync failed:', e)
      return null
    } finally {
      setSyncing(false)
      syncingRef.current = false
    }
  }, [onSyncComplete])

  return { syncing, lastSync, triggerSync }
}
