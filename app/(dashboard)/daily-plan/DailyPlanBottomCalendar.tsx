'use client'

import React, { useEffect, useState } from 'react'

// Slim job-calendar viewer for the daily plan page. Embeds /calendar?embed=1
// which strips its own chrome and forces week view. The embedded calendar
// posts its content height back up via postMessage so we can grow the iframe
// to fit (no internal scrolling, no clipped events).
export default function DailyPlanBottomCalendar() {
  const [iframeHeight, setIframeHeight] = useState(420)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'fwg-calendar-height') return
      const h = Number(e.data.height)
      // Floor + ceiling to avoid runaway shrink/grow from layout flicker.
      if (Number.isFinite(h)) setIframeHeight(Math.max(320, Math.min(h + 12, 1400)))
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div style={{
      marginTop: 22,
      background: 'linear-gradient(180deg, #161616 0%, #121212 100%)',
      border: '1px solid rgba(148,163,184,0.1)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(148,163,184,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Job Calendar</h2>
        <a
          href="/calendar"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12, fontWeight: 600,
            padding: '6px 12px', borderRadius: 7,
            background: 'rgba(148,163,184,0.08)',
            border: '1px solid rgba(148,163,184,0.18)',
            color: '#cbd5e1',
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >Open full ↗</a>
      </div>
      <iframe
        src="/calendar?embed=1"
        title="Job Calendar"
        scrolling="no"
        style={{
          width: '100%',
          height: iframeHeight,
          border: 'none',
          background: '#0a0a0a',
          overflow: 'hidden',
          transition: 'height 0.2s ease',
        }}
      />
    </div>
  )
}
