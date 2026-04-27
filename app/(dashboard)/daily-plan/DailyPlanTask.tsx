'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DailyTask, TeamMember, DocSummary } from './types'

export default function DailyPlanTask({
  task, assignees, doc, isOverdue, isSelected, allTeamMembers,
  onClick, onToggleDone, onTogglePriority, onToggleAssignee,
}: {
  task: DailyTask
  assignees: TeamMember[]
  doc?: DocSummary
  isOverdue: boolean
  isSelected: boolean
  allTeamMembers: TeamMember[]
  onClick: (cardEl: HTMLElement) => void
  onToggleDone: () => void
  onTogglePriority: () => void
  onToggleAssignee: (memberId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    transition: { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })

  const isDone = task.status === 'DONE'
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assigneeMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setAssigneeMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [assigneeMenuOpen])

  const assignedIds = new Set(assignees.map(a => a.id))

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    // While the active item is being dragged, hide its in-place row entirely
    // (the DragOverlay shows its visual replica). Without this it leaves a
    // ghost gap that feels stuttery.
    opacity: isDragging ? 0 : 1,
    visibility: isDragging ? 'hidden' : 'visible',
    background: 'linear-gradient(180deg, #181818 0%, #131313 100%)',
    border: isOverdue ? '1px solid rgba(239,68,68,0.4)' : isSelected ? '1px solid rgba(34,211,238,0.6)' : '1px solid rgba(148,163,184,0.08)',
    borderLeft: task.is_priority ? '4px solid #fb923c' : (isOverdue ? '4px solid #ef4444' : isSelected ? '4px solid #22d3ee' : '1px solid rgba(148,163,184,0.08)'),
    borderRadius: 10,
    padding: '13px 16px',
    marginBottom: 7,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    userSelect: 'none',
    position: 'relative',
    boxShadow: isSelected ? '0 0 16px rgba(34,211,238,0.18)' : '0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)',
  }

  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    if ('nativeEvent' in e) (e as any).nativeEvent?.stopImmediatePropagation?.()
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      suppressHydrationWarning
      data-task-id={task.id}
      onClick={e => {
        if ((e.target as HTMLElement).closest('.task-noprop')) return
        onClick(e.currentTarget as HTMLElement)
      }}
      style={style}
    >
      {/* Checkbox */}
      <span
        className="task-noprop"
        onClick={e => { stopAll(e); onToggleDone() }}
        onPointerDown={e => e.stopPropagation()}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: '2px solid ' + (isDone ? '#22c55e' : 'rgba(148,163,184,0.45)'),
          background: isDone ? '#22c55e' : 'transparent',
          color: '#0d2317',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}
      >{isDone ? '✓' : ''}</span>

      {/* Invoice / project chip — between checkbox and title */}
      {doc && (
        <span
          style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 5,
            background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', fontWeight: 600,
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            border: '1px solid rgba(168,85,247,0.25)',
            flexShrink: 0,
          }}
          title={`${doc.vehicle_description || doc.project_description || ''} · ${doc.company_name || doc.customer_name}`}
        >
          {doc.vehicle_description || doc.company_name || doc.customer_name}
        </span>
      )}

      {/* Title block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15,
          color: isDone ? '#64748b' : '#f1f5f9',
          textDecoration: isDone ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontWeight: 600,
          letterSpacing: -0.1,
        }}>
          {task.title}
        </div>
        {(isOverdue || task.source === 'recurring') && !isDone && (
          <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
            {isOverdue && task.scheduled_date && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 600 }}>
                Overdue · was {formatShortDate(task.scheduled_date)}
              </span>
            )}
            {task.source === 'recurring' && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontWeight: 600 }}>
                ↻ recurring
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right meta — assignees + priority */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Assignee chips */}
        {assignees.slice(0, 2).map(a => (
          <span key={a.id} title={a.name} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 5,
            background: `${a.color}25`, color: a.color, fontWeight: 700,
            border: `1px solid ${a.color}30`,
          }}>
            {a.short_name || a.name.split(' ')[0]}
          </span>
        ))}
        {assignees.length > 2 && (
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>+{assignees.length - 2}</span>
        )}

        {/* Assign person button */}
        <div className="task-noprop" style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={e => { stopAll(e); setAssigneeMenuOpen(v => !v) }}
            onPointerDown={e => e.stopPropagation()}
            title="Assign people"
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: assignees.length > 0 ? 'rgba(148,163,184,0.06)' : 'rgba(34,211,238,0.08)',
              border: assignees.length > 0 ? '1px solid rgba(148,163,184,0.15)' : '1px dashed rgba(34,211,238,0.3)',
              color: assignees.length > 0 ? '#94a3b8' : '#22d3ee',
              cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >+</button>
          {assigneeMenuOpen && (
            <div
              className="task-noprop"
              onClick={stopAll}
              onPointerDown={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 100, minWidth: 140, padding: 4,
              }}
            >
              {allTeamMembers.map(m => {
                const isAssigned = assignedIds.has(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={(e) => { stopAll(e); onToggleAssignee(m.id) }}
                    style={{
                      width: '100%', padding: '5px 8px', textAlign: 'left',
                      background: isAssigned ? `${m.color}20` : 'transparent',
                      border: 'none', borderRadius: 5, cursor: 'pointer',
                      color: isAssigned ? m.color : '#cbd5e1',
                      fontSize: 11, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                    <span style={{ flex: 1 }}>{m.short_name || m.name}</span>
                    {isAssigned && <span style={{ fontSize: 9, color: m.color }}>✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Priority toggle (one-click) */}
        <button
          className="task-noprop"
          onClick={e => { stopAll(e); onTogglePriority() }}
          onPointerDown={e => e.stopPropagation()}
          title={task.is_priority ? 'Remove priority' : 'Make priority'}
          style={{
            width: 22, height: 22, borderRadius: 4,
            background: task.is_priority ? 'rgba(251,146,60,0.18)' : 'rgba(148,163,184,0.06)',
            border: task.is_priority ? '1px solid rgba(251,146,60,0.4)' : '1px solid rgba(148,163,184,0.12)',
            color: task.is_priority ? '#fb923c' : '#475569',
            cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >🔥</button>
      </div>
    </div>
  )
}

function formatShortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
