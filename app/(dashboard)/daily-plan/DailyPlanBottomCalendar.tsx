'use client'

import React from 'react'

// Embeds the real /calendar page via iframe so the visual + behavior is
// always 100% in sync with the Job Calendar (no parallel rendering logic).
// Tasks live in the Today block above, so this section is calendar-only.

export default function DailyPlanBottomCalendar() {
  return (
    <div style={{
      marginTop: 22,
      background: 'linear-gradient(180deg, #161616 0%, #121212 100%)',
      border: '1px solid rgba(148,163,184,0.1)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      height: 720,
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
        style={{ flex: 1, width: '100%', border: 'none', background: '#0a0a0a' }}
      />
    </div>
  )
}
