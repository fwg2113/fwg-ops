'use client'

import React, { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import DailyPlanTask from './DailyPlanTask'
import { todayLocalISO, addDaysISO, formatDateHeader } from './DailyPlan'
import { memberChipLabel, sortMembersForFilter } from './types'
import type { DailyTask, TeamMember, DocSummary } from './types'

export default function DailyPlanTodayBlock({
  viewDate, setViewDate,
  memberFilter, setMemberFilter,
  priorityTasks, regularTasks, recurringTasks,
  assigneesByTask, docById, teamMembers, selectedTaskId,
  onTaskClick, onToggleDone, onTogglePriority, onToggleAssignee, onOpenAddTask,
}: {
  viewDate: string
  setViewDate: (date: string) => void
  memberFilter: string
  setMemberFilter: (id: string) => void
  priorityTasks: DailyTask[]
  regularTasks: DailyTask[]
  recurringTasks: DailyTask[]
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

  // Recurring tasks are merged into the regular task list (the recurring badge
  // on the task line itself communicates the source). They keep sort_order so
  // they slot in alongside other tasks rather than living in their own section.
  const mergedRegularTasks = useMemo<DailyTask[]>(() => {
    return [...regularTasks, ...recurringTasks].sort((a, b) => a.sort_order - b.sort_order)
  }, [regularTasks, recurringTasks])

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
      {/* Header — date navigation + Add Task */}
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

      {/* Member filter row — All / each team member / Unassigned */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid rgba(148,163,184,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        background: 'rgba(13,13,13,0.5)',
      }}>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginRight: 4 }}>Filter</span>
        <FilterChip
          active={memberFilter === 'all'}
          onClick={() => setMemberFilter('all')}
          color="#94a3b8"
          label="All"
        />
        {[...teamMembers].sort(sortMembersForFilter).map(m => (
          <FilterChip
            key={m.id}
            active={memberFilter === m.id}
            onClick={() => setMemberFilter(m.id)}
            color={m.color}
            label={memberChipLabel(m)}
            title={m.name}
          />
        ))}
        <FilterChip
          active={memberFilter === 'unassigned'}
          onClick={() => setMemberFilter('unassigned')}
          color="#475569"
          label="Unassigned"
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '18px 22px', overflowY: 'auto', minHeight: 360 }}>
        {/* Priority section — orange-tinted card */}
        {(priorityTasks.length > 0 || dropPriority.isOver) && (
          <div ref={dropPriority.setNodeRef} style={{
            marginBottom: 16,
            padding: '12px 14px 14px',
            background: 'linear-gradient(180deg, rgba(251,146,60,0.06) 0%, rgba(251,146,60,0.02) 100%)',
            border: '1px solid rgba(251,146,60,0.22)',
            borderRadius: 12,
            boxShadow: '0 0 24px rgba(251,146,60,0.04), inset 0 1px 0 rgba(251,146,60,0.06)',
          }}>
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

        {/* Regular tasks (recurring tasks are merged in here — they keep
            their ↻ recurring badge on the task line itself) */}
        <div ref={dropRegular.setNodeRef} style={{
          padding: '12px 14px 14px',
          background: 'linear-gradient(180deg, #1a1a1a 0%, #161616 100%)',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: 12,
          minHeight: 80,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          <div style={{ fontSize: 13, color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            ☰ Tasks
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, letterSpacing: 0 }}>· {mergedRegularTasks.length} {mergedRegularTasks.length === 1 ? 'item' : 'items'}</span>
          </div>
          <SortableContext items={mergedRegularTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {mergedRegularTasks.map(t => (
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
          {mergedRegularTasks.length === 0 && !dropRegular.isOver && (
            <div style={{ padding: '14px 0', textAlign: 'center', color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
              No tasks for {isLiveToday ? 'today' : 'this date'} — click + Add Task above or drag from a project.
            </div>
          )}
          {dropRegular.isOver && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: '#22d3ee', fontSize: 12, fontStyle: 'italic', border: '1px dashed rgba(34,211,238,0.3)', borderRadius: 8, marginTop: 6 }}>Drop here</div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, color, label, title }: { active: boolean; onClick: () => void; color: string; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        height: 24, padding: '0 10px',
        borderRadius: 12,
        background: active ? `${color}22` : 'rgba(148,163,184,0.05)',
        border: active ? `1px solid ${color}66` : '1px solid rgba(148,163,184,0.12)',
        color: active ? color : '#94a3b8',
        fontSize: 10, fontWeight: 800,
        letterSpacing: 0.4,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: active ? 1 : 0.5 }} />
      {label}
    </button>
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
