'use client'

import { useEffect } from 'react'

// Pings /api/voice/heartbeat every ~60s while a dashboard tab is open so the
// "who's reachable right now" panel knows this dashboard is online between
// calls. Renders nothing. Mounted once in the dashboard layout.
export default function VoiceHeartbeat() {
  useEffect(() => {
    let cancelled = false
    const ping = () => {
      if (cancelled) return
      fetch('/api/voice/heartbeat', { method: 'POST' }).catch(() => {})
    }
    ping()
    const id = setInterval(ping, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  return null
}
