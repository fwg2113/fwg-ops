'use client'

import { useState } from 'react'
import type { NihTask } from '../types'
import { URGENCY_COLORS } from '../types'

interface TaskCardProps {
  task: NihTask
  subtasks: NihTask[]
  onEdit: (task: NihTask) => void
  onComplete: (task: NihTask) => void
  onDelete: (id: string) => void
  onStatusToggle: (task: NihTask) => void
  onSubtaskToggle: (subtask: NihTask) => void
  onAddSubtask: (parentId: string, title: string) => void
}

export default function TaskCard({
  task,
  subtasks,
  onEdit,
  onComplete,
  onDelete,
  onStatusToggle,
  onSubtaskToggle,
  onAddSubtask,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  const isCompleted = task.status === 'completed'
  const isInProgress = task.status === 'in_progress'
  const isProject = task.is_project
  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length
  const totalSubtasks = subtasks.length

  return (
    <div
      style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        border: `1px solid ${isInProgress ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.06)'}`,
        opacity: isCompleted ? 0.6 : 1,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '14px 16px',
        }}
      >
        {/* Urgency dot / status checkbox */}
        <button
          onClick={() => (isCompleted ? null : onStatusToggle(task))}
          style={{
            width: '18px',
            height: '18px',
            minWidth: '18px',
            borderRadius: '999px',
            border: `2px solid ${URGENCY_COLORS[task.urgency]}`,
            background: isInProgress ? URGENCY_COLORS[task.urgency] : isCompleted ? '#4b5563' : 'transparent',
            cursor: isCompleted ? 'default' : 'pointer',
            marginTop: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          title={isCompleted ? 'Completed' : isInProgress ? 'Click: back to open' : 'Click: start working'}
        >
          {isCompleted && (
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: isCompleted ? 'line-through' : 'none',
                color: isCompleted ? '#6b7280' : '#f1f5f9',
              }}
            >
              {task.title}
            </span>

            {/* Category badge */}
            {task.nih_categories && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 8px',
                  borderRadius: '999px',
                  background: task.nih_categories.color + '22',
                  color: task.nih_categories.color,
                  fontWeight: 500,
                }}
              >
                {task.nih_categories.name}
              </span>
            )}

            {/* Time estimate badge */}
            {task.time_estimate && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 8px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#94a3b8',
                }}
              >
                {task.time_estimate}
              </span>
            )}

            {/* Location */}
            {task.nih_locations && (
              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                {task.nih_locations.name}
              </span>
            )}

            {/* Point of contact */}
            {task.point_of_contact && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                POC: {task.point_of_contact}
              </span>
            )}
          </div>

          {/* Description preview */}
          {task.description && (
            <p
              style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '4px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.description}
            </p>
          )}

          {/* Project progress bar */}
          {isProject && (
            <div style={{ marginTop: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => setExpanded(!expanded)}
              >
                <div
                  style={{
                    flex: 1,
                    height: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${totalSubtasks ? (completedSubtasks / totalSubtasks) * 100 : 0}%`,
                      height: '100%',
                      background: '#22d3ee',
                      borderRadius: '2px',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {completedSubtasks}/{totalSubtasks}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                >
                  <path d="M4 6L8 10L12 6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Assignees */}
        {task.nih_task_assignees?.length > 0 && (
          <div style={{ display: 'flex', gap: '0', marginLeft: '4px' }}>
            {task.nih_task_assignees.map((a, i) => (
              <div
                key={a.nih_team_members?.id || `assignee-${i}`}
                title={a.nih_team_members?.name}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '999px',
                  background: a.nih_team_members?.avatar_color || '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#fff',
                  marginLeft: i > 0 ? '-6px' : '0',
                  border: '2px solid #1d1d1d',
                }}
              >
                {a.nih_team_members?.name?.[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            opacity: showActions ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        >
          {!isCompleted && (
            <button
              onClick={() => onComplete(task)}
              title="Mark complete"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            title="Edit"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            title="Delete"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {isProject && expanded && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 16px 12px 46px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {subtasks.map(sub => (
            <div
              key={sub.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <button
                onClick={() => onSubtaskToggle(sub)}
                style={{
                  width: '16px',
                  height: '16px',
                  minWidth: '16px',
                  borderRadius: '4px',
                  border: `1.5px solid ${sub.status === 'completed' ? '#22c55e' : '#4b5563'}`,
                  background: sub.status === 'completed' ? '#22c55e' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                {sub.status === 'completed' && (
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L7 12L13 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span
                style={{
                  fontSize: '13px',
                  color: sub.status === 'completed' ? '#6b7280' : '#e2e8f0',
                  textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
                }}
              >
                {sub.title}
              </span>
            </div>
          ))}
          {/* Add sub-task input */}
          <form
            onSubmit={e => {
              e.preventDefault()
              if (newSubtask.trim()) {
                onAddSubtask(task.id, newSubtask.trim())
                setNewSubtask('')
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: subtasks.length > 0 ? '4px' : '0',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ minWidth: '14px' }}>
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
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '4px 0',
                fontSize: '13px',
                color: '#e2e8f0',
                outline: 'none',
              }}
            />
          </form>
        </div>
      )}
    </div>
  )
}
