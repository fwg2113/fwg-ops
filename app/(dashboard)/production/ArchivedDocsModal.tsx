'use client'

import React, { useEffect, useState } from 'react'

type ArchivedDoc = {
  id: string
  doc_number: string
  customer_name: string
  vehicle_description?: string
  project_description?: string
  production_archived_at: string
}

export default function ArchivedDocsModal({
  open,
  onClose,
  onRestored,
}: {
  open: boolean
  onClose: () => void
  onRestored: (id: string) => void
}) {
  const [docs, setDocs] = useState<ArchivedDoc[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/documents/archived-production')
      .then(r => r.json())
      .then(d => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const restore = async (id: string) => {
    const res = await fetch(`/api/documents/${id}/archive-production`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    })
    if (res.ok) {
      setDocs(prev => prev.filter(d => d.id !== id))
      onRestored(id)
    }
  }

  return (
    <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#111', borderRadius: 14, width: 560, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(148,163,184,0.15)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Archived production cards</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>The invoices behind these cards are untouched. Restore puts the card back on the board.</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(148,163,184,0.1)', border: 'none', color: '#94a3b8', fontSize: 18, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading…</div>}
          {!loading && docs.length === 0 && (
            <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 32 }}>No archived cards.</div>
          )}
          {!loading && docs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#1a1a1a', borderRadius: 8, marginBottom: 8, border: '1px solid rgba(148,163,184,0.08)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{d.customer_name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {d.doc_number} · {d.vehicle_description || d.project_description || '—'}
                </div>
                {d.production_archived_at && (
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                    Archived {new Date(d.production_archived_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button onClick={() => restore(d.id)} style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Restore</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
