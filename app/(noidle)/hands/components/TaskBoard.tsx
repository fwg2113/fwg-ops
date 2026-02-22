'use client'

import { useState, useMemo, useCallback } from 'react'
import type { BoardData, NihTask, FilterState } from '../types'
import HandsLogo from './HandsLogo'
import StatsBar from './StatsBar'
import QuickAdd from './QuickAdd'
import FilterBar from './FilterBar'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import CompleteModal from './CompleteModal'
import EmptyState from './EmptyState'

export default function TaskBoard({ initialData }: { initialData: BoardData }) {
  const [tasks, setTasks] = useState<NihTask[]>(initialData.tasks)
  const { categories, locations, teamMembers } = initialData

  const [filters, setFilters] = useState<FilterState>({
    category: null,
    urgency: null,
    timeEstimate: null,
    location: null,
    assignee: null,
    showCompleted: false,
  })

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<NihTask | null>(null)
  const [completingTask, setCompletingTask] = useState<NihTask | null>(null)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Always include subtasks if parent passes (we filter parents only)
      if (task.parent_id) return true
      if (!filters.showCompleted && task.status === 'completed') return false
      if (filters.category && task.category_id !== filters.category) return false
      if (filters.urgency && task.urgency !== filters.urgency) return false
      if (filters.location && task.location_id !== filters.location) return false
      if (filters.timeEstimate && task.time_estimate !== filters.timeEstimate) return false
      if (filters.assignee) {
        const hasAssignee = task.nih_task_assignees?.some(
          a => a.nih_team_members?.id === filters.assignee
        )
        if (!hasAssignee) return false
      }
      return true
    })
  }, [tasks, filters])

  // Separate into top-level and subtasks
  const topLevelTasks = useMemo(
    () => filteredTasks.filter(t => !t.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [filteredTasks]
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
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <HandsLogo size={36} />
          <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            No Idle Hands
          </span>
        </div>
        <button
          onClick={() => setShowTaskModal(true)}
          style={{
            background: '#d71cd1',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New Task
        </button>
      </header>

      {/* Main content */}
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <StatsBar tasks={tasks} />
        <QuickAdd onAdd={handleQuickAdd} />
        <FilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
          locations={locations}
          teamMembers={teamMembers}
        />

        {topLevelTasks.length === 0 ? (
          <EmptyState onAddTask={() => setShowTaskModal(true)} hasFilters={Object.values(filters).some(v => v !== null && v !== false)} />
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
