'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay,
  PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin, rectIntersection,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import DailyPlanTaskPopover from './DailyPlanTaskPopover'
import DailyPlanProjectPopover from './DailyPlanProjectPopover'
import DailyPlanRecurringModal from './DailyPlanRecurringModal'
import DailyPlanAddTaskModal from './DailyPlanAddTaskModal'
import DailyPlanTopBuckets from './DailyPlanTopBuckets'
import DailyPlanTodayBlock from './DailyPlanTodayBlock'
import DailyPlanProjectsRail from './DailyPlanProjectsRail'
import DailyPlanProjectSidebar from './DailyPlanProjectSidebar'
import DailyPlanBottomCalendar from './DailyPlanBottomCalendar'
import type {
  DailyTask, DailyTaskAssignment, RecurringTask, TeamMember,
  DocSummary, LineItemLite, ProductionStatusLite, CategoryLite, PipelineConfig,
  CalendarEventLite, LineItemFull, PaymentLite,
} from './types'

// ============================================================================
// Date helpers
// ============================================================================

export function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDaysISO(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
// Return Mon-Sat of the week that contains `iso` (legacy 6-day, used by some helpers)
export function monToSatOfWeek(iso?: string): string[] {
  const base = iso || todayLocalISO()
  const d = new Date(base + 'T00:00:00')
  const dow = d.getDay()
  const daysSinceMon = (dow + 6) % 7
  const monday = addDaysISO(base, -daysSinceMon)
  return Array.from({ length: 6 }, (_, i) => addDaysISO(monday, i))
}
// Return Mon-Sun of the week that contains `iso` (full 7-day week)
export function monToSunOfWeek(iso?: string): string[] {
  const base = iso || todayLocalISO()
  const d = new Date(base + 'T00:00:00')
  const dow = d.getDay()
  const daysSinceMon = (dow + 6) % 7
  const monday = addDaysISO(base, -daysSinceMon)
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i))
}
export function formatDateHeader(iso: string): string {
  const today = todayLocalISO()
  const d = new Date(iso + 'T00:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const md = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return iso === today ? `Today — ${weekday}, ${md}` : `${weekday}, ${md}`
}

// ============================================================================
// Component
// ============================================================================

export default function DailyPlan({
  initialTasks, initialAssignments, docs, lineItems, teamMembers,
  productionStatuses, categories, pipelineConfigs, initialRecurringTasks, calendarEvents, payments,
}: {
  initialTasks: DailyTask[]
  initialAssignments: DailyTaskAssignment[]
  docs: DocSummary[]
  lineItems: LineItemFull[]
  teamMembers: TeamMember[]
  productionStatuses: ProductionStatusLite[]
  categories: CategoryLite[]
  pipelineConfigs: PipelineConfig[]
  initialRecurringTasks: RecurringTask[]
  calendarEvents: CalendarEventLite[]
  payments: PaymentLite[]
}) {
  const [tasks, setTasks] = useState<DailyTask[]>(initialTasks)
  const [assignments, setAssignments] = useState<DailyTaskAssignment[]>(initialAssignments)
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>(initialRecurringTasks)

  // The date the Today block is currently showing (defaults to live today)
  const [viewDate, setViewDate] = useState<string>(todayLocalISO())
  // Anchor date for the top 7-day bucket row (default = today, week derived from this)
  const [weekAnchor, setWeekAnchor] = useState<string>(todayLocalISO())

  // Popover (anchored task detail)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [popoverFlipped, setPopoverFlipped] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Project sidebar
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)

  // Recurring tasks settings
  const [recurringModalOpen, setRecurringModalOpen] = useState(false)
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false)

  // Drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const dragOriginRef = useRef<{ scheduled_date: string | null; is_priority: boolean } | null>(null)

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ---------- Indexes ----------
  const taskById = useMemo(() => {
    const m: Record<string, DailyTask> = {}
    for (const t of tasks) m[t.id] = t
    return m
  }, [tasks])

  const assigneesByTask = useMemo(() => {
    const m: Record<string, TeamMember[]> = {}
    for (const a of assignments) {
      if (!m[a.task_id]) m[a.task_id] = []
      const tm = teamMembers.find(t => t.id === a.team_member_id)
      if (tm) m[a.task_id].push(tm)
    }
    return m
  }, [assignments, teamMembers])

  const docById = useMemo(() => {
    const m: Record<string, DocSummary> = {}
    for (const d of docs) m[d.id] = d
    return m
  }, [docs])

  // Tasks for viewDate split into priority vs regular
  const tasksForViewDate = useMemo(() => {
    const open = tasks.filter(t => t.status === 'TODO' && t.scheduled_date === viewDate)
    return {
      priority: open.filter(t => t.is_priority).sort((a, b) => a.sort_order - b.sort_order),
      regular:  open.filter(t => !t.is_priority).sort((a, b) => a.sort_order - b.sort_order),
    }
  }, [tasks, viewDate])

  // Done today (always for live today, regardless of viewDate)
  const doneToday = useMemo(() => {
    const today = todayLocalISO()
    const start = today + 'T00:00:00'
    const end = addDaysISO(today, 1) + 'T00:00:00'
    return tasks.filter(t => t.status === 'DONE' && t.completed_at && t.completed_at >= start && t.completed_at < end)
  }, [tasks])

  // Total open task count per scheduled date across ALL tasks. Used by both
  // the top buckets (whatever week is displayed) and any future date-aware UI.
  const taskCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tasks) {
      if (t.status !== 'TODO' || !t.scheduled_date) continue
      counts[t.scheduled_date] = (counts[t.scheduled_date] || 0) + 1
    }
    return counts
  }, [tasks])

  // "Next up" task per project: first TODO task with parent_document_id and no scheduled_date,
  // ordered by sort_order ascending
  const nextUpByDoc = useMemo(() => {
    const m: Record<string, DailyTask> = {}
    const projectTasks = tasks
      .filter(t => t.status === 'TODO' && t.parent_document_id && !t.scheduled_date)
      .sort((a, b) => a.sort_order - b.sort_order)
    for (const t of projectTasks) {
      if (!t.parent_document_id) continue
      if (!m[t.parent_document_id]) m[t.parent_document_id] = t
    }
    return m
  }, [tasks])

  // ---------- Persistence helpers ----------
  const persistTask = (id: string, patch: Partial<DailyTask>) => {
    fetch(`/api/daily-tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }
  const updateTaskLocal = (id: string, patch: Partial<DailyTask>) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  const updateAndPersist = (id: string, patch: Partial<DailyTask>) => {
    updateTaskLocal(id, patch); persistTask(id, patch)
  }

  const toggleDone = (id: string) => {
    const t = taskById[id]
    if (!t) return
    const nextStatus: 'TODO' | 'DONE' = t.status === 'DONE' ? 'TODO' : 'DONE'
    const completed_at = nextStatus === 'DONE' ? new Date().toISOString() : null
    updateTaskLocal(id, { status: nextStatus, completed_at })
    persistTask(id, { status: nextStatus })
  }

  const createTaskOn = async (scheduled_date: string | null, opts: {
    title: string; is_priority?: boolean; parent_document_id?: string | null
  }) => {
    const insert: any = {
      title: opts.title.trim(),
      scheduled_date,
      is_priority: !!opts.is_priority,
      parent_document_id: opts.parent_document_id || null,
    }
    const res = await fetch('/api/daily-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insert),
    })
    if (res.ok) {
      const created = await res.json()
      setTasks(ts => [...ts, created])
      return created as DailyTask
    }
    return null
  }

  const deleteTask = async (id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id))
    setAssignments(a => a.filter(x => x.task_id !== id))
    fetch(`/api/daily-tasks/${id}`, { method: 'DELETE' }).catch(() => {})
    if (selectedTaskId === id) closePopover()
  }

  const toggleAssignment = (taskId: string, memberId: string) => {
    const exists = assignments.some(a => a.task_id === taskId && a.team_member_id === memberId)
    if (exists) {
      setAssignments(a => a.filter(x => !(x.task_id === taskId && x.team_member_id === memberId)))
      fetch(`/api/daily-tasks/${taskId}/assignments`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId }),
      }).catch(() => {})
    } else {
      setAssignments(a => [...a, { task_id: taskId, team_member_id: memberId }])
      fetch(`/api/daily-tasks/${taskId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId }),
      }).catch(() => {})
    }
  }

  // ---------- Popover ----------
  const openTaskPopover = useCallback((taskId: string, cardEl: HTMLElement) => {
    const rect = cardEl.getBoundingClientRect()
    const popW = 420, popMaxH = 560, gap = 8
    let left = rect.right + gap
    let isFlipped = false
    if (left + popW > window.innerWidth - 16) { left = rect.left - popW - gap; isFlipped = true }
    if (left < 16) left = 16
    let top = rect.top
    if (top + popMaxH > window.innerHeight - 16) top = window.innerHeight - popMaxH - 16
    if (top < 16) top = 16
    setPopoverFlipped(isFlipped)
    setPopoverStyle({ position: 'fixed', top, left, width: popW, maxHeight: popMaxH })
    setSelectedTaskId(taskId)
    setPopoverVisible(true)
  }, [])
  const closePopover = () => { setPopoverVisible(false); setSelectedTaskId(null) }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!popoverVisible) return
      if (popoverRef.current?.contains(target)) return
      if (target.closest('[data-task-id]')) return
      if (target.closest('[data-modal]')) return
      closePopover()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recurringModalOpen) setRecurringModalOpen(false)
        else if (openProjectId) setOpenProjectId(null)
        else if (popoverVisible) closePopover()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [popoverVisible, openProjectId, recurringModalOpen])

  // ---------- Drag-and-drop ----------
  // Distance 8px = clear separation between click vs drag intent. Lower values
  // accidentally trigger drag on slow clicks; higher values feel sluggish.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  // Drop-target IDs:
  //   bucket:YYYY-MM-DD       — top bucket day
  //   today-priority          — Today block, priority section
  //   today-regular           — Today block, regular section
  //   task IDs are sortable within their section
  function decodeDropTarget(id: string, viewDate: string): { scheduled_date: string | null; is_priority: boolean } | null {
    if (id.startsWith('bucket:')) {
      return { scheduled_date: id.slice(7), is_priority: false }
    }
    if (id === 'today-priority') return { scheduled_date: viewDate, is_priority: true }
    if (id === 'today-regular')  return { scheduled_date: viewDate, is_priority: false }
    return null
  }

  const findTaskById = (id: string): DailyTask | null => taskById[id] || null

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setActiveDragId(id)
    const t = findTaskById(id)
    if (t) dragOriginRef.current = { scheduled_date: t.scheduled_date, is_priority: t.is_priority }
    closePopover()
  }

  // No-op: mutating state mid-drag would re-filter the active item out of its
  // SortableContext and confuse dnd-kit. SortableContext + the drag overlay
  // give visual feedback on their own. All commits happen in onDragEnd.
  const onDragOver = (_e: DragOverEvent) => { /* intentionally empty */ }

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id)
    setActiveDragId(null)
    dragOriginRef.current = null

    if (!e.over) return
    const overId = String(e.over.id)
    if (activeId === overId) return

    const t = taskById[activeId]
    if (!t) return

    // Resolve destination fields. overId is either a droppable container
    // (bucket:YYYY-MM-DD / today-priority / today-regular) or another task ID.
    let destFields: { scheduled_date: string | null; is_priority: boolean } | null = null

    const decoded = decodeDropTarget(overId, viewDate)
    if (decoded) {
      destFields = decoded
    } else {
      const overTask = taskById[overId]
      if (overTask) destFields = { scheduled_date: overTask.scheduled_date, is_priority: overTask.is_priority }
    }
    if (!destFields) return

    const fieldsChanged = t.scheduled_date !== destFields.scheduled_date || t.is_priority !== destFields.is_priority

    // -------- Same-section reorder --------
    // Active and over are both tasks in the same section (same date + same priority).
    if (!fieldsChanged && taskById[overId]) {
      const sectionList = (t.is_priority ? tasksForViewDate.priority : tasksForViewDate.regular).slice()
      const oldIdx = sectionList.findIndex(x => x.id === activeId)
      const newIdx = sectionList.findIndex(x => x.id === overId)
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

      const reordered = arrayMove(sectionList, oldIdx, newIdx)
      const sortMap: Record<string, number> = {}
      reordered.forEach((x, i) => { sortMap[x.id] = (i + 1) * 10 })

      setTasks(ts => ts.map(x => sortMap[x.id] != null ? { ...x, sort_order: sortMap[x.id] } : x))
      reordered.forEach((x, i) => {
        const newSort = (i + 1) * 10
        if (x.sort_order !== newSort) persistTask(x.id, { sort_order: newSort })
      })
      return
    }

    // -------- Cross-section / cross-day move --------
    // Update fields and put at top of the destination section (sort_order = 0
    // means it'll appear above existing items; user can drag-reorder after).
    updateAndPersist(activeId, {
      scheduled_date: destFields.scheduled_date,
      is_priority: destFields.is_priority,
      sort_order: 0,
    })
  }

  // ---------- Render ----------
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, padding: '10px 18px', borderRadius: 8, background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: '20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.1)', flexShrink: 0, background: 'linear-gradient(180deg, #0d0d0d 0%, #0a0a0a 100%)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
          Daily <span style={{ backgroundImage: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Plan</span>
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setRecurringModalOpen(true)}
            title="Recurring tasks"
            style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', color: '#cbd5e1', height: 42, padding: '0 18px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
          >↻ Recurring</button>
        </div>
      </div>

      {/* Body */}
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          // Strict: only trigger drop indicator when cursor is INSIDE a droppable.
          // Falls back to rect-intersection (touching) only if pointer is outside everything.
          const pointerHits = pointerWithin(args)
          if (pointerHits.length > 0) return pointerHits
          return rectIntersection(args)
        }}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* Top: 7-day bucket row, navigable by week */}
          <DailyPlanTopBuckets
            weekAnchor={weekAnchor}
            taskCountsByDate={taskCountsByDate}
            onShiftWeek={(days) => setWeekAnchor(prev => addDaysISO(prev, days))}
            onResetWeek={() => setWeekAnchor(todayLocalISO())}
            onBucketClick={(iso) => setViewDate(iso)}
          />

          {/* Middle: Today block (left) + Active projects (right) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)', gap: 22, marginTop: 22 }}>
            <DailyPlanTodayBlock
              viewDate={viewDate}
              setViewDate={setViewDate}
              priorityTasks={tasksForViewDate.priority}
              regularTasks={tasksForViewDate.regular}
              doneToday={viewDate === todayLocalISO() ? doneToday : []}
              assigneesByTask={assigneesByTask}
              docById={docById}
              teamMembers={teamMembers}
              selectedTaskId={selectedTaskId}
              onTaskClick={openTaskPopover}
              onToggleDone={toggleDone}
              onTogglePriority={(id) => updateAndPersist(id, { is_priority: !taskById[id]?.is_priority })}
              onToggleAssignee={toggleAssignment}
              onOpenAddTask={() => setAddTaskModalOpen(true)}
            />

            <DailyPlanProjectsRail
              docs={docs}
              tasks={tasks}
              nextUpByDoc={nextUpByDoc}
              productionStatuses={productionStatuses}
              onProjectClick={(id) => setOpenProjectId(id)}
            />
          </div>

          {/* Bottom: calendar + task overlay */}
          <DailyPlanBottomCalendar
            tasks={tasks}
            calendarEvents={calendarEvents}
            docById={docById}
            initialDate={viewDate}
          />
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 220,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
          }}
          style={{ cursor: 'grabbing' }}
        >
          {activeDragId ? (() => {
            const t = taskById[activeDragId]
            if (!t) return null
            const linkedDoc = t.parent_document_id ? docById[t.parent_document_id] : null
            const accent = t.is_priority ? '#fb923c' : '#22d3ee'
            return (
              <div style={{
                background: 'linear-gradient(180deg, #1f1f1f 0%, #181818 100%)',
                border: `1px solid ${accent}55`,
                borderLeft: `4px solid ${accent}`,
                borderRadius: 12,
                padding: '13px 16px',
                boxShadow: `
                  0 1px 0 rgba(255,255,255,0.06) inset,
                  0 4px 12px rgba(0,0,0,0.4),
                  0 16px 40px rgba(0,0,0,0.5),
                  0 0 0 1px ${accent}22,
                  0 0 32px ${accent}26
                `,
                maxWidth: 420,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transformOrigin: 'center',
                animation: 'liftIn 180ms cubic-bezier(0.2, 0, 0, 1) both',
              }}>
                <style>{`
                  @keyframes liftIn {
                    from { transform: scale(1); }
                    to { transform: scale(1.025); }
                  }
                `}</style>
                {t.is_priority && <span style={{ fontSize: 14 }}>🔥</span>}
                <span style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, letterSpacing: -0.1 }}>
                  {t.title}
                </span>
                {linkedDoc && (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'rgba(168,85,247,0.2)', color: '#c4b5fd', fontWeight: 600, flexShrink: 0 }}>
                    {linkedDoc.vehicle_description || linkedDoc.company_name || linkedDoc.customer_name}
                  </span>
                )}
              </div>
            )
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* Popover routing — project popover for project-linked tasks; task popover for orphan tasks */}
      {popoverVisible && selectedTaskId && (() => {
        const t = taskById[selectedTaskId]
        if (!t) return null
        const linkedDoc = t.parent_document_id ? docById[t.parent_document_id] : null

        if (linkedDoc) {
          return (
            <DailyPlanProjectPopover
              ref={popoverRef}
              task={t}
              doc={linkedDoc}
              lineItems={lineItems.filter(li => li.document_id === linkedDoc.id)}
              categories={categories}
              productionStatuses={productionStatuses}
              style={popoverStyle}
              flipped={popoverFlipped}
              onClose={closePopover}
              onToggleDone={() => toggleDone(selectedTaskId)}
              onOpenProjectSidebar={() => { closePopover(); setOpenProjectId(linkedDoc.id) }}
            />
          )
        }

        // Orphan task — keep simpler task popover
        return (
          <DailyPlanTaskPopover
            ref={popoverRef}
            task={t}
            assignees={assigneesByTask[selectedTaskId] || []}
            doc={undefined}
            teamMembers={teamMembers}
            style={popoverStyle}
            flipped={popoverFlipped}
            onClose={closePopover}
            onChangeTitle={(title) => updateAndPersist(selectedTaskId, { title })}
            onChangeDescription={(description) => updateAndPersist(selectedTaskId, { description })}
            onChangeDate={(scheduled_date) => updateAndPersist(selectedTaskId, { scheduled_date })}
            onTogglePriority={() => updateAndPersist(selectedTaskId, { is_priority: !t.is_priority })}
            onToggleAssignee={(memberId) => toggleAssignment(selectedTaskId, memberId)}
            onToggleDone={() => toggleDone(selectedTaskId)}
            onDelete={() => deleteTask(selectedTaskId)}
            onOpenProject={() => {}}
          />
        )
      })()}

      {/* Project sidebar */}
      {openProjectId && docById[openProjectId] && (
        <DailyPlanProjectSidebar
          doc={docById[openProjectId]}
          allTasks={tasks}
          assigneesByTask={assigneesByTask}
          teamMembers={teamMembers}
          lineItems={lineItems.filter(li => li.document_id === openProjectId)}
          payments={payments.filter(p => p.document_id === openProjectId)}
          categories={categories}
          pipelineConfigs={pipelineConfigs}
          productionStatuses={productionStatuses}
          onClose={() => setOpenProjectId(null)}
          onCreateTask={(title) => createTaskOn(null, { title, parent_document_id: openProjectId })}
          onUpdateTask={updateAndPersist}
          onDeleteTask={deleteTask}
          onToggleAssignee={toggleAssignment}
          onToggleDone={toggleDone}
          showToast={showToast}
        />
      )}

      {/* Recurring tasks settings */}
      {recurringModalOpen && (
        <DailyPlanRecurringModal
          recurringTasks={recurringTasks}
          teamMembers={teamMembers}
          onClose={() => setRecurringModalOpen(false)}
          onChange={setRecurringTasks}
        />
      )}

      {/* Add Task modal */}
      {addTaskModalOpen && (
        <DailyPlanAddTaskModal
          defaultDate={viewDate}
          docs={docs}
          teamMembers={teamMembers}
          onClose={() => setAddTaskModalOpen(false)}
          onCreated={async (payload) => {
            const created = await createTaskOn(payload.scheduled_date, {
              title: payload.title,
              is_priority: payload.is_priority,
              parent_document_id: payload.parent_document_id || null,
            })
            if (created) {
              if (payload.description) updateAndPersist(created.id, { description: payload.description })
              for (const memberId of payload.assigneeIds) toggleAssignment(created.id, memberId)
              showToast('Task added', 'success')
            }
            setAddTaskModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
