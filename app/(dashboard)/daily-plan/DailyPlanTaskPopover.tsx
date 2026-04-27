'use client'

import React, { forwardRef, useState } from 'react'
import type { DailyTask, TeamMember, DocSummary } from './types'

type Props = {
  task: DailyTask
  assignees: TeamMember[]
  doc?: DocSummary
  teamMembers: TeamMember[]
  style: React.CSSProperties
  flipped: boolean
  onClose: () => void
  onChangeTitle: (title: string) => void
  onChangeDescription: (desc: string | null) => void
  onChangeDate: (date: string | null) => void
  onTogglePriority: () => void
  onToggleAssignee: (memberId: string) => void
  onToggleDone: () => void
  onDelete: () => void
  onOpenProject: () => void
}

const DailyPlanTaskPopover = forwardRef<HTMLDivElement, Props>(function DailyPlanTaskPopover(props, ref) {
  const { task, assignees, doc, teamMembers, style, flipped, onClose, onChangeTitle, onChangeDescription, onChangeDate, onTogglePriority, onToggleAssignee, onToggleDone, onDelete, onOpenProject } = props
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [descDraft, setDescDraft] = useState(task.description || '')
  const isDone = task.status === 'DONE'

  const assignedIds = assignees.map(a => a.id)

  return (
    <div
      ref={ref}
      style={{
        ...style,
        background: '#111111',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 900,
        overflowY: 'auto',
        transformOrigin: flipped ? 'right top' : 'left top',
        animation: 'popIn 0.18s ease-out',
      }}
    >
      <style>{`@keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }`}</style>

      {/* Color bar — orange if priority, otherwise gray */}
      <div style={{ height: 3, borderRadius: '12px 12px 0 0', background: task.is_priority ? '#fb923c' : '#94a3b8' }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              {task.is_priority && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(251,146,60,0.15)', color: '#fb923c', fontWeight: 700 }}>🔥 PRIORITY</span>
              )}
              {task.source === 'recurring' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontWeight: 700 }}>↻ RECURRING</span>
              )}
              {isDone && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontWeight: 700 }}>✓ DONE</span>
              )}
            </div>
            <input
              type="text"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => titleDraft.trim() && titleDraft !== task.title && onChangeTitle(titleDraft.trim())}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              style={{ fontSize: 17, fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0, fontFamily: 'inherit' }}
            />
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: 16, width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {/* Project link */}
        {doc && (
          <div onClick={onOpenProject} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', cursor: 'pointer', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Linked project →</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, lineHeight: 1.25 }}>
              {doc.vehicle_description || doc.project_description || doc.customer_name}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {doc.company_name || doc.customer_name} · {doc.doc_number}
            </div>
          </div>
        )}

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5, letterSpacing: 1 }}>Description</div>
          <textarea
            value={descDraft}
            onChange={e => setDescDraft(e.target.value)}
            onBlur={() => onChangeDescription(descDraft.trim() || null)}
            placeholder="Add a description…"
            rows={2}
            style={{ width: '100%', padding: '8px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
          />
        </div>

        {/* Date + priority */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5, letterSpacing: 1 }}>Scheduled</div>
            <input
              type="date"
              value={task.scheduled_date || ''}
              onChange={e => onChangeDate(e.target.value || null)}
              style={{ padding: '6px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#f1f5f9', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5, letterSpacing: 1 }}>Priority</div>
            <button
              onClick={onTogglePriority}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: task.is_priority ? 'rgba(251,146,60,0.15)' : 'rgba(148,163,184,0.06)',
                border: task.is_priority ? '1px solid #fb923c' : '1px solid rgba(148,163,184,0.15)',
                color: task.is_priority ? '#fb923c' : '#94a3b8',
              }}
            >
              {task.is_priority ? '🔥 ON' : 'Off'}
            </button>
          </div>
        </div>

        {/* Assignees */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>Assigned to</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {teamMembers.map(m => {
              const isAssigned = assignedIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => onToggleAssignee(m.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: isAssigned ? `${m.color}25` : 'rgba(148,163,184,0.06)',
                    border: isAssigned ? `1px solid ${m.color}` : '1px solid rgba(148,163,184,0.15)',
                    color: isAssigned ? m.color : '#94a3b8',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                  {m.short_name || m.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.1)' }}>
          <button
            onClick={onToggleDone}
            style={{ flex: 1, padding: '9px 12px', borderRadius: 7, background: isDone ? 'rgba(148,163,184,0.1)' : '#22c55e', border: isDone ? '1px solid rgba(148,163,184,0.2)' : 'none', color: isDone ? '#94a3b8' : '#0d2317', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {isDone ? '↺ Reopen' : '✓ Mark complete'}
          </button>
          <button
            onClick={onDelete}
            style={{ padding: '9px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
})

export default DailyPlanTaskPopover
