'use client'

import React, { useState } from 'react'
import type { RecurringTask, TeamMember } from './types'

const PATTERNS: { value: string; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Mon–Fri' },
  { value: 'mon_wed_fri', label: 'Mon · Wed · Fri' },
  { value: 'tue_thu', label: 'Tue · Thu' },
  { value: 'weekly:1', label: 'Mondays' },
  { value: 'weekly:2', label: 'Tuesdays' },
  { value: 'weekly:3', label: 'Wednesdays' },
  { value: 'weekly:4', label: 'Thursdays' },
  { value: 'weekly:5', label: 'Fridays' },
  { value: 'weekly:6', label: 'Saturdays' },
  { value: 'weekly:0', label: 'Sundays' },
]

function patternLabel(p: string) {
  return PATTERNS.find(x => x.value === p)?.label || p
}

export default function DailyPlanRecurringModal({
  recurringTasks, teamMembers, onClose, onChange,
}: {
  recurringTasks: RecurringTask[]
  teamMembers: TeamMember[]
  onClose: () => void
  onChange: (next: RecurringTask[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPattern, setNewPattern] = useState('daily')
  const [newAssignee, setNewAssignee] = useState<string | null>(null)
  const [newPriority, setNewPriority] = useState(false)

  const add = async () => {
    if (!newTitle.trim()) return
    const res = await fetch('/api/recurring-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        pattern: newPattern,
        default_assignee_id: newAssignee,
        default_priority: newPriority,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      onChange([...recurringTasks, created])
      setNewTitle(''); setNewPattern('daily'); setNewAssignee(null); setNewPriority(false); setAdding(false)
    }
  }

  const update = (id: string, patch: Partial<RecurringTask>) => {
    onChange(recurringTasks.map(r => r.id === id ? { ...r, ...patch } : r))
    fetch(`/api/recurring-tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }

  const remove = (id: string) => {
    if (!confirm('Remove this recurring task? This will not delete already-spawned daily tasks.')) return
    onChange(recurringTasks.filter(r => r.id !== id))
    fetch(`/api/recurring-tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#111', borderRadius: 14, width: 620, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(148,163,184,0.15)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Recurring tasks</h3>
            <div style={{ fontSize: 11, color: '#64748b' }}>Auto-spawn into the right day-bucket on schedule</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(148,163,184,0.1)', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {recurringTasks.length === 0 && !adding && (
            <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13, fontStyle: 'italic' }}>
              No recurring tasks yet.<br />
              Add one to have it auto-appear in your day-bucket on schedule.
            </div>
          )}

          {recurringTasks.map(r => {
            const assignee = r.default_assignee_id ? teamMembers.find(m => m.id === r.default_assignee_id) : null
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#131313', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 8, marginBottom: 6 }}>
                <select
                  value={r.pattern}
                  onChange={e => update(r.id, { pattern: e.target.value })}
                  style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontSize: 11, fontWeight: 700, padding: '3px 8px', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 5, cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  {PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <input
                  type="text"
                  value={r.title}
                  onChange={e => onChange(recurringTasks.map(x => x.id === r.id ? { ...x, title: e.target.value } : x))}
                  onBlur={e => update(r.id, { title: e.target.value })}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', padding: 0, fontFamily: 'inherit' }}
                />
                <select
                  value={r.default_assignee_id || ''}
                  onChange={e => update(r.id, { default_assignee_id: e.target.value || null })}
                  style={{ background: assignee ? `${assignee.color}20` : 'rgba(148,163,184,0.06)', color: assignee?.color || '#94a3b8', fontSize: 11, fontWeight: 600, padding: '3px 8px', border: assignee ? `1px solid ${assignee.color}40` : '1px solid rgba(148,163,184,0.15)', borderRadius: 5, cursor: 'pointer' }}
                >
                  <option value="">— No default —</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.short_name || m.name}</option>)}
                </select>
                <button
                  onClick={() => update(r.id, { active: !r.active })}
                  title={r.active ? 'Active — click to pause' : 'Paused — click to resume'}
                  style={{ background: r.active ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.06)', border: r.active ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(148,163,184,0.15)', color: r.active ? '#4ade80' : '#94a3b8', padding: '4px 9px', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                >{r.active ? 'ON' : 'PAUSED'}</button>
                <button
                  onClick={() => remove(r.id)}
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', width: 26, height: 26, borderRadius: 5, cursor: 'pointer', fontSize: 14, padding: 0 }}
                >×</button>
              </div>
            )
          })}

          {/* Add new */}
          {adding ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, padding: 12, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8, marginTop: 10, alignItems: 'center' }}>
              <select value={newPattern} onChange={e => setNewPattern(e.target.value)} style={{ background: '#0d0d0d', color: '#22d3ee', fontSize: 12, padding: '6px 10px', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 5, fontFamily: 'inherit' }}>
                {PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false) }}
                placeholder='e.g. "Clean print head"'
                autoFocus
                style={{ padding: '7px 11px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
              <select value={newAssignee || ''} onChange={e => setNewAssignee(e.target.value || null)} style={{ background: '#0d0d0d', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 5, fontFamily: 'inherit' }}>
                <option value="">— No default —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.short_name || m.name}</option>)}
              </select>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                <button onClick={() => { setAdding(false); setNewTitle('') }} style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={add} disabled={!newTitle.trim()} style={{ padding: '6px 12px', borderRadius: 6, background: newTitle.trim() ? '#22d3ee' : '#222', border: 'none', color: newTitle.trim() ? '#000' : '#666', fontSize: 12, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'default' }}>+ Add</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 14 }}>
              + Add recurring task
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
