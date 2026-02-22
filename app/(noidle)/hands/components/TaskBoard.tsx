'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import type { BoardData, NihTask } from '../types'
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

  // Separate into top-level and subtasks (hide completed top-level tasks)
  const topLevelTasks = useMemo(
    () => tasks.filter(t => !t.parent_id && t.status !== 'completed').sort((a, b) => a.sort_order - b.sort_order),
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
    async (id: string, notes: string) => {
      const res = await fetch(`/api/noidle/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
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
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  return (
    <div>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '0 auto' }}>
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
            <HandsLogo size={56} />
          </button>
          <span style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            No Idle Hands
          </span>
        </div>
      </header>

      {/* Main content */}
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
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
          onComplete={notes => handleCompleteTask(completingTask.id, notes)}
          onClose={() => setCompletingTask(null)}
        />
      )}
    </div>
  )
}
