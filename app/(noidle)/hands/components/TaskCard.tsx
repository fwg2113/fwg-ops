'use client'

import { useState, type DragEvent } from 'react'
import type { NihTask } from '../types'
import { URGENCY_COLORS, URGENCY_LABELS } from '../types'

interface TaskCardProps {
  task: NihTask
  subtasks: NihTask[]
  onEdit: (task: NihTask) => void
  onComplete: (task: NihTask) => void
  onDelete: (id: string) => void
  onStatusToggle: (task: NihTask) => void
  onSubtaskToggle: (subtask: NihTask) => void
  onSubtaskComplete: (subtask: NihTask) => void
  onAddSubtask: (parentId: string, title: string, points: number) => void
  onEditSubtask: (subtaskId: string, title: string, points: number) => void
  onDeleteSubtask: (subtaskId: string) => void
  isDragOver?: boolean
  onDragStart?: () => void
  onDragOver?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
  subtaskDragOverId?: string | null
  onSubtaskDragStart?: (subtaskId: string, parentId: string) => void
  onSubtaskDragOver?: (subtaskId: string) => void
  onSubtaskDrop?: (targetId: string, parentId: string) => void
}

export default function TaskCard({
  task,
  subtasks,
  onEdit,
  onComplete,
  onDelete,
  onStatusToggle,
  onSubtaskToggle,
  onSubtaskComplete,
  onAddSubtask,
  onEditSubtask,
  onDeleteSubtask,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  subtaskDragOverId,
  onSubtaskDragStart,
  onSubtaskDragOver,
  onSubtaskDrop,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [newSubtaskPoints, setNewSubtaskPoints] = useState(0)
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPoints, setEditPoints] = useState(0)

  const isCompleted = task.status === 'completed'
  const isInProgress = task.status === 'in_progress'
  const isProject = task.is_project
  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length
  const totalSubtasks = subtasks.length
  const urgencyColor = URGENCY_COLORS[task.urgency]

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onDragOver?.()
  }

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart?.()
      }}
      onDragOver={handleDragOver}
      onDrop={e => { e.preventDefault(); onDrop?.() }}
      onDragEnd={() => onDragEnd?.()}
      style={{
        background: '#1a1a1c',
        borderRadius: '14px',
        border: `1px solid ${isDragOver ? 'rgba(215,28,209,0.5)' : isInProgress ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.06)'}`,
        marginBottom: '10px',
        overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.15s, opacity 0.2s',
        transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
        opacity: isCompleted ? 0.45 : 1,
      }}
    >
      {/* Two-zone grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
        {/* LEFT: Content zone */}
        <div style={{ padding: '14px 4px 14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Urgency tag — hidden for low */}
          {task.urgency !== 'low' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: urgencyColor,
              marginBottom: '2px',
              width: 'fit-content',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: urgencyColor }} />
              {URGENCY_LABELS[task.urgency]?.toUpperCase()}
            </div>
          )}

          {/* Title */}
          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            lineHeight: '1.35',
            color: isCompleted ? '#6b7280' : isInProgress ? '#e0f2fe' : '#f1f5f9',
            textDecoration: isCompleted ? 'line-through' : 'none',
          }}>
            {task.title}
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ fontSize: '14px', lineHeight: '1.45', color: '#9ca3af', marginTop: '2px' }}>
              {task.description}
            </div>
          )}

          {/* Meta row — icon-led compact items */}
          {(task.nih_categories || task.time_estimate || task.nih_locations || task.point_of_contact || task.points > 0 || task.is_recurring) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              {task.points > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#d71cd1',
                  whiteSpace: 'nowrap',
                  background: 'rgba(215,28,209,0.12)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.8" />
                  </svg>
                  {task.points} pts
                </span>
              )}
              {task.is_recurring && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#22d3ee',
                  whiteSpace: 'nowrap',
                  background: 'rgba(34,211,238,0.12)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 8C2 4.7 4.7 2 8 2C10.2 2 12.1 3.3 13 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M14 8C14 11.3 11.3 14 8 14C5.8 14 3.9 12.7 3 10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M13 2V5.2H9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 14V10.8H6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {task.recurring_days?.length === 7 ? 'Daily' :
                    task.recurring_days?.length ? task.recurring_days.join(', ') : 'Recurring'}
                </span>
              )}
              {task.nih_categories && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: task.nih_categories.color, whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.8, flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {task.nih_categories.name}
                </span>
              )}
              {task.time_estimate && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M8 2L8 8.5L12 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {task.time_estimate}
                </span>
              )}
              {task.nih_locations && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M2 6L8 2L14 6V13C14 13.6 13.6 14 13 14H3C2.4 14 2 13.6 2 13V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  {task.nih_locations.name}
                </span>
              )}
              {task.point_of_contact && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 14C2 11 4.7 9 8 9C11.3 9 14 11 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  POC: {task.point_of_contact}
                </span>
              )}
            </div>
          )}

          {/* Avatar stack */}
          {task.nih_task_assignees?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
              {task.nih_task_assignees.map((a, i) => (
                <span
                  key={a.nih_team_members?.id || `assignee-${i}`}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#fff',
                    background: a.nih_team_members?.avatar_color || '#6b7280',
                    border: '2px solid #1a1a1c',
                    marginRight: '-6px',
                    flexShrink: 0,
                    zIndex: task.nih_task_assignees.length - i,
                    position: 'relative',
                  }}
                >
                  {a.nih_team_members?.name?.[0] || '?'}
                </span>
              ))}
              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
                {task.nih_task_assignees.map(a => a.nih_team_members?.name).filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {/* Project progress bar */}
          {isProject && (
            <div
              onClick={() => setExpanded(!expanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '10px',
                cursor: 'pointer',
                padding: '4px 0',
                minHeight: '36px',
              }}
            >
              <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${totalSubtasks ? (completedSubtasks / totalSubtasks) * 100 : 0}%`,
                  height: '100%',
                  background: '#22d3ee',
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {completedSubtasks}/{totalSubtasks}
              </span>
              <svg
                width="14" height="14" viewBox="0 0 16 16" fill="none"
                style={{ color: '#4b5563', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>

        {/* RIGHT: Action strip */}
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
          {!isCompleted && (
            <button
              onClick={() => onComplete(task)}
              title="Mark complete"
              style={{
                flex: 1,
                width: '54px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                minHeight: '48px',
                color: '#22c55e',
                position: 'relative',
              }}
            >
              {isInProgress && (
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: '#22d3ee',
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  animation: 'nih-pulse 2s ease-in-out infinite',
                }} />
              )}
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            title="Edit task"
            style={{
              flex: 1,
              width: '54px',
              border: 'none',
              borderTop: !isCompleted ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              minHeight: '48px',
              color: '#6b7280',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {isProject && expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '6px 16px 14px' }}>
          {subtasks.map(sub => (
            <div
              key={sub.id}
              draggable={editingSubtaskId !== sub.id}
              onDragStart={e => {
                if (editingSubtaskId === sub.id) return
                e.stopPropagation()
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', sub.id)
                onSubtaskDragStart?.(sub.id, task.id)
              }}
              onDragOver={e => {
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = 'move'
                onSubtaskDragOver?.(sub.id)
              }}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                onSubtaskDrop?.(sub.id, task.id)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 0',
                minHeight: '44px',
                background: subtaskDragOverId === sub.id ? 'rgba(34,211,238,0.08)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              {editingSubtaskId === sub.id ? (
                /* Inline edit mode */
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (editTitle.trim()) {
                      onEditSubtask(sub.id, editTitle.trim(), editPoints)
                      setEditingSubtaskId(null)
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(34,211,238,0.3)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '15px',
                      color: '#e2e8f0',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ color: editPoints > 0 ? '#d71cd1' : '#4b5563' }}>
                      <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.8" />
                    </svg>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      value={editPoints}
                      onChange={e => setEditPoints(Math.max(0, Math.min(25, Number(e.target.value))))}
                      style={{
                        width: '36px',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '4px 6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: editPoints > 0 ? '#d71cd1' : '#6b7280',
                        fontFamily: 'inherit',
                        outline: 'none',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                  {/* Save */}
                  <button
                    type="submit"
                    disabled={!editTitle.trim()}
                    style={{
                      flexShrink: 0,
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      border: 'none',
                      background: editTitle.trim() ? '#22c55e' : 'rgba(255,255,255,0.06)',
                      color: editTitle.trim() ? '#fff' : '#4b5563',
                      cursor: editTitle.trim() ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                    title="Save"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={() => setEditingSubtaskId(null)}
                    style={{
                      flexShrink: 0,
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#6b7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                    title="Cancel"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this subtask?')) {
                        onDeleteSubtask(sub.id)
                        setEditingSubtaskId(null)
                      }
                    }}
                    style={{
                      flexShrink: 0,
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                    title="Delete subtask"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4.5 4L5 13C5 13.55 5.45 14 6 14H10C10.55 14 11 13.55 11 13L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
              ) : (
                /* Normal display mode */
                <>
                  <button
                    onClick={() => {
                      if (sub.status === 'completed') {
                        onSubtaskToggle(sub)
                      } else {
                        onSubtaskComplete(sub)
                      }
                    }}
                    style={{
                      width: '22px',
                      height: '22px',
                      minWidth: '22px',
                      borderRadius: '6px',
                      border: `2px solid ${sub.status === 'completed' ? '#22c55e' : '#4b5563'}`,
                      background: sub.status === 'completed' ? '#22c55e' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    {sub.status === 'completed' && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L7 12L13 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    onClick={() => {
                      setEditingSubtaskId(sub.id)
                      setEditTitle(sub.title)
                      setEditPoints(sub.points)
                    }}
                    style={{
                      fontSize: '15px',
                      lineHeight: '1.35',
                      color: sub.status === 'completed' ? '#6b7280' : '#e2e8f0',
                      textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
                      flex: 1,
                      cursor: 'pointer',
                    }}
                  >
                    {sub.title}
                  </span>
                  {sub.points > 0 && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: sub.status === 'completed' ? '#6b7280' : '#d71cd1',
                      whiteSpace: 'nowrap',
                      background: sub.status === 'completed' ? 'rgba(255,255,255,0.04)' : 'rgba(215,28,209,0.12)',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      flexShrink: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.8" />
                      </svg>
                      {sub.points}
                    </span>
                  )}
                  {/* Edit button */}
                  <button
                    onClick={() => {
                      setEditingSubtaskId(sub.id)
                      setEditTitle(sub.title)
                      setEditPoints(sub.points)
                    }}
                    style={{
                      flexShrink: 0,
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                    title="Edit subtask"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
          {/* Add sub-task */}
          <form
            onSubmit={e => {
              e.preventDefault()
              if (newSubtask.trim()) {
                onAddSubtask(task.id, newSubtask.trim(), newSubtaskPoints)
                setNewSubtask('')
                setNewSubtaskPoints(0)
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', marginTop: '4px' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M8 3V13M3 8H13" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              placeholder="Add a sub-task..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '10px 0',
                fontSize: '15px',
                color: '#e2e8f0',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ color: newSubtaskPoints > 0 ? '#d71cd1' : '#4b5563' }}>
                <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.8" />
              </svg>
              <input
                type="number"
                min={0}
                max={25}
                value={newSubtaskPoints}
                onChange={e => setNewSubtaskPoints(Math.max(0, Math.min(25, Number(e.target.value))))}
                style={{
                  width: '36px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: newSubtaskPoints > 0 ? '#d71cd1' : '#6b7280',
                  fontFamily: 'inherit',
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!newSubtask.trim()}
              style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: newSubtask.trim() ? '#22d3ee' : 'rgba(255,255,255,0.06)',
                color: newSubtask.trim() ? '#000' : '#4b5563',
                cursor: newSubtask.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
