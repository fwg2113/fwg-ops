'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { DocSummary, TeamMember } from './types'

export type AddTaskPayload = {
  title: string
  description: string | null
  scheduled_date: string | null
  is_priority: boolean
  parent_document_id: string | null
  assigneeIds: string[]
}

type Mode = 'standalone' | 'invoice'

export default function DailyPlanAddTaskModal({
  defaultDate, docs, teamMembers, onClose, onCreated,
}: {
  defaultDate: string
  docs: DocSummary[]
  teamMembers: TeamMember[]
  onClose: () => void
  onCreated: (payload: AddTaskPayload) => Promise<void> | void
}) {
  const [mode, setMode] = useState<Mode>('standalone')

  // Shared fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduled_date, setScheduledDate] = useState<string>(defaultDate)
  const [is_priority, setIsPriority] = useState(false)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])

  // Invoice picker
  const [searchQuery, setSearchQuery] = useState('')
  const [pickedDocId, setPickedDocId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (mode === 'standalone') titleRef.current?.focus() }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs.slice(0, 50)
    const q = searchQuery.toLowerCase()
    return docs.filter(d =>
      (d.doc_number || '').toLowerCase().includes(q) ||
      (d.customer_name || '').toLowerCase().includes(q) ||
      (d.company_name || '').toLowerCase().includes(q) ||
      (d.vehicle_description || '').toLowerCase().includes(q) ||
      (d.project_description || '').toLowerCase().includes(q)
    ).slice(0, 50)
  }, [docs, searchQuery])

  const pickedDoc = pickedDocId ? docs.find(d => d.id === pickedDocId) : null

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const canSubmit = (() => {
    if (!title.trim()) return false
    if (mode === 'invoice' && !pickedDocId) return false
    return true
  })()

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onCreated({
        title: title.trim(),
        description: description.trim() || null,
        scheduled_date,
        is_priority,
        parent_document_id: pickedDocId,
        assigneeIds,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#111', borderRadius: 14, width: 540, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(148,163,184,0.15)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
            {mode === 'invoice' ? (pickedDoc ? 'New invoice-linked task' : 'Pick an invoice') : 'New task'}
          </h3>
          <button onClick={onClose} style={{ background: 'rgba(148,163,184,0.1)', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        {/* Mode toggle */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(148,163,184,0.06)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setMode('standalone'); setPickedDocId(null) }}
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 7,
              background: mode === 'standalone' ? 'rgba(34,211,238,0.12)' : 'rgba(148,163,184,0.06)',
              border: mode === 'standalone' ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(148,163,184,0.15)',
              color: mode === 'standalone' ? '#22d3ee' : '#94a3b8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Standalone task</button>
          <button
            onClick={() => setMode('invoice')}
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 7,
              background: mode === 'invoice' ? 'rgba(168,85,247,0.12)' : 'rgba(148,163,184,0.06)',
              border: mode === 'invoice' ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(148,163,184,0.15)',
              color: mode === 'invoice' ? '#c4b5fd' : '#94a3b8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >🔗 Link to invoice</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>

          {/* INVOICE MODE — first show picker until invoice is selected */}
          {mode === 'invoice' && !pickedDoc && (
            <>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                placeholder="Search invoices by customer, company, vehicle, or doc#…"
                style={{ width: '100%', padding: '10px 14px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {filteredDocs.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: '#475569', fontSize: 13, fontStyle: 'italic' }}>No active invoices match.</div>
                )}
                {filteredDocs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setPickedDocId(d.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '10px 12px', borderRadius: 8, marginBottom: 5,
                      background: '#131313', border: '1px solid rgba(148,163,184,0.06)',
                      color: '#cbd5e1', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                      {d.vehicle_description || d.project_description || d.customer_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {d.doc_number} · {d.company_name || d.customer_name} · {d.production_stage || 'QUEUE'}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* INVOICE MODE — after picking, show linked invoice + simple fields */}
          {mode === 'invoice' && pickedDoc && (
            <>
              <div style={{ padding: '10px 12px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: '#c4b5fd', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>Linked invoice</div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, lineHeight: 1.25 }}>
                    {pickedDoc.vehicle_description || pickedDoc.project_description || pickedDoc.customer_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {pickedDoc.doc_number} · {pickedDoc.company_name || pickedDoc.customer_name}
                  </div>
                </div>
                <button onClick={() => setPickedDocId(null)} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>Change</button>
              </div>

              <Field label="Task title">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                  placeholder="e.g. Build print files, Laminate, Cut down…"
                  style={inputStyle}
                />
              </Field>

              <DateAssigneePriorityRow
                date={scheduled_date} setDate={setScheduledDate}
                isPriority={is_priority} setIsPriority={setIsPriority}
                assigneeIds={assigneeIds} toggleAssignee={toggleAssignee}
                teamMembers={teamMembers}
              />
            </>
          )}

          {/* STANDALONE MODE — full form */}
          {mode === 'standalone' && (
            <>
              <Field label="Task title">
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What needs doing?"
                  style={inputStyle}
                />
              </Field>

              <Field label="Description (optional)">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Any extra context…"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>

              <DateAssigneePriorityRow
                date={scheduled_date} setDate={setScheduledDate}
                isPriority={is_priority} setIsPriority={setIsPriority}
                assigneeIds={assigneeIds} toggleAssignee={toggleAssignee}
                teamMembers={teamMembers}
              />
            </>
          )}
        </div>

        {/* Footer */}
        {(mode === 'standalone' || (mode === 'invoice' && pickedDoc)) && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              style={{
                padding: '8px 18px', borderRadius: 7,
                background: canSubmit ? '#22d3ee' : '#222',
                border: 'none', color: canSubmit ? '#000' : '#666',
                fontSize: 12, fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Adding…' : '+ Add task'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Helper sub-components
// ============================================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function DateAssigneePriorityRow({ date, setDate, isPriority, setIsPriority, assigneeIds, toggleAssignee, teamMembers }: {
  date: string
  setDate: (d: string) => void
  isPriority: boolean
  setIsPriority: (v: boolean) => void
  assigneeIds: string[]
  toggleAssignee: (id: string) => void
  teamMembers: TeamMember[]
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14 }}>
        <Field label="Scheduled for">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Priority">
          <button
            onClick={() => setIsPriority(!isPriority)}
            style={{
              padding: '8px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700,
              background: isPriority ? 'rgba(251,146,60,0.18)' : 'rgba(148,163,184,0.06)',
              border: isPriority ? '1px solid #fb923c' : '1px solid rgba(148,163,184,0.15)',
              color: isPriority ? '#fb923c' : '#94a3b8',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            🔥 {isPriority ? 'ON' : 'Off'}
          </button>
        </Field>
      </div>
      <Field label="Assigned to (optional)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {teamMembers.map(m => {
            const isAssigned = assigneeIds.includes(m.id)
            return (
              <button
                key={m.id}
                onClick={() => toggleAssignee(m.id)}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: isAssigned ? `${m.color}25` : 'rgba(148,163,184,0.06)',
                  border: isAssigned ? `1px solid ${m.color}` : '1px solid rgba(148,163,184,0.15)',
                  color: isAssigned ? m.color : '#94a3b8',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                {m.short_name || m.name}
              </button>
            )
          })}
        </div>
      </Field>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: '#0d0d0d',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}
