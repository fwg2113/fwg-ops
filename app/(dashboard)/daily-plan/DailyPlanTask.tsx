'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memberChipLabel } from './types'
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

  // Border-left priority: priority (orange) > project_color > overdue > selected > none
  const projectColor = doc?.project_color || null
  const leftBorderColor = task.is_priority
    ? '#fb923c'
    : projectColor
      ? projectColor
      : isOverdue
        ? '#ef4444'
        : isSelected
          ? '#22d3ee'
          : null

  // Subject + customer line — only when linked to a doc
  const subject = doc?.vehicle_description || doc?.project_description || null
  const partyName = doc?.company_name || doc?.customer_name || null

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    visibility: isDragging ? 'hidden' : 'visible',
    background: 'linear-gradient(180deg, #181818 0%, #131313 100%)',
    border: isOverdue ? '1px solid rgba(239,68,68,0.4)' : isSelected ? '1px solid rgba(34,211,238,0.6)' : '1px solid rgba(148,163,184,0.08)',
    borderLeft: leftBorderColor ? `4px solid ${leftBorderColor}` : '1px solid rgba(148,163,184,0.08)',
    borderRadius: 9,
    padding: '8px 11px',
    marginBottom: 5,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
    position: 'relative',
    boxShadow: isSelected ? '0 0 12px rgba(34,211,238,0.18)' : '0 1px 0 rgba(255,255,255,0.02), 0 1px 4px rgba(0,0,0,0.18)',
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
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: '2px solid ' + (isDone ? '#22c55e' : 'rgba(148,163,184,0.45)'),
          background: isDone ? '#22c55e' : 'transparent',
          color: '#0d2317',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}
      >{isDone ? '✓' : ''}</span>

      {/* Title block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: isDone ? '#64748b' : '#f1f5f9',
          textDecoration: isDone ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontWeight: 600,
          letterSpacing: -0.1,
          lineHeight: 1.25,
        }}>
          {task.title}
        </div>

        {/* Sub-line: customer/company · subject — only when linked to a doc */}
        {(partyName || subject) && (
          <div
            title={[partyName, subject].filter(Boolean).join(' · ')}
            style={{
              fontSize: 10, color: '#64748b',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              marginTop: 1, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            {partyName && (
              <span style={{ color: '#94a3b8' }}>{partyName}</span>
            )}
            {partyName && subject && <span style={{ color: '#475569' }}>·</span>}
            {subject && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{subject}</span>
            )}
          </div>
        )}

        {(isOverdue || task.source === 'recurring') && !isDone && (
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {isOverdue && task.scheduled_date && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 600 }}>
                Overdue · was {formatShortDate(task.scheduled_date)}
              </span>
            )}
            {task.source === 'recurring' && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontWeight: 600 }}>
                ↻ recurring
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right meta — assignees + priority */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Assignee initials (3-letter) — show up to 2 */}
        {assignees.slice(0, 2).map(a => (
          <span key={a.id} title={a.name} style={{
            fontSize: 9, padding: '2px 5px', borderRadius: 4,
            background: `${a.color}25`, color: a.color, fontWeight: 800,
            border: `1px solid ${a.color}30`,
            letterSpacing: 0.4,
            fontFamily: 'inherit',
          }}>
            {memberChipLabel(a)}
          </span>
        ))}
        {assignees.length > 2 && (
          <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>+{assignees.length - 2}</span>
        )}

        {/* Assign person button */}
        <div className="task-noprop" style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={e => { stopAll(e); setAssigneeMenuOpen(v => !v) }}
            onPointerDown={e => e.stopPropagation()}
            title="Assign people"
            style={{
              width: 22, height: 22, borderRadius: 5,
              background: assignees.length > 0 ? 'rgba(148,163,184,0.06)' : 'rgba(34,211,238,0.08)',
              border: assignees.length > 0 ? '1px solid rgba(148,163,184,0.15)' : '1px dashed rgba(34,211,238,0.3)',
              color: assignees.length > 0 ? '#94a3b8' : '#22d3ee',
              cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
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
            width: 18, height: 18, borderRadius: 4,
            background: task.is_priority ? 'rgba(251,146,60,0.18)' : 'rgba(148,163,184,0.06)',
            border: task.is_priority ? '1px solid rgba(251,146,60,0.4)' : '1px solid rgba(148,163,184,0.12)',
            color: task.is_priority ? '#fb923c' : '#475569',
            cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: 0,
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
