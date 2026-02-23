'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import type { BoardData, NihTask, NihTeamMember, NihPrize } from '../types'
import HandsLogo from './HandsLogo'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import CompleteModal from './CompleteModal'
import EmptyState from './EmptyState'
import Leaderboard from './Leaderboard'
import PointsToast from './PointsToast'

interface ToastData {
  points: number
  names: string[]
}

export default function TaskBoard({ initialData }: { initialData: BoardData }) {
  const [tasks, setTasks] = useState<NihTask[]>(initialData.tasks)
  const { categories, locations } = initialData
  const [teamMembers, setTeamMembers] = useState<NihTeamMember[]>(initialData.teamMembers)
  const [prizes, setPrizes] = useState<NihPrize[]>(initialData.prizes)

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<NihTask | null>(null)
  const [completingTask, setCompletingTask] = useState<NihTask | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragContext = useRef<'tasks' | 'subtasks'>('tasks')
  const dragParentId = useRef<string | null>(null)

  const [showCompleted, setShowCompleted] = useState(false)

  const topLevelTasks = useMemo(
    () => tasks.filter(t => !t.parent_id && t.status !== 'completed').sort((a, b) => a.sort_order - b.sort_order),
    [tasks]
  )

  const completedTasks = useMemo(
    () => tasks.filter(t => !t.parent_id && t.status === 'completed').sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bTime - aTime
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

  const refreshTasks = useCallback(async () => {
    const res = await fetch('/api/noidle/tasks')
    if (res.ok) {
      const data = await res.json()
      setTasks(data)
    }
  }, [])

  const refreshTeamMembers = useCallback(async () => {
    const res = await fetch('/api/noidle/leaderboard')
    if (res.ok) {
      const leaderboardData = await res.json()
      setTeamMembers(prev => prev.map(m => {
        const updated = leaderboardData.find((l: NihTeamMember) => l.id === m.id)
        return updated ? { ...m, total_points: updated.total_points } : m
      }))
    }
  }, [])

  const persistOrder = useCallback(async (orderedIds: string[]) => {
    await fetch('/api/noidle/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
  }, [])

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
        const result = await res.json()

        if (result.points_awarded && result.points_total > 0) {
          setToast({
            points: result.points_total,
            names: result.points_names || [],
          })
        }

        await refreshTasks()
        await refreshTeamMembers()
        setCompletingTask(null)
      }
    },
    [refreshTasks, refreshTeamMembers]
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
      if (res.ok) {
        const freshRes = await fetch('/api/noidle/tasks')
        if (freshRes.ok) {
          const freshTasks: NihTask[] = await freshRes.json()
          setTasks(freshTasks)

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
    <div style={{ paddingBottom: '60px' }}>
      <style>{`@keyframes nih-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '18px 16px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => setShowTaskModal(true)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          title="Add new task"
        >
          <HandsLogo size={36} />
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
          No Idle Hands
        </h1>
      </header>

      {/* Leaderboard */}
      <div style={{ paddingTop: '12px' }}>
        <Leaderboard
          teamMembers={teamMembers}
          prizes={prizes}
          onPrizesUpdate={setPrizes}
        />
      </div>

      {/* Task list */}
      <div style={{ padding: '0 16px', maxWidth: '960px', margin: '0 auto' }}>
        {topLevelTasks.length === 0 ? (
          <EmptyState onAddTask={() => setShowTaskModal(true)} hasFilters={false} />
        ) : (
          <>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#6b7280',
              padding: '16px 4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              Open
              <span style={{
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}>
                {topLevelTasks.length}
              </span>
            </div>

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
          </>
        )}

        {/* Completed section */}
        {completedTasks.length > 0 && (
          <>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#6b7280',
                padding: '20px 4px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                fontFamily: 'inherit',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
                style={{ transform: showCompleted ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Completed
              <span style={{
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}>
                {completedTasks.length}
              </span>
            </button>

            {showCompleted && completedTasks.map(task => (
              <div
                key={task.id}
                style={{
                  background: '#1a1a1c',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '10px',
                  overflow: 'hidden',
                  opacity: 0.45,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
                  <div style={{ padding: '14px 4px 14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      lineHeight: '1.35',
                      color: '#6b7280',
                      textDecoration: 'line-through',
                    }}>
                      {task.title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {task.nih_categories && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: task.nih_categories.color, whiteSpace: 'nowrap' }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.8, flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          {task.nih_categories.name}
                        </span>
                      )}
                      {task.completed_by_names && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                            <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {task.completed_by_names}
                        </span>
                      )}
                    </div>

                    {(task.completion_notes || task.completion_photo_url) && (
                      <div style={{
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        marginTop: '10px',
                        paddingTop: '10px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                      }}>
                        {task.completion_photo_url && (
                          <img
                            src={task.completion_photo_url}
                            alt="Completion photo"
                            onClick={() => setLightboxUrl(task.completion_photo_url)}
                            style={{
                              width: '48px',
                              height: '48px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.08)',
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          />
                        )}
                        {task.completion_notes && (
                          <span style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                            {task.completion_notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                    <button
                      onClick={() => setEditingTask(task)}
                      title="View"
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
                        minHeight: '56px',
                        color: '#6b7280',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
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

      {/* Points toast */}
      {toast && (
        <PointsToast
          points={toast.points}
          names={toast.names}
          onDone={() => setToast(null)}
        />
      )}

      {/* Photo lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
            cursor: 'pointer',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Completion photo"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
          />
        </div>
      )}
    </div>
  )
}
