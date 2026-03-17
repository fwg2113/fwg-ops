'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { BoardData, NihTask, NihTeamMember, NihPrize, NihCompletionLog, NihWeeklyWinner, ViewBucket, TaskBucket } from '../types'
import { BUCKET_CONFIG } from '../types'
import HandsLogo from './HandsLogo'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import CompleteModal from './CompleteModal'
import EmptyState from './EmptyState'
import Leaderboard from './Leaderboard'
import PointsToast from './PointsToast'
import PhotoGallery from './PhotoGallery'
import PinModal from './PinModal'
import BucketNav from './BucketNav'
import ContentUploadModal from './ContentUploadModal'

interface ToastData {
  points: number
  names: string[]
}

type PinCallback = () => void

export default function TaskBoard({ initialData }: { initialData: BoardData }) {
  const [tasks, setTasks] = useState<NihTask[]>(initialData.tasks)
  const { categories, locations } = initialData
  const [teamMembers, setTeamMembers] = useState<NihTeamMember[]>(initialData.teamMembers)
  const [prizes, setPrizes] = useState<NihPrize[]>(initialData.prizes)
  const [completionLog, setCompletionLog] = useState<NihCompletionLog[]>(initialData.completionLog)
  const [weeklyWinners, setWeeklyWinners] = useState<NihWeeklyWinner[]>(initialData.weeklyWinners)

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<NihTask | null>(null)
  const [completingTask, setCompletingTask] = useState<NihTask | null>(null)
  const [completingSubtask, setCompletingSubtask] = useState<NihTask | null>(null)
  const [completingParentAutoComplete, setCompletingParentAutoComplete] = useState<NihTask | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const pinCallbackRef = useRef<PinCallback | null>(null)

  // V2: Bucket navigation — read initial bucket from URL query param
  const searchParams = useSearchParams()
  const [activeBucket, setActiveBucket] = useState<ViewBucket>(() => {
    const param = searchParams.get('bucket')
    if (param && param in BUCKET_CONFIG) return param as ViewBucket
    return 'recurring'
  })
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false)
  const [showContentUpload, setShowContentUpload] = useState(false)

  const handleRequestPin = useCallback((callback: PinCallback) => {
    pinCallbackRef.current = callback
    setShowPinModal(true)
  }, [])

  const handlePointsUpdate = useCallback((updatedMembers: NihTeamMember[]) => {
    setTeamMembers(prev => prev.map(m => {
      const updated = updatedMembers.find((u: NihTeamMember) => u.id === m.id)
      return updated ? { ...m, total_points: updated.total_points } : m
    }))
  }, [])

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragContext = useRef<'tasks' | 'subtasks'>('tasks')
  const dragParentId = useRef<string | null>(null)

  // ── Derived task lists by bucket ──
  const byOrder = (a: NihTask, b: NihTask) => a.sort_order - b.sort_order

  const bucketTasks = useMemo(() => {
    const topLevel = tasks.filter(t => !t.parent_id)
    return {
      recurring: topLevel.filter(t => t.task_bucket === 'recurring' && t.status !== 'completed').sort(byOrder),
      urgent: topLevel.filter(t => t.task_bucket === 'urgent' && t.status !== 'completed').sort(byOrder),
      whenever: topLevel.filter(t => t.task_bucket === 'whenever' && t.status !== 'completed').sort(byOrder),
      bonus: topLevel.filter(t => t.task_bucket === 'bonus' && t.status !== 'completed').sort(byOrder),
      completed: topLevel.filter(t => t.status === 'completed').sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return bTime - aTime
      }),
    }
  }, [tasks])

  const bucketCounts: Record<ViewBucket, number> = useMemo(() => ({
    recurring: bucketTasks.recurring.length,
    urgent: bucketTasks.urgent.length,
    whenever: bucketTasks.whenever.length,
    bonus: bucketTasks.bonus.length,
    completed: completionLog.length || bucketTasks.completed.length,
    gallery: completionLog.filter(c => c.photo_url).length,
  }), [bucketTasks, completionLog])

  // Current bucket's active task list (for drag-and-drop and rendering)
  const activeTasks = useMemo(() => {
    if (activeBucket === 'completed' || activeBucket === 'gallery') return []
    return bucketTasks[activeBucket] || []
  }, [activeBucket, bucketTasks])

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

  const refreshCompletionLog = useCallback(async () => {
    const res = await fetch('/api/noidle/completion-log')
    if (res.ok) {
      const data = await res.json()
      setCompletionLog(data)
    }
  }, [])

  const handleDeleteLogEntry = useCallback(async (logId: string) => {
    const res = await fetch(`/api/noidle/completion-log/${logId}`, { method: 'DELETE' })
    if (res.ok) {
      setCompletionLog(prev => prev.filter(e => e.id !== logId))
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

  // Auto-reset recurring tasks on page load
  useEffect(() => {
    const resetRecurring = async () => {
      const res = await fetch('/api/noidle/tasks/reset-recurring', { method: 'POST' })
      if (res.ok) {
        const result = await res.json()
        if (result.reset > 0) {
          await refreshTasks()
        }
      }
    }
    resetRecurring()
  }, [refreshTasks])

  const handleManualReset = useCallback(
    async (taskId: string) => {
      const res = await fetch(`/api/noidle/tasks/${taskId}/reset`, { method: 'POST' })
      if (res.ok) {
        await refreshTasks()
      }
    },
    [refreshTasks]
  )

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

      const oldIndex = activeTasks.findIndex(t => t.id === dragId)
      const newIndex = activeTasks.findIndex(t => t.id === targetId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...activeTasks]
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
    [dragId, activeTasks, tasks, persistOrder]
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
      if (res.ok) {
        await refreshTasks()
        await refreshTeamMembers()
      }
    },
    [refreshTasks, refreshTeamMembers]
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
        await refreshCompletionLog()
        setCompletingTask(null)
      }
    },
    [refreshTasks, refreshTeamMembers, refreshCompletionLog]
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
    async (parentId: string, title: string, points: number) => {
      const res = await fetch('/api/noidle/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, parent_id: parentId, points }),
      })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  const handleEditSubtask = useCallback(
    async (subtaskId: string, title: string, points: number) => {
      const res = await fetch(`/api/noidle/tasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, points }),
      })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  const handleDeleteSubtask = useCallback(
    async (subtaskId: string) => {
      const res = await fetch(`/api/noidle/tasks/${subtaskId}`, { method: 'DELETE' })
      if (res.ok) {
        await refreshTasks()
        await refreshTeamMembers()
      }
    },
    [refreshTasks, refreshTeamMembers]
  )

  const handleSubtaskToggle = useCallback(
    async (subtask: NihTask) => {
      const res = await fetch(`/api/noidle/tasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open', completed_at: null, completion_notes: null }),
      })
      if (res.ok) await refreshTasks()
    },
    [refreshTasks]
  )

  const handleSubtaskCompleteStart = useCallback(
    (subtask: NihTask) => {
      setCompletingSubtask(subtask)
    },
    []
  )

  const handleSubtaskComplete = useCallback(
    async (subtaskId: string, notes: string, photoUrl: string | null, completedByIds: string[]) => {
      const res = await fetch(`/api/noidle/tasks/${subtaskId}/complete`, {
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

        const subtask = completingSubtask
        setCompletingSubtask(null)

        await refreshTasks()
        await refreshTeamMembers()
        await refreshCompletionLog()

        // Check if all sibling subtasks are now done → auto-complete parent
        if (subtask?.parent_id) {
          const freshRes = await fetch('/api/noidle/tasks')
          if (freshRes.ok) {
            const freshTasks: NihTask[] = await freshRes.json()
            setTasks(freshTasks)
            const siblings = freshTasks.filter(t => t.parent_id === subtask.parent_id)
            const allDone = siblings.length > 0 && siblings.every(s => s.status === 'completed')
            if (allDone) {
              const parent = freshTasks.find(t => t.id === subtask.parent_id)
              if (parent && parent.status !== 'completed') {
                setCompletingParentAutoComplete(parent)
              }
            }
          }
        }
      }
    },
    [completingSubtask, refreshTasks, refreshTeamMembers, refreshCompletionLog]
  )

  const handleParentAutoComplete = useCallback(
    async (parentId: string, notes: string, photoUrl: string | null) => {
      const res = await fetch(`/api/noidle/tasks/${parentId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, photo_url: photoUrl, completed_by_ids: [] }),
      })
      if (res.ok) {
        await refreshTasks()
        await refreshCompletionLog()
        setCompletingParentAutoComplete(null)
      }
    },
    [refreshTasks, refreshCompletionLog]
  )

  const handleDeleteCompletion = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/noidle/completion-log/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCompletionLog(prev => prev.filter(c => c.id !== id))
      }
    },
    []
  )

  // ── Leaderboard summary (collapsed view) ──
  const leaderboardSummary = useMemo(() => {
    const sorted = [...teamMembers].filter(m => m.is_active).sort((a, b) => b.total_points - a.total_points)
    return sorted.slice(0, 3)
  }, [teamMembers])

  // Total available points for active bucket
  const bucketPoints = useMemo(() => {
    return activeTasks.reduce((sum, t) => {
      const subs = subtasksMap[t.id]
      if (subs?.length) return sum + subs.reduce((s, st) => s + (st.status !== 'completed' ? st.points : 0), 0)
      return sum + (t.points || 0)
    }, 0)
  }, [activeTasks, subtasksMap])

  // ── Render ──
  const isTaskBucket = activeBucket !== 'completed' && activeBucket !== 'gallery'
  const defaultBucket: TaskBucket | undefined = isTaskBucket ? activeBucket as TaskBucket : undefined

  return (
    <div style={{ paddingBottom: '60px' }}>
      <style>{`@keyframes nih-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HandsLogo size={44} />
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            No Idle Hands
          </h1>
        </div>
        {isTaskBucket && (
          <button
            onClick={() => handleRequestPin(() => setShowTaskModal(true))}
            style={{
              background: '#CE0000',
              border: 'none',
              borderRadius: 10,
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add
          </button>
        )}
      </header>

      {/* Leaderboard — collapsed summary, expandable */}
      <div
        onClick={() => setLeaderboardExpanded(!leaderboardExpanded)}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {!leaderboardExpanded ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            {leaderboardSummary.map((m, i) => {
              const medals = ['🥇', '🥈', '🥉']
              return (
                <span key={m.id} style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : '#cd7f32' }}>
                  {medals[i]} {m.name.split(' ')[0]} ({m.total_points})
                </span>
              )
            })}
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#6b7280', flexShrink: 0 }}>
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transform: 'rotate(180deg)' }}>
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Collapse Leaderboard
          </div>
        )}
      </div>

      {leaderboardExpanded && (
        <div onClick={e => e.stopPropagation()}>
          <Leaderboard
            teamMembers={teamMembers}
            prizes={prizes}
            onPrizesUpdate={setPrizes}
            onPointsUpdate={handlePointsUpdate}
            weeklyWinners={weeklyWinners}
            onWeeklyReset={(winners, updatedMembers) => {
              setWeeklyWinners(winners)
              setTeamMembers(prev => prev.map(m => {
                const updated = updatedMembers.find((u: NihTeamMember) => u.id === m.id)
                return updated ? { ...m, total_points: updated.total_points } : m
              }))
            }}
          />
        </div>
      )}

      {/* Add Content + Bucket Navigation — sticky together */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#111113' }}>
        <div style={{ padding: '8px 16px 0' }}>
          <button
            onClick={() => setShowContentUpload(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px',
              borderRadius: 12,
              border: '1.5px solid #d71cd1',
              background: '#d71cd118',
              color: '#d71cd1',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="3" />
              <circle cx="12" cy="13" r="4" />
              <path d="M8 6L9 3H15L16 6" />
            </svg>
            Add Content
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>
              1pt per Photo | 3pts per Video
            </span>
          </button>
        </div>
        <BucketNav
          activeBucket={activeBucket}
          onChange={setActiveBucket}
          counts={bucketCounts}
        />
      </div>

      {/* Bucket points banner */}
      {isTaskBucket && bucketPoints > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 16px 0',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            color: BUCKET_CONFIG[activeBucket].color,
            background: `${BUCKET_CONFIG[activeBucket].color}18`,
            padding: '3px 10px',
            borderRadius: '8px',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.8" />
            </svg>
            {bucketPoints} pts available
          </span>
        </div>
      )}

      {/* ── Active Bucket Content ── */}
      <div style={{ padding: '0 16px', maxWidth: '960px', margin: '0 auto' }}>
        {/* Task buckets: recurring, urgent, whenever, bonus */}
        {isTaskBucket && (
          <>
            {activeTasks.length === 0 ? (
              <EmptyState
                onAddTask={() => handleRequestPin(() => setShowTaskModal(true))}
                hasFilters={false}
              />
            ) : (
              <div style={{ paddingTop: '8px' }}>
                {activeTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasksMap[task.id] || []}
                    onEdit={t => setEditingTask(t)}
                    onComplete={t => setCompletingTask(t)}
                    onDelete={handleDeleteTask}
                    onStatusToggle={handleStatusToggle}
                    onSubtaskToggle={handleSubtaskToggle}
                    onSubtaskComplete={handleSubtaskCompleteStart}
                    onAddSubtask={handleAddSubtask}
                    onEditSubtask={handleEditSubtask}
                    onDeleteSubtask={handleDeleteSubtask}
                    onRequestPin={handleRequestPin}
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
          </>
        )}

        {/* Completed bucket */}
        {activeBucket === 'completed' && (
          <div style={{ paddingTop: '8px' }}>
            {completionLog.length === 0 && bucketTasks.completed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', fontSize: '14px' }}>
                No completed tasks yet.
              </div>
            ) : (
              <>
                {/* Completion history records */}
                {completionLog.map(completion => (
                  <div
                    key={`completion-${completion.id}`}
                    style={{
                      background: '#1a1a1c',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: '10px',
                      overflow: 'hidden',
                      opacity: 0.65,
                    }}
                  >
                    <div style={{ padding: '14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{
                          fontSize: '17px',
                          fontWeight: 600,
                          lineHeight: '1.35',
                          color: '#6b7280',
                          textDecoration: 'line-through',
                          minWidth: 0,
                        }}>
                          {completion.task_title}
                        </div>
                        <span style={{
                          fontSize: '11px',
                          color: '#4b5563',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginTop: '3px',
                        }}>
                          {new Date(completion.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {completion.completed_by_names && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                              <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {completion.completed_by_names}
                          </span>
                        )}
                        {completion.points_awarded > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: 600, color: '#d71cd1', whiteSpace: 'nowrap' }}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                              <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" fill="currentColor" />
                            </svg>
                            {completion.points_awarded} pts
                          </span>
                        )}
                      </div>

                      {(completion.completion_notes || completion.photo_url) && (
                        <div style={{
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          marginTop: '10px',
                          paddingTop: '10px',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                        }}>
                          {completion.photo_url && (
                            <img
                              src={completion.photo_url}
                              alt="Completion photo"
                              onClick={() => setLightboxUrl(completion.photo_url)}
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
                          {completion.completion_notes && (
                            <span style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                              {completion.completion_notes}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Completed tasks (including recurring awaiting reset) */}
                {bucketTasks.completed.map(task => (
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
                        {task.is_recurring && (
                          <button
                            onClick={() => handleManualReset(task.id)}
                            title="Reset task — make available again"
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
                              minHeight: '40px',
                              color: '#22d3ee',
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                              <path d="M2 8C2 4.7 4.7 2 8 2C10.2 2 12.1 3.3 13 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              <path d="M14 8C14 11.3 11.3 14 8 14C5.8 14 3.9 12.7 3 10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              <path d="M13 2V5.2H9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M3 14V10.8H6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setEditingTask(task)}
                          title="View"
                          style={{
                            flex: 1,
                            width: '54px',
                            border: 'none',
                            borderTop: task.is_recurring ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            minHeight: '40px',
                            color: '#6b7280',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this task? Any points awarded will be removed.')) {
                              handleDeleteTask(task.id)
                            }
                          }}
                          title="Delete"
                          style={{
                            flex: 1,
                            width: '54px',
                            border: 'none',
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            minHeight: '40px',
                            color: '#6b7280',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4.5 4L5 13C5 13.55 5.45 14 6 14H10C10.55 14 11 13.55 11 13L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Gallery bucket */}
        {activeBucket === 'gallery' && (
          <div style={{ paddingTop: '8px' }}>
            {completionLog.filter(e => e.photo_url).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', fontSize: '14px' }}>
                No photos yet. Complete tasks with photos to fill the gallery.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '16px',
              }}>
                {completionLog.filter(e => e.photo_url).map(entry => (
                  <div key={entry.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <img
                      src={entry.photo_url!}
                      alt={entry.task_title}
                      onClick={() => setLightboxUrl(entry.photo_url)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                      padding: '24px 8px 8px',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff', lineHeight: '1.3' }}>{entry.task_title}</div>
                      {entry.completed_by_names && (
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{entry.completed_by_names}</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Delete this photo from the gallery?')) {
                          handleDeleteLogEntry(entry.id)
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '999px',
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        opacity: 0.6,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PIN modal */}
      {showPinModal && (
        <PinModal
          onSuccess={() => {
            setShowPinModal(false)
            const cb = pinCallbackRef.current
            if (cb) {
              pinCallbackRef.current = null
              cb()
            } else {
              setShowTaskModal(true)
            }
          }}
          onClose={() => {
            setShowPinModal(false)
            pinCallbackRef.current = null
          }}
        />
      )}

      {/* Modals */}
      {(showTaskModal || editingTask) && (
        <TaskModal
          task={editingTask}
          categories={categories}
          locations={locations}
          teamMembers={teamMembers}
          defaultBucket={defaultBucket}
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

      {completingSubtask && (
        <CompleteModal
          task={completingSubtask}
          teamMembers={teamMembers}
          onComplete={(notes, photoUrl, completedByIds) => handleSubtaskComplete(completingSubtask.id, notes, photoUrl, completedByIds)}
          onClose={() => setCompletingSubtask(null)}
        />
      )}

      {completingParentAutoComplete && (
        <CompleteModal
          task={completingParentAutoComplete}
          teamMembers={teamMembers}
          skipPoints
          onComplete={(notes, photoUrl) => handleParentAutoComplete(completingParentAutoComplete.id, notes, photoUrl)}
          onClose={() => setCompletingParentAutoComplete(null)}
        />
      )}

      {/* Content upload modal */}
      {showContentUpload && (
        <ContentUploadModal
          teamMembers={teamMembers}
          onClose={() => setShowContentUpload(false)}
          onSuccess={(memberId, newTotalPoints) => {
            setTeamMembers(prev => prev.map(m =>
              m.id === memberId ? { ...m, total_points: newTotalPoints } : m
            ))
          }}
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
