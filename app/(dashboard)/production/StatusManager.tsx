'use client'

import React, { useState, useEffect } from 'react'

export type ProductionStatus = {
  id: string
  stage_key: string
  label: string
  color: string
  sort_order: number
  requires_note: boolean
  is_default_on_entry: boolean
  special_action: string | null
  active: boolean
}

const STAGES = [
  { key: 'QUEUE', label: 'Queue' },
  { key: 'DESIGN', label: 'Design' },
  { key: 'PRINT', label: 'Print' },
  { key: 'PRODUCTION', label: 'Production' },
] as const

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#fb923c', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#14b8a6', // teal
  '#94a3b8', // gray
]

const SPECIAL_ACTIONS = [
  { value: '', label: 'None' },
  { value: 'WASTE_REPORT', label: 'Open waste reporter' },
  { value: 'COLLAPSE_INSTALL', label: 'Collapse to install strip' },
]

export default function StatusManager({
  open,
  onClose,
  statuses,
  onChange,
}: {
  open: boolean
  onClose: () => void
  statuses: ProductionStatus[]
  onChange: (next: ProductionStatus[]) => void
}) {
  const [activeStage, setActiveStage] = useState<string>('QUEUE')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ProductionStatus[]>(statuses)

  useEffect(() => { setDraft(statuses) }, [statuses])

  if (!open) return null

  const stageStatuses = draft
    .filter(s => s.stage_key === activeStage && s.active)
    .sort((a, b) => a.sort_order - b.sort_order)

  const updateLocal = (id: string, patch: Partial<ProductionStatus>) => {
    setDraft(d => d.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const persistPatch = async (id: string, patch: Partial<ProductionStatus>) => {
    setSaving(true)
    const res = await fetch(`/api/production-statuses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setDraft(d => {
        const next = d.map(s => s.id === id ? { ...s, ...updated } : s)
        // If we just set a default-on-entry, clear it on others in same stage locally
        if (patch.is_default_on_entry === true) {
          return next.map(s =>
            s.stage_key === updated.stage_key && s.id !== id
              ? { ...s, is_default_on_entry: false }
              : s
          )
        }
        return next
      })
      onChange(draft.map(s => s.id === id ? { ...s, ...updated } : s))
    }
  }

  const addStatus = async () => {
    setSaving(true)
    const res = await fetch('/api/production-statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage_key: activeStage,
        label: 'New status',
        color: '#94a3b8',
      }),
    })
    setSaving(false)
    if (res.ok) {
      const created = await res.json()
      const next = [...draft, created]
      setDraft(next)
      onChange(next)
    }
  }

  const removeStatus = async (id: string) => {
    if (!confirm('Remove this status? Any cards using it will fall back to no status.')) return
    setSaving(true)
    const res = await fetch(`/api/production-statuses/${id}`, { method: 'DELETE' })
    setSaving(false)
    if (res.ok) {
      const next = draft.map(s => s.id === id ? { ...s, active: false } : s)
      setDraft(next)
      onChange(next)
    }
  }

  const moveStatus = async (id: string, direction: 'up' | 'down') => {
    const list = stageStatuses
    const idx = list.findIndex(s => s.id === id)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    const a = list[idx]
    const b = list[swapIdx]
    // Swap sort_orders
    setDraft(d => d.map(s => {
      if (s.id === a.id) return { ...s, sort_order: b.sort_order }
      if (s.id === b.id) return { ...s, sort_order: a.sort_order }
      return s
    }))
    await Promise.all([
      fetch(`/api/production-statuses/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/production-statuses/${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ])
    onChange(draft.map(s => {
      if (s.id === a.id) return { ...s, sort_order: b.sort_order }
      if (s.id === b.id) return { ...s, sort_order: a.sort_order }
      return s
    }))
  }

  return (
    <div
      data-modal
      style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#111', borderRadius: 14, width: 720, maxWidth: '100%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(148,163,184,0.15)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Manage statuses</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Per-column status pills shown on each card</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(148,163,184,0.1)', border: 'none', color: '#94a3b8', fontSize: 18, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}>×</button>
        </div>

        {/* Stage tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          {STAGES.map(s => (
            <button key={s.key} onClick={() => setActiveStage(s.key)} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: activeStage === s.key ? '#22d3ee' : 'rgba(148,163,184,0.1)',
              color: activeStage === s.key ? '#000' : '#94a3b8',
            }}>{s.label}</button>
          ))}
        </div>

        {/* Status list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {stageStatuses.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#475569', fontSize: 13 }}>No statuses yet</div>
          )}
          {stageStatuses.map((s, idx) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              background: '#1a1a1a', borderRadius: 10, marginBottom: 8,
              border: '1px solid rgba(148,163,184,0.08)',
            }}>
              {/* Reorder arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button onClick={() => moveStatus(s.id, 'up')} disabled={idx === 0} style={{ background: 'transparent', border: 'none', color: idx === 0 ? '#333' : '#64748b', cursor: idx === 0 ? 'default' : 'pointer', padding: 0, fontSize: 10, lineHeight: 1 }}>▲</button>
                <button onClick={() => moveStatus(s.id, 'down')} disabled={idx === stageStatuses.length - 1} style={{ background: 'transparent', border: 'none', color: idx === stageStatuses.length - 1 ? '#333' : '#64748b', cursor: idx === stageStatuses.length - 1 ? 'default' : 'pointer', padding: 0, fontSize: 10, lineHeight: 1 }}>▼</button>
              </div>

              {/* Color swatch + picker */}
              <div style={{ position: 'relative' }}>
                <input
                  type="color"
                  value={s.color}
                  onChange={e => updateLocal(s.id, { color: e.target.value })}
                  onBlur={e => persistPatch(s.id, { color: e.target.value })}
                  style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                />
              </div>

              {/* Label input */}
              <input
                type="text"
                value={s.label}
                onChange={e => updateLocal(s.id, { label: e.target.value })}
                onBlur={e => persistPatch(s.id, { label: e.target.value })}
                style={{ flex: 1, padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#f1f5f9', fontSize: 13, outline: 'none' }}
              />

              {/* Default on entry */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={s.is_default_on_entry}
                  onChange={e => {
                    updateLocal(s.id, { is_default_on_entry: e.target.checked })
                    persistPatch(s.id, { is_default_on_entry: e.target.checked })
                  }}
                  style={{ cursor: 'pointer' }}
                /> Default
              </label>

              {/* Requires note */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={s.requires_note}
                  onChange={e => {
                    updateLocal(s.id, { requires_note: e.target.checked })
                    persistPatch(s.id, { requires_note: e.target.checked })
                  }}
                  style={{ cursor: 'pointer' }}
                /> Note
              </label>

              {/* Special action */}
              <select
                value={s.special_action || ''}
                onChange={e => {
                  const val = e.target.value || null
                  updateLocal(s.id, { special_action: val })
                  persistPatch(s.id, { special_action: val })
                }}
                style={{ padding: '5px 8px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#94a3b8', fontSize: 11, outline: 'none', cursor: 'pointer' }}
              >
                {SPECIAL_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>

              {/* Delete */}
              <button onClick={() => removeStatus(s.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          ))}

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Color presets:</span>
            {COLOR_PRESETS.map(c => (
              <span key={c} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>{saving ? 'Saving…' : 'Auto-saves on change'}</span>
          <button onClick={addStatus} style={{ padding: '8px 16px', borderRadius: 8, background: '#22d3ee', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add status</button>
        </div>
      </div>
    </div>
  )
}
