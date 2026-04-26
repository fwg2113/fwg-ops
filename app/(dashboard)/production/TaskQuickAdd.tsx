'use client'

import React, { useState, useEffect } from 'react'

const STAGES = [
  { key: 'QUEUE', label: 'Queue' },
  { key: 'DESIGN', label: 'Design' },
  { key: 'PRINT', label: 'Print' },
  { key: 'PRODUCTION', label: 'Production' },
] as const

export default function TaskQuickAdd({
  open,
  onClose,
  onCreate,
  defaultStage,
  teamMembers,
}: {
  open: boolean
  onClose: () => void
  onCreate: (task: any) => void
  defaultStage?: string
  teamMembers: { id: string; name: string; short_name?: string; color: string }[]
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState(defaultStage || 'QUEUE')
  const [dueDate, setDueDate] = useState('')
  const [leaderId, setLeaderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setStage(defaultStage || 'QUEUE')
      setDueDate('')
      setLeaderId(null)
    }
  }, [open, defaultStage])

  if (!open) return null

  const submit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/production-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          production_stage: stage,
          due_date: dueDate || null,
          leader_id: leaderId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      onCreate(created)
      onClose()
    } catch (e) {
      console.error(e)
      alert('Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#111', borderRadius: 14, padding: 24, width: 460, maxWidth: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(148,163,184,0.15)' }}>
        <h3 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>TASK</span>
          New task
        </h3>

        <input
          type="text"
          autoFocus
          placeholder="Task title (required)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit() }}
          style={{ width: '100%', padding: '10px 14px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '10px 14px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4, display: 'block' }}>Column</label>
            <select value={stage} onChange={e => setStage(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4, display: 'block' }}>Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '7px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6, display: 'block' }}>Assigned to (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {teamMembers.map(m => (
              <button
                key={m.id}
                onClick={() => setLeaderId(prev => prev === m.id ? null : m.id)}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: leaderId === m.id ? `${m.color}25` : 'rgba(148,163,184,0.06)',
                  border: leaderId === m.id ? `1px solid ${m.color}` : '1px solid rgba(148,163,184,0.15)',
                  color: leaderId === m.id ? m.color : '#94a3b8',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                {m.short_name || m.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={!title.trim() || submitting} style={{ padding: '8px 18px', borderRadius: 8, background: title.trim() ? '#22d3ee' : '#333', border: 'none', color: title.trim() ? '#000' : '#666', fontSize: 13, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default' }}>
            {submitting ? 'Creating…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}
