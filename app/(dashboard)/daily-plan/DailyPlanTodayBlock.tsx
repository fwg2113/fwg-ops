'use client'

import React, { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import DailyPlanTask from './DailyPlanTask'
import { todayLocalISO, addDaysISO, formatDateHeader } from './DailyPlan'
import type { DailyTask, TeamMember, DocSummary } from './types'

export default function DailyPlanTodayBlock({
  viewDate, setViewDate, priorityTasks, regularTasks, doneToday,
  assigneesByTask, docById, teamMembers, selectedTaskId,
  onTaskClick, onToggleDone, onTogglePriority, onToggleAssignee, onOpenAddTask,
}: {
  viewDate: string
  setViewDate: (date: string) => void
  priorityTasks: DailyTask[]
  regularTasks: DailyTask[]
  doneToday: DailyTask[]
  assigneesByTask: Record<string, TeamMember[]>
  docById: Record<string, DocSummary>
  teamMembers: TeamMember[]
  selectedTaskId: string | null
  onTaskClick: (taskId: string, el: HTMLElement) => void
  onToggleDone: (taskId: string) => void
  onTogglePriority: (taskId: string) => void
  onToggleAssignee: (taskId: string, memberId: string) => void
  onOpenAddTask: () => void
}) {
  const today = todayLocalISO()
  const isLiveToday = viewDate === today

  const dropPriority = useDroppable({ id: 'today-priority' })
  const dropRegular = useDroppable({ id: 'today-regular' })

  const [doneCollapsed, setDoneCollapsed] = useState(false)

  return (
    <div style={{
      background: 'linear-gradient(180deg, #161616 0%, #121212 100%)',
      border: '1px solid rgba(148,163,184,0.1)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Header with date navigation + Add Task button */}
      <div style={{
        padding: '18px 22px',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        background: isLiveToday
          ? 'linear-gradient(90deg, rgba(34,211,238,0.06) 0%, rgba(168,85,247,0.04) 100%)'
          : 'transparent',
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: -0.3 }}>
          {formatDateHeader(viewDate)}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setViewDate(addDaysISO(viewDate, -1))} title="Previous day" style={navBtnStyle}>‹</button>
          <input
            type="date"
            value={viewDate}
            onChange={e => e.target.value && setViewDate(e.target.value)}
            style={{ padding: '8px 12px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#cbd5e1', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={() => setViewDate(addDaysISO(viewDate, 1))} title="Next day" style={navBtnStyle}>›</button>
          {!isLiveToday && (
            <button onClick={() => setViewDate(today)} title="Jump to today" style={{ ...navBtnStyle, width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 600 }}>Today</button>
          )}
          <button onClick={onOpenAddTask} style={{
            background: 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)',
            border: 'none', color: '#000',
            height: 38, padding: '0 18px',
            borderRadius: 9,
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(34,211,238,0.25)',
          }}>+ Add Task</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '18px 22px', overflowY: 'auto', minHeight: 360 }}>
        {/* Priority section — always shown if any priority tasks OR while dragging */}
        {(priorityTasks.length > 0 || dropPriority.isOver) && (
          <div ref={dropPriority.setNodeRef} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(251,146,60,0.2)' }}>
            <div style={{ fontSize: 13, color: '#fb923c', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
              🔥 Priority
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, letterSpacing: 0 }}>· must happen today</span>
            </div>
            <SortableContext items={priorityTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {priorityTasks.map(t => (
                <DailyPlanTask
                  key={t.id}
                  task={t}
                  assignees={assigneesByTask[t.id] || []}
                  doc={t.parent_document_id ? docById[t.parent_document_id] : undefined}
                  isOverdue={false}
                  isSelected={selectedTaskId === t.id}
                  allTeamMembers={teamMembers}
                  onClick={(el) => onTaskClick(t.id, el)}
                  onToggleDone={() => onToggleDone(t.id)}
                  onTogglePriority={() => onTogglePriority(t.id)}
                  onToggleAssignee={(memberId) => onToggleAssignee(t.id, memberId)}
                />
              ))}
            </SortableContext>
            {priorityTasks.length === 0 && dropPriority.isOver && (
              <div style={{ padding: '6px 0', fontSize: 11, color: '#fb923c', fontStyle: 'italic', textAlign: 'center' }}>Drop here for priority</div>
            )}
          </div>
        )}

        {/* Regular tasks */}
        <div ref={dropRegular.setNodeRef} style={{ minHeight: 60 }}>
          <SortableContext items={regularTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {regularTasks.map(t => (
              <DailyPlanTask
                key={t.id}
                task={t}
                assignees={assigneesByTask[t.id] || []}
                doc={t.parent_document_id ? docById[t.parent_document_id] : undefined}
                isOverdue={false}
                isSelected={selectedTaskId === t.id}
                allTeamMembers={teamMembers}
                onClick={(el) => onTaskClick(t.id, el)}
                onToggleDone={() => onToggleDone(t.id)}
                onTogglePriority={() => onTogglePriority(t.id)}
                onToggleAssignee={(memberId) => onToggleAssignee(t.id, memberId)}
              />
            ))}
          </SortableContext>
          {regularTasks.length === 0 && !dropRegular.isOver && (
            <div style={{ padding: '14px 0', textAlign: 'center', color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
              No tasks for {isLiveToday ? 'today' : 'this date'} — click + Add Task above or drag from a project.
            </div>
          )}
          {dropRegular.isOver && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: '#22d3ee', fontSize: 12, fontStyle: 'italic', border: '1px dashed rgba(34,211,238,0.3)', borderRadius: 8, marginTop: 6 }}>Drop here</div>
          )}
        </div>

        {/* Done today (only when viewing live today) */}
        {isLiveToday && doneToday.length > 0 && (
          <div style={{ marginTop: 18, padding: '10px 12px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 9 }}>
            <button onClick={() => setDoneCollapsed(c => !c)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: 11, color: '#4ade80', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1.5 }}>
                ✓ Done today ({doneToday.length})
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{doneCollapsed ? '▾' : '▴'}</span>
            </button>
            {!doneCollapsed && (
              <div style={{ marginTop: 8 }}>
                {doneToday.map(t => (
                  <div key={t.id} style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 3, background: '#0d0d0d', fontSize: 12, color: '#64748b', textDecoration: 'line-through', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'rgba(148,163,184,0.08)',
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#cbd5e1',
  width: 38, height: 38,
  borderRadius: 9,
  cursor: 'pointer',
  fontSize: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
  fontWeight: 600,
}

