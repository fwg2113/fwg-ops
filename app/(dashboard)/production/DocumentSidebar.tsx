'use client'

import React, { useEffect } from 'react'

export default function DocumentSidebar({
  open,
  docId,
  onClose,
}: {
  open: boolean
  docId: string | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !docId) return null

  return (
    <div data-modal style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'flex-end',
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 'min(900px, 80vw)', height: '100%', background: '#0d0d0d',
        boxShadow: '-12px 0 32px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Sidebar header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#111', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Editor</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Quote / Invoice</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <a
              href={`/documents/${docId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', color: '#94a3b8', height: 28, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >Open in tab ↗</a>
            <button
              onClick={onClose}
              style={{ background: 'rgba(148,163,184,0.1)', border: 'none', color: '#94a3b8', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}
            >×</button>
          </div>
        </div>

        {/* iframe to existing doc editor — preserves the exact quote builder / invoice manager UI */}
        <iframe
          src={`/documents/${docId}`}
          style={{ flex: 1, width: '100%', border: 'none', background: '#0d0d0d' }}
          title="Document editor"
        />
      </div>
    </div>
  )
}
