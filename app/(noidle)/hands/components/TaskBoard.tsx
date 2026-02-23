'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { BoardData, NihTask, NihTeamMember } from '../types'
import HandsLogo from './HandsLogo'
import QuickAdd from './QuickAdd'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import CompleteModal from './CompleteModal'
import EmptyState from './EmptyState'

export default function TaskBoard({ initialData }: { initialData: BoardData }) {
  const [tasks, setTasks] = useState<NihTask[]>(initialData.tasks)
  const { categories, locations, teamMembers } = initialData

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<NihTask | null>(null)
  const [completingTask, setCompletingTask] = useState<NihTask | null>(null)

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragContext = useRef<'tasks' | 'subtasks'>('tasks')
  const dragParentId = useRef<string | null>(null)

  const [showCompleted, setShowCompleted] = useState(false)

  // Separate into top-level and subtasks (hide completed top-level tasks)
  const topLevelTasks = useMemo(
    () => tasks.filter(t => !t.parent_id && t.status !== 'completed').sort((a, b) => a.sort_order - b.sort_order),
    [tasks]
  )

  // Completed top-level tasks
  const completedTasks = useMemo(
    () => tasks.filter(t => !t.parent_id && t.status === 'completed').sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bTime - aTime // most recent first
    }),
    [tasks]
  )

  const subtasksMap = useMemo(() => {
    const map: Record<string, NihTask[]> = {}
    tasks
      .filter(t => t.parent_id)
      .forEach(t => {
        if (!map[t.parent_id!]) map[t.parent_id!] = []
        map[t.parent_id!].push(t)
      })
    Object.values(map).forEach(arr => arr.sort((a, b) => a.sort_order - b.sort_order))
    return map
  }, [tasks])

  // Refresh tasks from API
  const refreshTasks = useCallback(async () => {
    const res = await fetch('/api/noidle/tasks')
    if (res.ok) {
      const data = await res.json()
      setTasks(data)
    }
  }, [])

  // Persist new order to API
  const persistOrder = useCallback(async (orderedIds: string[]) => {
    await fetch('/api/noidle/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
  }, [])

  // Top-level task drag handlers
  const handleTaskDragStart = useCallback((taskId: string) => {
    dragContext.current = 'tasks'
    dragParentId.current = null
    setDragId(taskId)
  }, [])

  const handleTaskDragOver = useCallback((taskId: string) => {
    if (dragContext.current === 'tasks') {
      setDragOverId(taskId)
    }
  }, [])

  const handleTaskDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId || dragContext.current !== 'tasks') {
        setDragId(null)
        setDragOverId(null)
        return
      }

      const oldIndex = topLevelTasks.findIndex(t => t.id === dragId)
      const newIndex = topLevelTasks.findIndex(t => t.id === targetId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...topLevelTasks]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)

      // Optimistic update
      const updatedTasks = tasks.map(t => {
        const idx = reordered.findIndex(r => r.id === t.id)
        if (idx !== -1) return { ...t, sort_order: idx }
        return t
      })
      setTasks(updatedTasks)
      setDragId(null)
      setDragOverId(null)

      persistOrder(reordered.map(t => t.id))
    },
    [dragId, topLevelTasks, tasks, persistOrder]
  )

  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDragOverId(null)
  }, [])

  // Subtask drag handlers
  const handleSubtaskDragStart = useCallback((subtaskId: string, parentId: string) => {
    dragContext.current = 'subtasks'
    dragParentId.current = parentId
    setDragId(subtaskId)
  }, [])

  const handleSubtaskDragOver = useCallback((subtaskId: string) => {
    if (dragContext.current === 'subtasks') {
      setDragOverId(subtaskId)
    }
  }, [])

  const handleSubtaskDrop = useCallback(
    (targetId: string, parentId: string) => {
      if (!dragId || dragId === targetId || dragContext.current !== 'subtasks' || dragParentId.current !== parentId) {
        setDragId(null)
        setDragOverId(null)
        return
      }

      const subs = subtasksMap[parentId] || []
      const oldIndex = subs.findIndex(s => s.id === dragId)
      const newIndex = subs.findIndex(s => s.id === targetId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...subs]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)

      // Optimistic update
      const updatedTasks = tasks.map(t => {
        const idx = reordered.findIndex(r => r.id === t.id)
        if (idx !== -1) return { ...t, sort_order: idx }
        return t
      })
      setTasks(updatedTasks)
      setDragId(null)
      setDragOverId(null)

      persistOrder(reordered.map(t => t.id))
    },
    [dragId, subtasksMap, tasks, persistOrder]
  )

  const handleQuickAdd = useCallback(
    async (title: string) => {
      const res = await fetch('/api/noidle/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  const handleCreateTask = useCallback(
    async (data: Record<string, unknown>) => {
      const res = await fetch('/api/noidle/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await refreshTasks()
        setShowTaskModal(false)
      }
    },
    [refreshTasks]
  )

  const handleUpdateTask = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`/api/noidle/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await refreshTasks()
        setEditingTask(null)
      }
    },
    [refreshTasks]
  )

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/noidle/tasks/${id}`, { method: 'DELETE' })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  const handleCompleteTask = useCallback(
    async (id: string, notes: string, photoUrl: string | null, completedByIds: string[]) => {
      const res = await fetch(`/api/noidle/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, photo_url: photoUrl, completed_by_ids: completedByIds }),
      })
      if (res.ok) {
        await refreshTasks()
        setCompletingTask(null)
      }
    },
    [refreshTasks]
  )

  const handleStatusToggle = useCallback(
    async (task: NihTask) => {
      if (task.status === 'completed') return
      const newStatus = task.status === 'open' ? 'in_progress' : 'open'
      const res = await fetch(`/api/noidle/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  const handleAddSubtask = useCallback(
    async (parentId: string, title: string) => {
      const res = await fetch('/api/noidle/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, parent_id: parentId }),
      })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  // Subtask toggle — auto-trigger completion modal when all subtasks done
  const handleSubtaskToggle = useCallback(
    async (subtask: NihTask) => {
      const newStatus = subtask.status === 'completed' ? 'open' : 'completed'
      const updates: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString()
      } else {
        updates.completed_at = null
        updates.completion_notes = null
      }
      const res = await fetch(`/api/noidle/tasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const freshRes = await fetch('/api/noidle/tasks')
        if (freshRes.ok) {
          const freshTasks: NihTask[] = await freshRes.json()
          setTasks(freshTasks)

          // Check if all sibling subtasks are now completed
          if (newStatus === 'completed' && subtask.parent_id) {
            const siblings = freshTasks.filter(t => t.parent_id === subtask.parent_id)
            const allDone = siblings.length > 0 && siblings.every(s => s.status === 'completed')
            if (allDone) {
              const parent = freshTasks.find(t => t.id === subtask.parent_id)
              if (parent && parent.status !== 'completed') {
                setCompletingTask(parent)
              }
            }
          }
        }
      }
    },
    []
  )

  return (
    <div>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 auto' }}>
          <button
            onClick={() => setShowTaskModal(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Add new task"
          >
            <HandsLogo size={44} />
          </button>
          <span style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            No Idle Hands
          </span>
        </div>
      </header>

      {/* Main content */}
      <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto' }}>
        <QuickAdd onAdd={handleQuickAdd} />

        {topLevelTasks.length === 0 ? (
          <EmptyState onAddTask={() => setShowTaskModal(true)} hasFilters={false} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            {topLevelTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                subtasks={subtasksMap[task.id] || []}
                onEdit={t => setEditingTask(t)}
                onComplete={t => setCompletingTask(t)}
                onDelete={handleDeleteTask}
                onStatusToggle={handleStatusToggle}
                onSubtaskToggle={handleSubtaskToggle}
                onAddSubtask={handleAddSubtask}
                isDragOver={dragOverId === task.id && dragContext.current === 'tasks'}
                onDragStart={() => handleTaskDragStart(task.id)}
                onDragOver={() => handleTaskDragOver(task.id)}
                onDrop={() => handleTaskDrop(task.id)}
                onDragEnd={handleDragEnd}
                subtaskDragOverId={dragOverId}
                onSubtaskDragStart={handleSubtaskDragStart}
                onSubtaskDragOver={handleSubtaskDragOver}
                onSubtaskDrop={handleSubtaskDrop}
              />
            ))}
          </div>
        )}

        {/* Completed tasks section */}
        {completedTasks.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 0',
                width: '100%',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  transform: showCompleted ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}
              >
                <path d="M4 6L8 10L12 6" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>
                Completed ({completedTasks.length})
              </span>
            </button>

            {showCompleted && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {completedTasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      background: '#1d1d1d',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.04)',
                      padding: '12px 14px',
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      {/* Completed checkmark */}
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          minWidth: '22px',
                          borderRadius: '999px',
                          background: '#22c55e',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '1px',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8L7 12L13 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#6b7280',
                            textDecoration: 'line-through',
                          }}
                        >
                          {task.title}
                        </span>

                        {/* Completion details */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', fontSize: '11px', color: '#4b5563' }}>
                          {task.completed_by_names && (
                            <span>By: {task.completed_by_names}</span>
                          )}
                          {task.completed_at && (
                            <span>{new Date(task.completed_at).toLocaleDateString()}</span>
                          )}
                        </div>

                        {task.completion_notes && (
                          <p style={{ fontSize: '12px', color: '#4b5563', margin: '4px 0 0', fontStyle: 'italic' }}>
                            {task.completion_notes}
                          </p>
                        )}

                        {task.completion_photo_url && (
                          <img
                            src={task.completion_photo_url}
                            alt="Completion photo"
                            style={{
                              marginTop: '6px',
                              borderRadius: '6px',
                              maxWidth: '120px',
                              maxHeight: '80px',
                              objectFit: 'cover',
                            }}
                          />
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => {
                          if (confirm('Remove this completed task?')) {
                            handleDeleteTask(task.id)
                          }
                        }}
                        title="Delete"
                        style={{
                          width: '32px',
                          height: '32px',
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
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4H14M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showTaskModal || editingTask) && (
        <TaskModal
          task={editingTask}
          categories={categories}
          locations={locations}
          teamMembers={teamMembers}
          onSave={
            editingTask
              ? data => handleUpdateTask(editingTask.id, data)
              : handleCreateTask
          }
          onClose={() => {
            setShowTaskModal(false)
            setEditingTask(null)
          }}
        />
      )}

      {completingTask && (
        <CompleteModal
          task={completingTask}
          teamMembers={teamMembers}
          onComplete={(notes, photoUrl, completedByIds) => handleCompleteTask(completingTask.id, notes, photoUrl, completedByIds)}
          onClose={() => setCompletingTask(null)}
        />
      )}
    </div>
  )
}
