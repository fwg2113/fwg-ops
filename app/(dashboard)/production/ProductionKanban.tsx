'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay,
  PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners,
  rectIntersection, useDroppable,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import StatusManager, { ProductionStatus } from './StatusManager'
import TaskQuickAdd from './TaskQuickAdd'
import ArchivedDocsModal from './ArchivedDocsModal'
import SortableBoardCard from './SortableBoardCard'
import DocumentSidebar from './DocumentSidebar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LineItem = {
  id: string
  document_id: string
  category: string
  line_type?: string
  description?: string
  quantity: number
  unit_price?: number
  line_total?: number
  sort_order?: number
  custom_fields?: any
  attachments?: any[]
  production_checklist?: Record<string, any>
}

type CalendarEvent = {
  id: string
  title: string
  vehicle_start: string | null
  vehicle_end: string | null
  install_start: string | null
  install_end: string | null
  status: string
  notes: string
  document_id: string
  category: string | null
}

type Attachment = {
  url?: string
  file_url?: string
  key?: string
  file_id?: string
  filename?: string
  file_name?: string
  name?: string
  label?: string
  contentType?: string
  type?: string
  mime_type?: string
  size?: number
}

type TeamMember = {
  id: string
  name: string
  short_name?: string
  color: string
  role?: string
}

type NoteEntry = {
  text: string
  author: string
  at: string
}

type ProductionDocument = {
  id: string
  doc_number: string
  doc_type: string
  status: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  company_name?: string
  total: number
  amount_paid?: number
  balance_due?: number
  in_production: boolean
  created_at: string
  due_date?: string
  production_sort_order?: number
  production_stage?: string
  production_target_date?: string
  production_stuck?: boolean
  production_stuck_reason?: string
  production_leader_id?: string
  production_photos?: { url: string; filename: string; uploadedAt: string }[]
  production_notified_at?: string
  production_status_id?: string | null
  production_status_note?: string | null
  qc_signed_off_by?: string
  qc_signed_off_at?: string
  vehicle_description?: string
  project_description?: string
  fulfillment_type?: string
  attachments?: Attachment[]
  notes?: NoteEntry[]
  line_items: LineItem[]
  calendar_events: CalendarEvent[]
}

type CategoryData = {
  category_key: string
  parent_category: string
  label: string
  calendar_color?: string
}

type BoardTask = {
  id: string
  title: string
  description?: string | null
  production_stage?: string
  production_sort_order?: number
  production_status_id?: string | null
  production_status_note?: string | null
  due_date?: string | null
  leader_id?: string | null
  archived: boolean
  archived_at?: string | null
  task_completed_at?: string | null
  mockups?: { url: string; filename: string; uploadedAt: string }[]
  notes_log?: { text: string; author: string; at: string }[]
  calendar_event_id?: string | null
  created_at?: string
}

type TaskAssignment = { task_id: string; team_member_id: string }
type CalendarEventLite = { id: string; title: string; start_time: string; customer_name?: string | null; document_id?: string | null; task_id?: string | null }

// Unified board item — either a document or a manual task
type BoardItem =
  | { kind: 'doc'; id: string; sort: number; doc: ProductionDocument }
  | { kind: 'task'; id: string; sort: number; task: BoardTask }

const itemKey = (item: BoardItem) => `${item.kind}:${item.id}`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGES = [
  { key: 'QUEUE', label: 'Queue', color: '#64748b', dotColor: '#94a3b8', subtitle: 'Awaiting payment, approval, or kickoff' },
  { key: 'DESIGN', label: 'Design', color: '#a855f7', dotColor: '#a855f7', subtitle: 'Designing & building print files' },
  { key: 'PRINT', label: 'Print', color: '#3b82f6', dotColor: '#3b82f6', subtitle: 'Printing & reprinting' },
  { key: 'PRODUCTION', label: 'Production', color: '#14b8a6', dotColor: '#14b8a6', subtitle: 'Laminating, cutting, weeding, masking' },
  { key: 'COMPLETE', label: 'Complete', color: '#22c55e', dotColor: '#22c55e', subtitle: 'Finished & ready to archive' },
] as const

const CONFIGURABLE_STAGES = ['QUEUE', 'DESIGN', 'PRINT', 'PRODUCTION'] as const

type StageKey = typeof STAGES[number]['key']

const COMPLETED_STATUSES = ['completed', 'shipped', 'picked_up']

const NOTE_AUTHORS = ['Joe', 'Joey', 'Sharyn', 'Diogo', 'Mason', 'Sydney', 'Jay']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDuePill(dueDate: string | undefined): { text: string; bg: string; color: string; className: string } | null {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (daysLeft < 0) return { text: `${Math.abs(daysLeft)}d overdue`, bg: '#5c1212', color: '#f87171', className: 'overdue' }
  if (daysLeft === 0) return { text: 'Due today', bg: '#5c3d12', color: '#fbbf24', className: 'today' }
  if (daysLeft <= 3) return { text: `${daysLeft}d left`, bg: '#5c3d12', color: '#fbbf24', className: 'soon' }
  return { text: `${formatDate(dueDate)}`, bg: '#16533a', color: '#4ade80', className: 'ok' }
}

function getCategoryColor(category: string, catMap: Record<string, CategoryData>): string {
  const cat = catMap[category]
  if (!cat) return '#fb923c'
  if (cat.parent_category === 'AUTOMOTIVE') return '#a855f7'
  if (cat.parent_category === 'SIGNAGE') return '#14b8a6'
  return '#fb923c'
}

function getDocCategoryColor(doc: ProductionDocument, catMap: Record<string, CategoryData>): string {
  for (const li of doc.line_items) {
    const c = getCategoryColor(li.category, catMap)
    if (c !== '#fb923c') return c
  }
  return '#fb923c'
}

function getAttUrl(a: Attachment) { return a.url || a.file_url || '' }
function getAttName(a: Attachment) { return a.label || a.name || a.filename || a.file_name || 'File' }
function isImage(a: Attachment) {
  const url = getAttUrl(a)
  const name = getAttName(a)
  const ct = a.contentType || a.type || a.mime_type || ''
  return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
}

function getNextStage(current: StageKey): StageKey | null {
  const idx = STAGES.findIndex(s => s.key === current)
  if (idx === -1 || idx >= STAGES.length - 1) return null
  return STAGES[idx + 1].key
}

function getStageLabel(key: string): string {
  return STAGES.find(s => s.key === key)?.label || key
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ProductionAssignment = { document_id: string; team_member_id: string }

export default function ProductionKanban({
  documents,
  categoriesData,
  teamMembers,
  initialAssignments,
  initialStatuses,
  initialTasks,
  initialTaskAssignments,
  allCalendarEvents,
}: {
  documents: ProductionDocument[]
  categoriesData: CategoryData[]
  teamMembers: TeamMember[]
  initialAssignments: ProductionAssignment[]
  initialStatuses: ProductionStatus[]
  initialTasks: BoardTask[]
  initialTaskAssignments: TaskAssignment[]
  allCalendarEvents: CalendarEventLite[]
}) {
  const [docs, setDocs] = useState(documents)
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks)
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>(initialTaskAssignments)
  const [assignments, setAssignments] = useState<ProductionAssignment[]>(initialAssignments)
  const [statuses, setStatuses] = useState<ProductionStatus[]>(initialStatuses)
  const [statusManagerOpen, setStatusManagerOpen] = useState(false)
  const [statusNoteModal, setStatusNoteModal] = useState<{ docId?: string; taskId?: string; status: ProductionStatus; note: string } | null>(null)
  const [statusDropdownDocId, setStatusDropdownDocId] = useState<string | null>(null)
  const [statusDropdownTaskId, setStatusDropdownTaskId] = useState<string | null>(null)
  const [statusDropdownRect, setStatusDropdownRect] = useState<{ top: number; left: number; width: number; flipUp: boolean } | null>(null)
  const [installCollapsed, setInstallCollapsed] = useState(true)
  const [wasteReportFor, setWasteReportFor] = useState<{ docId: string } | null>(null)
  const [taskQuickAddOpen, setTaskQuickAddOpen] = useState<{ open: boolean; defaultStage?: string }>({ open: false })
  const [archivedModalOpen, setArchivedModalOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [sidebarDocId, setSidebarDocId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  // Note: stuckModalOpen/stuckReason removed in favor of statusNoteModal (new status system)
  const [completeModalDocId, setCompleteModalDocId] = useState<string | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: { url: string; label: string }[]; index: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [dragState, setDragState] = useState<{ dragId: string | null; overId: string | null; position: 'above' | 'below' | null }>({ dragId: null, overId: null, position: null })
  const popoverRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const catMap = useMemo(() => {
    const m: Record<string, CategoryData> = {}
    for (const c of categoriesData) m[c.category_key] = c
    return m
  }, [categoriesData])

  // Group docs + tasks into unified board items per stage
  const columns = useMemo(() => {
    const map: Record<string, BoardItem[]> = {}
    for (const s of STAGES) map[s.key] = []

    for (const d of docs) {
      const stage = d.production_stage || 'QUEUE'
      ;(map[stage] || map['QUEUE']).push({ kind: 'doc', id: d.id, sort: d.production_sort_order || 0, doc: d })
    }
    for (const t of tasks) {
      const stage = t.production_stage || 'QUEUE'
      ;(map[stage] || map['QUEUE']).push({ kind: 'task', id: t.id, sort: t.production_sort_order || 0, task: t })
    }

    // Sort each column by sort_order
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort - b.sort)
    }
    return map
  }, [docs, tasks])

  const getAssignmentsForDoc = (docId: string) => {
    return assignments
      .filter(a => a.document_id === docId)
      .map(a => teamMembers.find(tm => tm.id === a.team_member_id))
      .filter(Boolean) as TeamMember[]
  }

  const toggleAssignment = async (docId: string, memberId: string) => {
    const exists = assignments.some(a => a.document_id === docId && a.team_member_id === memberId)
    if (exists) {
      setAssignments(prev => prev.filter(a => !(a.document_id === docId && a.team_member_id === memberId)))
      fetch(`/api/documents/${docId}/assignments`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId }),
      }).catch(() => {})
    } else {
      setAssignments(prev => [...prev, { document_id: docId, team_member_id: memberId }])
      fetch(`/api/documents/${docId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId }),
      }).catch(() => {})
    }
  }

  const setDetailHolder = async (docId: string, memberId: string | null) => {
    setDocs(ds => ds.map(d => d.id === docId ? { ...d, production_leader_id: memberId || undefined } : d))
    fetch(`/api/documents/${docId}/production-status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_leader_id: memberId }),
    }).catch(() => {})
  }

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ----- Status helpers -----
  const statusesByStage = useMemo(() => {
    const m: Record<string, ProductionStatus[]> = {}
    for (const s of statuses) {
      if (!s.active) continue
      if (!m[s.stage_key]) m[s.stage_key] = []
      m[s.stage_key].push(s)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.sort_order - b.sort_order)
    return m
  }, [statuses])

  const getStatusById = (id?: string | null) => id ? statuses.find(s => s.id === id) : undefined
  const getDefaultStatusForStage = (stage: string) => {
    return (statusesByStage[stage] || []).find(s => s.is_default_on_entry) || null
  }

  // Apply a new status to a doc, with note + special action handling.
  // If the status requires a note and no note is supplied, opens the note modal.
  const applyStatusToDoc = async (docId: string, status: ProductionStatus, note?: string, opts?: { skipSpecial?: boolean }) => {
    if (status.requires_note && !note) {
      // Open note modal — note will come back via separate flow
      setStatusNoteModal({ docId, status, note: '' })
      setStatusDropdownDocId(null)
      return
    }

    setDocs(ds => ds.map(d => d.id === docId ? {
      ...d,
      production_status_id: status.id,
      production_status_note: note ?? null,
    } : d))
    setStatusDropdownDocId(null)

    fetch(`/api/documents/${docId}/production-status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        production_status_id: status.id,
        production_status_note: note ?? null,
      }),
    }).catch(() => {})

    // Special actions
    if (!opts?.skipSpecial) {
      if (status.special_action === 'WASTE_REPORT') {
        setWasteReportFor({ docId })
      }
      // COLLAPSE_INSTALL just changes how the column renders — no extra action
    }
  }

  // Move document to next stage
  const moveToStage = async (docId: string, newStage: StageKey) => {
    // If moving to COMPLETE, show the notification prompt
    if (newStage === 'COMPLETE') {
      setCompleteModalDocId(docId)
      return
    }
    await doMoveToStage(docId, newStage)
  }

  const doMoveToStage = async (docId: string, newStage: StageKey) => {
    const prev = docs.find(d => d.id === docId)
    if (!prev) return

    // If entering a configurable stage, apply the column's default-on-entry status
    let defaultStatusId: string | null = null
    if (CONFIGURABLE_STAGES.includes(newStage as any)) {
      const def = getDefaultStatusForStage(newStage)
      if (def) defaultStatusId = def.id
    }

    setDocs(ds => ds.map(d => d.id === docId ? {
      ...d,
      production_stage: newStage,
      production_status_id: defaultStatusId,
      production_status_note: null,
    } : d))

    const updates: Record<string, any> = {
      production_stage: newStage,
      production_status_id: defaultStatusId,
      production_status_note: null,
    }
    if (newStage === 'COMPLETE') updates.in_production = false

    try {
      const res = await fetch(`/api/documents/${docId}/production-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        setDocs(ds => ds.map(d => d.id === docId ? prev : d))
        showToast('Failed to move job', 'error')
      }
    } catch {
      setDocs(ds => ds.map(d => d.id === docId ? prev : d))
      showToast('Network error', 'error')
    }
  }

  // ---------- dnd-kit drag/drop ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // Find which item is being dragged
  const findItem = (id: string): BoardItem | null => {
    if (id.startsWith('doc:')) {
      const docId = id.slice(4)
      const doc = docs.find(d => d.id === docId)
      return doc ? { kind: 'doc', id: docId, sort: doc.production_sort_order || 0, doc } : null
    }
    if (id.startsWith('task:')) {
      const taskId = id.slice(5)
      const t = tasks.find(x => x.id === taskId)
      return t ? { kind: 'task', id: taskId, sort: t.production_sort_order || 0, task: t } : null
    }
    return null
  }

  // Resolve a droppable id to a stage key. Droppable can be 'col:STAGE' or an item id (means same stage as item).
  const resolveStage = (overId: string): string | null => {
    if (overId.startsWith('col:')) return overId.slice(4)
    const item = findItem(overId)
    if (item?.kind === 'doc') return item.doc.production_stage || 'QUEUE'
    if (item?.kind === 'task') return item.task.production_stage || 'QUEUE'
    return null
  }

  // Track the original column when drag starts so we can revert on cancel
  const dragOriginRef = useRef<{ fromStage: string; activeId: string } | null>(null)

  const onDndStart = (e: DragStartEvent) => {
    const activeId = String(e.active.id)
    setActiveDragId(activeId)
    setStatusDropdownDocId(null)
    setStatusDropdownTaskId(null)
    const item = findItem(activeId)
    if (item) {
      const fromStage = item.kind === 'doc' ? (item.doc.production_stage || 'QUEUE') : (item.task.production_stage || 'QUEUE')
      dragOriginRef.current = { fromStage, activeId }
    }
  }

  // While dragging across columns, immediately move the item to the new column
  // in local state — this gives dnd-kit's SortableContext the visual feedback to
  // shift items and the dashed-gap indicator to land where the drop will commit.
  const onDndOver = (e: DragOverEvent) => {
    if (!e.over) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    if (activeId === overId) return

    const item = findItem(activeId)
    if (!item) return

    const fromStage = item.kind === 'doc' ? (item.doc.production_stage || 'QUEUE') : (item.task.production_stage || 'QUEUE')
    const toStage = resolveStage(overId)
    if (!toStage || toStage === fromStage) return
    if (!STAGES.find(s => s.key === toStage)) return

    // Move active item into the destination column locally (no DB write yet)
    if (item.kind === 'doc') {
      setDocs(ds => ds.map(d => d.id === item.id ? { ...d, production_stage: toStage } : d))
    } else {
      setTasks(ts => ts.map(t => t.id === item.id ? { ...t, production_stage: toStage } : t))
    }
  }

  const onDndEnd = async (e: DragEndEvent) => {
    const activeId = String(e.active.id)
    setActiveDragId(null)

    const origin = dragOriginRef.current
    dragOriginRef.current = null

    if (!e.over) return
    const overId = String(e.over.id)

    const item = findItem(activeId)
    if (!item) return

    const finalStage = item.kind === 'doc' ? (item.doc.production_stage || 'QUEUE') : (item.task.production_stage || 'QUEUE')
    const fromStage = origin?.fromStage || finalStage
    const isCrossColumn = fromStage !== finalStage

    // If a doc was dragged into COMPLETE — show the notify modal AND defer commit.
    // Roll back the optimistic stage change that onDndOver applied.
    if (isCrossColumn && finalStage === 'COMPLETE' && item.kind === 'doc') {
      setDocs(ds => ds.map(d => d.id === item.id ? { ...d, production_stage: fromStage } : d))
      setCompleteModalDocId(item.id)
      return
    }

    // Compute final ordering: where in finalStage the active item should land
    const colItems = (columns[finalStage] || [])
    const oldIdx = colItems.findIndex(it => itemKey(it) === activeId)
    let newIdx = colItems.length - 1
    if (!overId.startsWith('col:')) {
      const idx = colItems.findIndex(it => itemKey(it) === overId)
      if (idx !== -1) newIdx = idx
    }

    let reordered = colItems
    if (oldIdx !== -1 && oldIdx !== newIdx) {
      reordered = arrayMove(colItems, oldIdx, newIdx)
    }

    // Recompute sort_order for the destination column
    const sortMap: Record<string, number> = {}
    reordered.forEach((it, i) => { sortMap[itemKey(it)] = i + 1 })

    // Apply default-on-entry status when crossing into a configurable stage
    let defaultStatusId: string | null = null
    if (isCrossColumn && CONFIGURABLE_STAGES.includes(finalStage as any)) {
      const def = getDefaultStatusForStage(finalStage)
      if (def) defaultStatusId = def.id
    }

    // Commit optimistic state — update sort orders + status (if cross-column)
    if (item.kind === 'doc') {
      setDocs(ds => ds.map(d => {
        const k = `doc:${d.id}`
        if (sortMap[k] != null) {
          if (d.id === item.id) {
            return {
              ...d,
              production_sort_order: sortMap[k],
              ...(isCrossColumn ? { production_status_id: defaultStatusId, production_status_note: null } : {}),
            }
          }
          return { ...d, production_sort_order: sortMap[k] }
        }
        return d
      }))
      const updates: Record<string, any> = {
        production_stage: finalStage,
        production_sort_order: sortMap[activeId],
      }
      if (isCrossColumn) {
        updates.production_status_id = defaultStatusId
        updates.production_status_note = null
        if (fromStage === 'COMPLETE' && finalStage !== 'COMPLETE') updates.in_production = true
        if (finalStage === 'COMPLETE') updates.in_production = false
      }
      fetch(`/api/documents/${item.id}/production-status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(() => {})
    } else {
      setTasks(ts => ts.map(t => {
        const k = `task:${t.id}`
        if (sortMap[k] != null) {
          if (t.id === item.id) {
            return {
              ...t,
              production_sort_order: sortMap[k],
              ...(isCrossColumn ? {
                production_status_id: defaultStatusId,
                production_status_note: null,
                ...(finalStage === 'COMPLETE' && !t.task_completed_at ? { task_completed_at: new Date().toISOString() } : {}),
              } : {}),
            }
          }
          return { ...t, production_sort_order: sortMap[k] }
        }
        return t
      }))
      const updates: Record<string, any> = {
        production_stage: finalStage,
        production_sort_order: sortMap[activeId],
      }
      if (isCrossColumn) {
        updates.production_status_id = defaultStatusId
        updates.production_status_note = null
      }
      fetch(`/api/production-tasks/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(() => {})
    }

    // Persist sort_order for the OTHER items in the destination column
    for (const it of reordered) {
      if (itemKey(it) === activeId) continue
      const newSort = sortMap[itemKey(it)]
      if (it.kind === 'doc') {
        if ((it.doc.production_sort_order || 0) === newSort) continue
        fetch(`/api/documents/${it.id}/production-status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ production_sort_order: newSort }),
        }).catch(() => {})
      } else {
        if ((it.task.production_sort_order || 0) === newSort) continue
        fetch(`/api/production-tasks/${it.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ production_sort_order: newSort }),
        }).catch(() => {})
      }
    }
  }

  // ---------- Document archive (production board only) ----------
  const archiveDocCard = async (docId: string) => {
    setDocs(ds => ds.filter(d => d.id !== docId))
    fetch(`/api/documents/${docId}/archive-production`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    }).catch(() => {})
    closePopover()
    showToast('Card archived', 'success')
  }

  const restoreDocCard = (docId: string) => {
    // Refresh — easiest is reload, but we can also re-fetch the doc
    fetch(`/api/documents/${docId}`).then(r => r.json()).then(d => {
      if (d?.id) setDocs(ds => [d, ...ds.filter(x => x.id !== d.id)])
    }).catch(() => {})
  }

  // ---------- Manual task helpers ----------
  const handleTaskCreated = (newTask: BoardTask) => {
    setTasks(ts => [...ts, newTask])
  }

  const archiveTaskCard = async (taskId: string) => {
    setTasks(ts => ts.filter(t => t.id !== taskId))
    fetch(`/api/production-tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    }).catch(() => {})
    if (openTaskId === taskId) setOpenTaskId(null)
    showToast('Task archived', 'success')
  }

  const applyStatusToTask = async (taskId: string, status: ProductionStatus, note?: string) => {
    if (status.requires_note && !note) {
      setStatusNoteModal({ taskId, status, note: '' })
      setStatusDropdownTaskId(null)
      return
    }
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, production_status_id: status.id, production_status_note: note ?? null } : t))
    setStatusDropdownTaskId(null)
    fetch(`/api/production-tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_status_id: status.id, production_status_note: note ?? null }),
    }).catch(() => {})
    if (status.special_action === 'WASTE_REPORT') {
      // Tasks aren't tied to docs but we still want to surface the waste reporter
      window.open('/waste-reporter', '_blank')
    }
  }

  // Popover positioning — handles both doc and task cards
  const openPopover = useCallback((id: string, cardEl: HTMLElement, kind: 'doc' | 'task' = 'doc') => {
    const rect = cardEl.getBoundingClientRect()
    const popW = 400
    const popMaxH = 520
    const gap = 8

    let left = rect.right + gap
    let isFlipped = false

    // Flip to left if off-screen
    if (left + popW > window.innerWidth - 16) {
      left = rect.left - popW - gap
      isFlipped = true
    }

    let top = rect.top
    // Clamp to viewport
    if (top + popMaxH > window.innerHeight - 16) {
      top = window.innerHeight - popMaxH - 16
    }
    if (top < 16) top = 16

    setFlipped(isFlipped)
    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width: popW,
      maxHeight: popMaxH,
    })
    if (kind === 'doc') {
      setSelectedId(id)
      setOpenTaskId(null)
    } else {
      setOpenTaskId(id)
      setSelectedId(null)
    }
    setPopoverVisible(true)
    setAssignModalOpen(false)
  }, [])

  const closePopover = () => {
    setPopoverVisible(false)
    setSelectedId(null)
    setOpenTaskId(null)
    setAssignModalOpen(false)
  }

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Close status dropdown when clicking outside it
      if ((statusDropdownDocId || statusDropdownTaskId) && !target.closest('.status-dropdown') && !target.closest('.status-pill')) {
        setStatusDropdownDocId(null)
        setStatusDropdownTaskId(null)
        setStatusDropdownRect(null)
      }

      if (!popoverVisible) return
      if (popoverRef.current?.contains(target)) return
      if (target.closest('[data-card-id]')) return
      // Don't close popover if clicking inside a modal overlay or the lightbox
      if (target.closest('[data-modal]')) return
      if (target.closest('[data-lightbox]')) return
      if (target.closest('.status-dropdown')) return
      closePopover()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null)
        else if (statusDropdownDocId || statusDropdownTaskId) { setStatusDropdownDocId(null); setStatusDropdownTaskId(null); setStatusDropdownRect(null) }
        else closePopover()
      }
    }
    const scrollHandler = () => {
      // Close dropdown on any scroll — the absolute coords go stale
      if (statusDropdownDocId || statusDropdownTaskId) { setStatusDropdownDocId(null); setStatusDropdownTaskId(null); setStatusDropdownRect(null) }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('scroll', scrollHandler, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('scroll', scrollHandler, true)
    }
  }, [popoverVisible, lightbox, statusDropdownDocId, statusDropdownTaskId])

  const selectedDoc = docs.find(d => d.id === selectedId)

  // Collect all images across line items + doc level for popover
  const getAllImages = (doc: ProductionDocument) => {
    const imgs: { url: string; label: string }[] = []
    for (const li of doc.line_items) {
      for (const att of (li.attachments || []) as Attachment[]) {
        if (isImage(att) && getAttUrl(att)) {
          imgs.push({ url: getAttUrl(att), label: getAttName(att) })
        }
      }
    }
    for (const att of (doc.attachments || []) as Attachment[]) {
      if (isImage(att) && getAttUrl(att)) {
        imgs.push({ url: getAttUrl(att), label: getAttName(att) })
      }
    }
    return imgs
  }

  const getAllFiles = (doc: ProductionDocument) => {
    const files: Attachment[] = []
    for (const li of doc.line_items) {
      for (const att of (li.attachments || []) as Attachment[]) {
        if (!isImage(att) && getAttUrl(att)) files.push(att)
      }
    }
    for (const att of (doc.attachments || []) as Attachment[]) {
      if (!isImage(att) && getAttUrl(att)) files.push(att)
    }
    return files
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, padding: '10px 18px', borderRadius: 8, background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <h1 style={{ fontSize: 25, fontWeight: 700, color: '#fff', margin: 0 }}>
            FWG <span style={{ backgroundImage: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Production</span>
          </h1>
          {/* + Task */}
          <button
            onClick={() => setTaskQuickAddOpen({ open: true })}
            title="Add task"
            style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee', height: 40, padding: '0 15px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}
          >+ Task</button>
          {/* Manage statuses gear */}
          <button
            onClick={() => setStatusManagerOpen(true)}
            title="Manage statuses"
            style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8', width: 40, height: 40, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>

      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDndStart} onDragOver={onDndOver} onDragEnd={onDndEnd}>
        <div ref={boardRef} style={{ display: 'flex', gap: 18, padding: '20px 24px', flex: 1, overflow: 'auto' }}>
          {STAGES.map(stage => {
            const items = columns[stage.key] || []
            const visibleItems = items.filter(it => {
              if (it.kind !== 'doc') return true
              const cur = getStatusById(it.doc.production_status_id)
              return !(cur?.special_action === 'COLLAPSE_INSTALL' && installCollapsed)
            })
            const installDocs = stage.key === 'PRODUCTION'
              ? items.filter(it => it.kind === 'doc' && getStatusById(it.doc.production_status_id)?.special_action === 'COLLAPSE_INSTALL')
              : []

            return (
              <DroppableColumn key={stage.key} stageKey={stage.key} isComplete={stage.key === 'COMPLETE'}>
                {/* Column header — centered, with subtitle */}
                <div style={{
                  padding: '18px 16px 14px', borderBottom: '1px solid rgba(148,163,184,0.08)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: stage.dotColor, display: 'inline-block' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#cbd5e1' }}>{stage.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 1.35, fontWeight: 500 }}>
                    {stage.subtitle}
                  </div>
                  {stage.key === 'COMPLETE' && (
                    <button
                      onClick={() => setArchivedModalOpen(true)}
                      title="View archived"
                      style={{ position: 'absolute', top: 14, right: 12, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', color: '#94a3b8', padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                    >Archived</button>
                  )}
                </div>

                {/* Cards droppable */}
                <ColumnDroppableArea stageKey={stage.key} hasItems={visibleItems.length > 0}>
                  <SortableContext items={visibleItems.map(itemKey)} strategy={verticalListSortingStrategy}>
                    {visibleItems.map(item => {
                      const sortableId = itemKey(item)
                      if (item.kind === 'doc') {
                        const doc = item.doc
                        const stageStatuses = statusesByStage[stage.key] || []
                        const status = getStatusById(doc.production_status_id) || null
                        const docAssignees = getAssignmentsForDoc(doc.id)
                        const docLeader = teamMembers.find(tm => tm.id === doc.production_leader_id) || null
                        return (
                          <SortableBoardCard
                            key={sortableId}
                            sortableId={sortableId}
                            itemKind="doc"
                            itemId={doc.id}
                            doc={doc as any}
                            isSelected={selectedId === doc.id}
                            onClickCard={(card) => { if (selectedId === doc.id) { closePopover(); return } openPopover(doc.id, card) }}
                            status={status}
                            stageStatuses={stageStatuses}
                            showStatusPill={CONFIGURABLE_STAGES.includes(stage.key as any)}
                            onOpenStatusDropdown={(rect) => {
                              const dropdownH = Math.min((stageStatuses.length + 1) * 36 + 16, 360)
                              const flipUp = rect.bottom + dropdownH > window.innerHeight - 20
                              setStatusDropdownTaskId(null)
                              setStatusDropdownDocId(doc.id)
                              setStatusDropdownRect({ top: rect.top, left: rect.left, width: rect.width, flipUp })
                            }}
                            isComplete={stage.key === 'COMPLETE'}
                            onArchive={() => archiveDocCard(doc.id)}
                            catMap={catMap}
                            teamMembers={teamMembers}
                            docAssignees={docAssignees}
                            docLeader={docLeader}
                          />
                        )
                      }
                      // Task card
                      const task = item.task
                      const stageStatuses = statusesByStage[stage.key] || []
                      const status = getStatusById(task.production_status_id) || null
                      const taskAssigneeIds = taskAssignments.filter(a => a.task_id === task.id).map(a => a.team_member_id)
                      const taskAssignees = taskAssigneeIds.map(id => teamMembers.find(tm => tm.id === id)).filter(Boolean) as TeamMember[]
                      const taskLeader = task.leader_id ? teamMembers.find(tm => tm.id === task.leader_id) || null : null
                      return (
                        <SortableBoardCard
                          key={sortableId}
                          sortableId={sortableId}
                          itemKind="task"
                          itemId={task.id}
                          task={task as any}
                          isSelected={openTaskId === task.id}
                          onClickCard={(card) => { if (openTaskId === task.id) { closePopover(); return } openPopover(task.id, card, 'task') }}
                          status={status}
                          stageStatuses={stageStatuses}
                          showStatusPill={CONFIGURABLE_STAGES.includes(stage.key as any)}
                          onOpenStatusDropdown={(rect) => {
                            const dropdownH = Math.min((stageStatuses.length + 1) * 36 + 16, 360)
                            const flipUp = rect.bottom + dropdownH > window.innerHeight - 20
                            setStatusDropdownDocId(null)
                            setStatusDropdownTaskId(task.id)
                            setStatusDropdownRect({ top: rect.top, left: rect.left, width: rect.width, flipUp })
                          }}
                          isComplete={stage.key === 'COMPLETE'}
                          onArchive={() => archiveTaskCard(task.id)}
                          taskAssignees={taskAssignees}
                          taskLeader={taskLeader}
                        />
                      )
                    })}
                  </SortableContext>

                  {/* Install strip */}
                  {stage.key === 'PRODUCTION' && installDocs.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 8 }}>
                      <button
                        onClick={() => setInstallCollapsed(c => !c)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6,
                          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
                          color: '#c4b5fd', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a855f7' }} />
                          In Installation ({installDocs.length})
                        </span>
                        <span style={{ fontSize: 10 }}>{installCollapsed ? '▾' : '▴'}</span>
                      </button>
                      {!installCollapsed && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {installDocs.map(it => {
                            const d = (it as any).doc
                            return (
                              <div
                                key={d.id}
                                data-card-id={d.id}
                                onClick={e => { const card = e.currentTarget; if (selectedId === d.id) { closePopover(); return } openPopover(d.id, card) }}
                                style={{ padding: '6px 10px', borderRadius: 6, background: '#1a1a1a', cursor: 'pointer', fontSize: 12, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.customer_name}</span>
                                <span style={{ fontSize: 10, color: '#64748b' }}>{d.doc_number}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {visibleItems.length === 0 && (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#475569', fontSize: 12 }}>
                      {items.length === 0 ? 'Drop here' : 'All in installation'}
                    </div>
                  )}
                </ColumnDroppableArea>
              </DroppableColumn>
            )
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragId ? (() => {
            const it = findItem(activeDragId)
            if (!it) return null
            return (
              <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.6)', borderLeft: `4px solid ${it.kind === 'doc' ? '#22d3ee' : '#94a3b8'}`, opacity: 0.95, cursor: 'grabbing' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                  {it.kind === 'doc' ? it.doc.doc_number : 'TASK'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {it.kind === 'doc' ? it.doc.customer_name : it.task.title}
                </div>
              </div>
            )
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* ============================================================= */}
      {/* POPOVER — Apple Reminders style, anchored to clicked card      */}
      {/* ============================================================= */}
      {popoverVisible && selectedDoc && (
        <div
          ref={popoverRef}
          style={{
            ...popoverStyle,
            background: '#111111',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 900,
            overflowY: 'auto',
            transformOrigin: flipped ? 'right top' : 'left top',
            animation: 'popIn 0.18s ease-out',
          }}
        >
          <style>{`@keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

          {/* Color bar */}
          <div style={{ height: 3, borderRadius: '12px 12px 0 0', background: getDocCategoryColor(selectedDoc, catMap) }} />

          <div style={{ padding: '14px 16px' }}>
            {/* Header — vehicle/subject foreground, company mid, customer back */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 2, lineHeight: 1.25 }}>
                  {selectedDoc.vehicle_description || selectedDoc.project_description || '—'}
                </div>
                {selectedDoc.company_name ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 1 }}>{selectedDoc.company_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{selectedDoc.customer_name}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>{selectedDoc.customer_name}</div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 600 }}>{selectedDoc.doc_number}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: selectedDoc.balance_due && selectedDoc.balance_due > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: selectedDoc.balance_due && selectedDoc.balance_due > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                    {selectedDoc.balance_due && selectedDoc.balance_due > 0 ? `$${Number(selectedDoc.balance_due).toFixed(0)} due` : 'PAID'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setSidebarDocId(selectedDoc.id)}
                  title="Open quote/invoice editor"
                  style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', height: 28, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >Open editor →</button>
                {selectedDoc.production_stage === 'COMPLETE' && (
                  <button
                    onClick={() => archiveDocCard(selectedDoc.id)}
                    title="Archive this card (invoice stays untouched)"
                    className="archive-btn"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', height: 28, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                  >Archive</button>
                )}
                <button onClick={closePopover} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: 16, width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>

            {/* Invoice due date */}
            {selectedDoc.due_date && (() => {
              const pill = getDuePill(selectedDoc.due_date)
              return pill ? (
                <div style={{ fontSize: 12, fontWeight: 600, color: pill.color, marginBottom: 6 }}>
                  Invoice Due: {formatDate(selectedDoc.due_date)} — {pill.text}
                </div>
              ) : null
            })()}

            {/* Target finish date + Stuck button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11 }}>🎯</span>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Finish by:</span>
                <input
                  type="date"
                  value={selectedDoc.production_target_date || ''}
                  onChange={async e => {
                    const val = e.target.value || null
                    setDocs(ds => ds.map(d => d.id === selectedDoc.id ? { ...d, production_target_date: val || undefined } : d))
                    await fetch(`/api/documents/${selectedDoc.id}/production-status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ production_target_date: val }),
                    })
                  }}
                  style={{ padding: '4px 8px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#f1f5f9', fontSize: 12, outline: 'none' }}
                />
              </div>
              {(() => {
                const stage = selectedDoc.production_stage || 'QUEUE'
                if (!CONFIGURABLE_STAGES.includes(stage as any)) return null
                const stageStatuses = statusesByStage[stage] || []
                if (stageStatuses.length === 0) return null
                const cur = getStatusById(selectedDoc.production_status_id)
                return (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setStatusDropdownDocId(prev => prev === selectedDoc.id ? null : selectedDoc.id)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: cur ? `${cur.color}22` : 'rgba(148,163,184,0.1)',
                        border: `1px solid ${cur ? `${cur.color}55` : 'rgba(148,163,184,0.2)'}`,
                        color: cur ? cur.color : '#94a3b8',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cur?.color || '#94a3b8' }} />
                      {cur?.label || 'Set status'}
                      <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
                    </button>
                    {statusDropdownDocId === selectedDoc.id && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 950, minWidth: 200, overflow: 'hidden' }}>
                        {stageStatuses.map(s => (
                          <button
                            key={s.id}
                            onClick={() => applyStatusToDoc(selectedDoc.id, s)}
                            style={{ width: '100%', padding: '8px 10px', textAlign: 'left', background: cur?.id === s.id ? `${s.color}18` : 'transparent', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${s.color}28` }}
                            onMouseLeave={e => { e.currentTarget.style.background = cur?.id === s.id ? `${s.color}18` : 'transparent' }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{s.label}</span>
                            {s.requires_note && <span style={{ fontSize: 9, color: '#64748b' }}>note</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Quick info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14, fontSize: 12 }}>
              {selectedDoc.customer_phone && (
                <a href={`tel:${selectedDoc.customer_phone}`} style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {selectedDoc.customer_phone}
                </a>
              )}
              {selectedDoc.customer_email && (
                <a href={`mailto:${selectedDoc.customer_email}`} style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,7 12,13 2,7" /></svg>
                  {selectedDoc.customer_email}
                </a>
              )}
            </div>

            {/* Show secondary description only if vehicle AND project both set (vehicle is in header) */}
            {selectedDoc.vehicle_description && selectedDoc.project_description && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{selectedDoc.project_description}</div>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 12px' }} />

            {/* Financials */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 12 }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Total</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>${Number(selectedDoc.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Paid</div>
                <div style={{ color: '#22c55e', fontWeight: 600 }}>${Number(selectedDoc.amount_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Balance</div>
                <div style={{ color: (selectedDoc.balance_due || 0) > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                  {(selectedDoc.balance_due || 0) > 0
                    ? `$${Number(selectedDoc.balance_due).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : 'PAID'}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 12px' }} />

            {/* Line items */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8 }}>Line Items</div>
              {selectedDoc.line_items.map(li => {
                const badge = catMap[li.category]
                const badgeLabel = badge?.label || li.category?.replace(/_/g, ' ') || '—'
                const badgeColor = getCategoryColor(li.category, catMap)
                return (
                  <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${badgeColor}18`, color: badgeColor, fontWeight: 600, flexShrink: 0 }}>{badgeLabel}</span>
                      {li.quantity > 1 && <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>×{li.quantity}</span>}
                      <span style={{ fontSize: 12, color: '#c8cdd8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.description || '—'}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>
                      {li.line_total != null ? `$${Number(li.line_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Mockups — full width */}
            {(() => {
              const imgs = getAllImages(selectedDoc)
              if (imgs.length === 0) return null
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8 }}>Mockups</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {imgs.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setLightbox({ images: imgs, index: i })}
                        style={{
                          width: '100%', borderRadius: 8, overflow: 'hidden',
                          border: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#22d3ee' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)' }}
                      >
                        <img src={img.url} alt={img.label} style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Project files */}
            {(() => {
              const files = getAllFiles(selectedDoc)
              if (files.length === 0) return null
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8 }}>Files</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {files.map((f, i) => (
                      <a
                        key={i}
                        href={getAttUrl(f)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 6,
                          background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.1)',
                          color: '#94a3b8', fontSize: 11, textDecoration: 'none', fontWeight: 500,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#22d3ee' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        {getAttName(f)}
                      </a>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Status note display */}
            {selectedDoc.production_status_note && (() => {
              const cur = getStatusById(selectedDoc.production_status_id)
              return (
                <div style={{ marginBottom: 14, padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize: 10, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>⚑ {cur?.label || 'Status note'}</div>
                  <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>{selectedDoc.production_status_note}</div>
                </div>
              )
            })()}

            {/* Team assignments display + assign button */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Team</div>
                <button
                  onClick={() => setAssignModalOpen(true)}
                  style={{ padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.08)' }}
                >Assign</button>
              </div>
              {(() => {
                const assigned = getAssignmentsForDoc(selectedDoc.id)
                const leader = teamMembers.find(tm => tm.id === selectedDoc.production_leader_id)
                if (!assigned.length && !leader) return <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No one assigned</div>
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {leader && (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: `${leader.color}20`, color: leader.color, fontWeight: 700, border: `1px solid ${leader.color}40`, display: 'flex', alignItems: 'center', gap: 4 }}>
                        ★ {leader.name}
                        <span style={{ fontSize: 9, opacity: 0.7 }}>Detail Holder</span>
                      </span>
                    )}
                    {assigned.filter(a => a.id !== selectedDoc.production_leader_id).map(m => (
                      <span key={m.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: `${m.color}15`, color: m.color, fontWeight: 600 }}>
                        {m.name}
                      </span>
                    ))}
                  </div>
                )
              })()}
              <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '12px 0 0' }} />
            </div>

            {/* Production photos */}
            <ProductionPhotos doc={selectedDoc} onUpdate={(photos) => {
              setDocs(ds => ds.map(d => d.id === selectedDoc.id ? { ...d, production_photos: photos } : d))
            }} />

            {/* Open invoice link */}
            <div style={{ marginBottom: 14 }}>
              <a
                href={`/documents/${selectedDoc.id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6,
                  background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
                  color: '#22d3ee', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.08)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                Open {selectedDoc.doc_type === 'invoice' ? 'Invoice' : selectedDoc.doc_type === 'quote' ? 'Quote' : 'Document'}
              </a>
            </div>

            {/* Schedule Preview */}
            <SchedulePreview doc={selectedDoc} />

            {/* Notes */}
            <NotesSection docId={selectedDoc.id} initialNotes={selectedDoc.notes || []} onNotesUpdate={(notes) => {
              setDocs(ds => ds.map(d => d.id === selectedDoc.id ? { ...d, notes } : d))
            }} />

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 12px' }} />

            {/* Move button in popover footer */}
            {(() => {
              const next = getNextStage((selectedDoc.production_stage || 'QUEUE') as StageKey)
              if (!next) return null
              return (
                <button
                  onClick={() => {
                    moveToStage(selectedDoc.id, next)
                    closePopover()
                  }}
                  style={{
                    width: '100%', padding: '10px', border: 'none', borderRadius: 8,
                    background: 'linear-gradient(135deg, #22d3ee, #0ea5e9)', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  Move to {getStageLabel(next)} →
                </button>
              )
            })()}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* ASSIGN MODAL                                                   */}
      {/* ============================================================= */}
      {assignModalOpen && selectedDoc && (
        <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setAssignModalOpen(false) }}>
          <div style={{ background: '#111111', borderRadius: 16, padding: '24px', width: 420, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: 0 }}>Assign Team — {selectedDoc.customer_name}</h3>
              <button onClick={() => setAssignModalOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: 18, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Assign To (multi-select) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Assign To</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {teamMembers.map(member => {
                  const isAssigned = assignments.some(a => a.document_id === selectedDoc.id && a.team_member_id === member.id)
                  return (
                    <button key={member.id} onClick={() => toggleAssignment(selectedDoc.id, member.id)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: isAssigned ? `${member.color}20` : 'rgba(255,255,255,0.04)',
                        border: isAssigned ? `2px solid ${member.color}` : '2px solid rgba(148,163,184,0.15)',
                        color: isAssigned ? member.color : '#94a3b8',
                        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: member.color }} />
                      {member.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Detail Holder (single-select) */}
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Detail Holder</div>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>Who has the details on this project</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => setDetailHolder(selectedDoc.id, null)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: !selectedDoc.production_leader_id ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.04)',
                    border: !selectedDoc.production_leader_id ? '2px solid #94a3b8' : '2px solid rgba(148,163,184,0.15)',
                    color: !selectedDoc.production_leader_id ? '#f1f5f9' : '#64748b',
                    transition: 'all 0.15s',
                  }}>None</button>
                {teamMembers.map(member => {
                  const isLeader = selectedDoc.production_leader_id === member.id
                  return (
                    <button key={member.id} onClick={() => setDetailHolder(selectedDoc.id, member.id)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: isLeader ? `${member.color}20` : 'rgba(255,255,255,0.04)',
                        border: isLeader ? `2px solid ${member.color}` : '2px solid rgba(148,163,184,0.15)',
                        color: isLeader ? member.color : '#94a3b8',
                        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: member.color }} />
                      {member.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STATUS NOTE MODAL — appears when picking a status that requires a note */}
      {/* ============================================================= */}
      {statusNoteModal && (() => {
        const submit = () => {
          if (!statusNoteModal.note.trim()) return
          if (statusNoteModal.docId) applyStatusToDoc(statusNoteModal.docId, statusNoteModal.status, statusNoteModal.note.trim())
          else if (statusNoteModal.taskId) applyStatusToTask(statusNoteModal.taskId, statusNoteModal.status, statusNoteModal.note.trim())
          setStatusNoteModal(null)
        }
        return (
          <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setStatusNoteModal(null) }}>
            <div style={{ background: '#111111', borderRadius: 16, padding: '24px', width: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', border: `1px solid ${statusNoteModal.status.color}55` }}>
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusNoteModal.status.color }} />
                {statusNoteModal.status.label}
              </h3>
              <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>Add a quick note explaining the situation.</p>
              <input
                value={statusNoteModal.note}
                onChange={e => setStatusNoteModal(m => m ? { ...m, note: e.target.value } : m)}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                placeholder="e.g., Waiting on customer approval, material backordered..."
                autoFocus
                style={{ width: '100%', padding: '10px 14px', background: '#0d0d0d', border: `1px solid ${statusNoteModal.status.color}55`, borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setStatusNoteModal(null)} style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={submit}
                  disabled={!statusNoteModal.note.trim()}
                  style={{ padding: '8px 18px', borderRadius: 8, background: statusNoteModal.note.trim() ? statusNoteModal.status.color : '#333', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: statusNoteModal.note.trim() ? 'pointer' : 'default' }}
                >Save</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ============================================================= */}
      {/* STATUS MANAGER MODAL                                           */}
      {/* ============================================================= */}
      <StatusManager
        open={statusManagerOpen}
        onClose={() => setStatusManagerOpen(false)}
        statuses={statuses}
        onChange={setStatuses}
      />

      {/* ============================================================= */}
      {/* WASTE REPORT MODAL — triggered by 'Needs reprint' status      */}
      {/* ============================================================= */}
      {wasteReportFor && (() => {
        const wDoc = docs.find(d => d.id === wasteReportFor.docId)
        return (
          <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setWasteReportFor(null) }}>
            <div style={{ background: '#111', borderRadius: 14, padding: '24px', width: 500, maxWidth: '100%', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>⚠ Log waste for reprint</h3>
              <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
                {wDoc ? `${wDoc.customer_name} — ${wDoc.doc_number}` : ''}<br />
                Tracking the wasted material helps us spot recurring issues. Open the full waste reporter or skip for now.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setWasteReportFor(null)} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Skip for now</button>
                <a
                  href="/waste-reporter"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWasteReportFor(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
                >Open waste reporter →</a>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ============================================================= */}
      {/* COMPLETE + NOTIFY MODAL                                        */}
      {/* ============================================================= */}
      {completeModalDocId && (() => {
        const cDoc = docs.find(d => d.id === completeModalDocId)
        if (!cDoc) return null
        return (
          <CompleteModal
            doc={cDoc}
            teamMembers={teamMembers}
            onComplete={async ({ sendText, sendEmail, textMsg, emailSubject, emailBody, qcSignOff }) => {
              await doMoveToStage(completeModalDocId, 'COMPLETE')

              // Save QC sign-off
              fetch(`/api/documents/${completeModalDocId}/production-status`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  qc_signed_off_by: qcSignOff,
                  qc_signed_off_at: new Date().toISOString(),
                  ...(sendText || sendEmail ? { production_notified_at: new Date().toISOString() } : {}),
                }),
              }).catch(() => {})
              setDocs(ds => ds.map(d => d.id === completeModalDocId ? {
                ...d,
                qc_signed_off_by: qcSignOff,
                qc_signed_off_at: new Date().toISOString(),
                ...(sendText || sendEmail ? { production_notified_at: new Date().toISOString() } : {}),
              } : d))

              // Send text
              if (sendText && cDoc.customer_phone) {
                fetch('/api/sms', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ to: cDoc.customer_phone, message: textMsg }),
                }).catch(() => {})
              }

              // Send email
              if (sendEmail && cDoc.customer_email) {
                fetch('/api/gmail/send', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ to: cDoc.customer_email, subject: emailSubject, body: emailBody }),
                }).catch(() => {})
              }

              if (sendText || sendEmail) showToast('Customer notified!', 'success')
              setCompleteModalDocId(null)
              closePopover()
            }}
            onCancel={() => setCompleteModalDocId(null)}
          />
        )
      })()}

      {/* ============================================================= */}
      {/* STATUS DROPDOWN — fixed-position floating panel for cards     */}
      {/* ============================================================= */}
      {(statusDropdownDocId || statusDropdownTaskId) && statusDropdownRect && (() => {
        let stage: string | undefined
        let curStatusId: string | null = null
        let onPick: (s: ProductionStatus) => void = () => {}

        if (statusDropdownDocId) {
          const doc = docs.find(d => d.id === statusDropdownDocId)
          if (!doc) return null
          stage = doc.production_stage || 'QUEUE'
          curStatusId = doc.production_status_id || null
          onPick = (s) => applyStatusToDoc(statusDropdownDocId!, s)
        } else if (statusDropdownTaskId) {
          const task = tasks.find(t => t.id === statusDropdownTaskId)
          if (!task) return null
          stage = task.production_stage || 'QUEUE'
          curStatusId = task.production_status_id || null
          onPick = (s) => applyStatusToTask(statusDropdownTaskId!, s)
        }
        if (!stage || !CONFIGURABLE_STAGES.includes(stage as any)) return null
        const stageStatuses = statusesByStage[stage] || []
        if (stageStatuses.length === 0) return null
        const cur = curStatusId ? statuses.find(s => s.id === curStatusId) : null
        const dropdownH = Math.min((stageStatuses.length + 1) * 36 + 16, 360)
        const top = statusDropdownRect.flipUp
          ? statusDropdownRect.top - dropdownH - 4
          : statusDropdownRect.top + 32 // pill height ~32
        return (
          <div
            className="status-dropdown"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top, left: statusDropdownRect.left, width: statusDropdownRect.width,
              maxHeight: dropdownH, overflowY: 'auto',
              background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8,
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)', zIndex: 1500,
            }}
          >
            {stageStatuses.map(s => (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                style={{
                  width: '100%', padding: '8px 10px', textAlign: 'left',
                  background: cur?.id === s.id ? `${s.color}18` : 'transparent',
                  border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${s.color}28` }}
                onMouseLeave={e => { e.currentTarget.style.background = cur?.id === s.id ? `${s.color}18` : 'transparent' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{s.label}</span>
                {s.requires_note && <span style={{ fontSize: 9, color: '#64748b' }}>note</span>}
              </button>
            ))}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
              <button
                onClick={() => { setStatusDropdownDocId(null); setStatusDropdownTaskId(null); setStatusDropdownRect(null); setStatusManagerOpen(true) }}
                style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: '#64748b', fontSize: 11, textAlign: 'left', cursor: 'pointer' }}
              >Manage statuses…</button>
            </div>
          </div>
        )
      })()}

      {/* Task quick-add */}
      <TaskQuickAdd
        open={taskQuickAddOpen.open}
        onClose={() => setTaskQuickAddOpen({ open: false })}
        onCreate={handleTaskCreated}
        defaultStage={taskQuickAddOpen.defaultStage}
        teamMembers={teamMembers}
      />

      {/* Task popover (anchored to clicked task card, same style as doc popover) */}
      {popoverVisible && openTaskId && (() => {
        const task = tasks.find(t => t.id === openTaskId)
        if (!task) return null
        const stage = task.production_stage || 'QUEUE'
        const stageStatuses = statusesByStage[stage] || []
        const cur = task.production_status_id ? statuses.find(s => s.id === task.production_status_id) : null
        const taskAssigneeIds = taskAssignments.filter(a => a.task_id === task.id).map(a => a.team_member_id)
        const linkedEvent = task.calendar_event_id ? allCalendarEvents.find(e => e.id === task.calendar_event_id) : null

        const persistTask = (patch: Partial<BoardTask>) => {
          setTasks(ts => ts.map(t => t.id === task.id ? { ...t, ...patch } : t))
          fetch(`/api/production-tasks/${task.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          }).catch(() => {})
        }

        const toggleTaskAssignment = (memberId: string) => {
          if (taskAssigneeIds.includes(memberId)) {
            setTaskAssignments(prev => prev.filter(a => !(a.task_id === task.id && a.team_member_id === memberId)))
            fetch(`/api/production-tasks/${task.id}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: memberId }) }).catch(() => {})
          } else {
            setTaskAssignments(prev => [...prev, { task_id: task.id, team_member_id: memberId }])
            fetch(`/api/production-tasks/${task.id}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: memberId }) }).catch(() => {})
          }
        }

        return (
          <div
            ref={popoverRef}
            style={{
              ...popoverStyle,
              background: '#111111',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 900,
              overflowY: 'auto',
              transformOrigin: flipped ? 'right top' : 'left top',
              animation: 'popIn 0.18s ease-out',
            }}
          >
            <style>{`@keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

            {/* Color bar */}
            <div style={{ height: 3, borderRadius: '12px 12px 0 0', background: cur?.color || '#94a3b8' }} />

            <div style={{ padding: '14px 16px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>TASK</span>
                    {task.archived && <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700 }}>ARCHIVED</span>}
                  </div>
                  <input
                    type="text"
                    value={task.title}
                    onChange={e => setTasks(ts => ts.map(t => t.id === task.id ? { ...t, title: e.target.value } : t))}
                    onBlur={e => persistTask({ title: e.target.value })}
                    style={{ fontSize: 17, fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {stage === 'COMPLETE' && (
                    <button
                      onClick={() => archiveTaskCard(task.id)}
                      title="Archive this task"
                      className="archive-btn"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', height: 28, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                    >Archive</button>
                  )}
                  <button onClick={closePopover} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: 16, width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>

              {/* Status pill */}
              {CONFIGURABLE_STAGES.includes(stage as any) && stageStatuses.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={e => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const dropdownH = Math.min((stageStatuses.length + 1) * 36 + 16, 360)
                      const flipUp = r.bottom + dropdownH > window.innerHeight - 20
                      setStatusDropdownDocId(null)
                      setStatusDropdownTaskId(task.id)
                      setStatusDropdownRect({ top: r.top, left: r.left, width: Math.max(r.width, 220), flipUp })
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: cur ? `${cur.color}22` : 'rgba(148,163,184,0.1)',
                      border: `1px solid ${cur ? `${cur.color}55` : 'rgba(148,163,184,0.2)'}`,
                      color: cur ? cur.color : '#94a3b8',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: cur?.color || '#94a3b8' }} />
                    {cur?.label || 'Set status'}
                    <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
                  </button>
                  {task.production_status_note && (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#fca5a5' }}>
                      ⚑ {task.production_status_note}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5 }}>Description</div>
                <textarea
                  value={task.description || ''}
                  onChange={e => setTasks(ts => ts.map(t => t.id === task.id ? { ...t, description: e.target.value } : t))}
                  onBlur={e => persistTask({ description: e.target.value || null } as any)}
                  placeholder="Add a description…"
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
                />
              </div>

              {/* Due date + Calendar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5 }}>Due date</div>
                  <input
                    type="date"
                    value={task.due_date || ''}
                    onChange={e => persistTask({ due_date: e.target.value || null } as any)}
                    style={{ width: '100%', padding: '6px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#f1f5f9', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5 }}>Linked job</div>
                  <select
                    value={task.calendar_event_id || ''}
                    onChange={e => persistTask({ calendar_event_id: e.target.value || null } as any)}
                    style={{ width: '100%', padding: '6px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">— Not linked —</option>
                    {allCalendarEvents.map(ev => {
                      const dt = new Date(ev.start_time)
                      const label = `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${ev.title}${ev.customer_name ? ` (${ev.customer_name})` : ''}`
                      return <option key={ev.id} value={ev.id}>{label}</option>
                    })}
                  </select>
                </div>
              </div>
              {!linkedEvent && (
                <a href="/calendar" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#22d3ee', textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>+ Schedule new job in Job Calendar</a>
              )}

              {/* Team */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Team</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {teamMembers.map(m => {
                    const isLeader = task.leader_id === m.id
                    const isAssigned = taskAssigneeIds.includes(m.id)
                    return (
                      <div key={m.id} style={{ display: 'inline-flex' }}>
                        <button
                          onClick={() => toggleTaskAssignment(m.id)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: isLeader || isAssigned ? '6px 0 0 6px' : 6,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            background: isAssigned || isLeader ? `${m.color}25` : 'rgba(148,163,184,0.06)',
                            border: isAssigned || isLeader ? `1px solid ${m.color}` : '1px solid rgba(148,163,184,0.15)',
                            color: isAssigned || isLeader ? m.color : '#94a3b8',
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                          {m.short_name || m.name}
                        </button>
                        {(isAssigned || isLeader) && (
                          <button
                            onClick={() => persistTask({ leader_id: isLeader ? null : m.id } as any)}
                            title={isLeader ? 'Remove as leader' : 'Make leader'}
                            style={{ padding: '0 8px', borderRadius: '0 6px 6px 0', background: isLeader ? `${m.color}40` : 'rgba(148,163,184,0.06)', border: `1px solid ${m.color}`, borderLeft: 'none', color: isLeader ? m.color : '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                          >★</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mockups */}
              <TaskMockupsBlock task={task} onChange={persistTask} />

              {/* Notes */}
              <TaskNotesBlock task={task} onChange={persistTask} />

              {/* Actions */}
              {stage !== 'COMPLETE' && (
                <button
                  onClick={() => { persistTask({ production_stage: 'COMPLETE', task_completed_at: new Date().toISOString() } as any); closePopover() }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#22c55e', border: 'none', color: '#0d2317', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >✓ Mark Complete</button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Archived production cards modal */}
      <ArchivedDocsModal
        open={archivedModalOpen}
        onClose={() => setArchivedModalOpen(false)}
        onRestored={restoreDocCard}
      />

      {/* ============================================================= */}
      {/* DOCUMENT EDITOR SIDEBAR (Hybrid C — full quote/invoice view)   */}
      {/* ============================================================= */}
      <DocumentSidebar
        open={!!sidebarDocId}
        docId={sidebarDocId}
        onClose={() => setSidebarDocId(null)}
      />

      {/* ============================================================= */}
      {/* LIGHTBOX                                                       */}
      {/* ============================================================= */}
      {lightbox && (
        <LightboxOverlay lightbox={lightbox} setLightbox={setLightbox} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable column wrappers
// ---------------------------------------------------------------------------

function DroppableColumn({ stageKey, isComplete, children }: { stageKey: string; isComplete: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      flex: isComplete ? '0 0 280px' : 1,
      minWidth: 270,
      display: 'flex', flexDirection: 'column',
      borderRadius: 14,
      background: '#131313',
      border: '1px solid rgba(148,163,184,0.07)',
      opacity: isComplete ? 0.85 : 1,
      overflow: 'hidden',
    }}>{children}</div>
  )
}

// ---------------------------------------------------------------------------
// Task popover — mockups block (separate so file input ref is local)
// ---------------------------------------------------------------------------
function TaskMockupsBlock({ task, onChange }: { task: BoardTask; onChange: (patch: Partial<BoardTask>) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const newOnes: { url: string; filename: string; uploadedAt: string }[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const d = await res.json()
          newOnes.push({ url: d.url, filename: file.name, uploadedAt: new Date().toISOString() })
        }
      }
      onChange({ mockups: [...(task.mockups || []), ...newOnes] } as any)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeMockup = (idx: number) => {
    onChange({ mockups: (task.mockups || []).filter((_, i) => i !== idx) } as any)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Mockups</div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ padding: '4px 10px', borderRadius: 5, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      </div>
      {(task.mockups || []).length === 0 && <div style={{ color: '#475569', fontSize: 11, fontStyle: 'italic' }}>No mockups uploaded</div>}
      {(task.mockups || []).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(task.mockups || []).map((m, idx) => (
            <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.1)' }}>
              <img src={m.url} alt={m.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => removeMockup(idx)}
                style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TASK_NOTE_AUTHORS = ['Joe', 'Joey', 'Sharyn', 'Diogo', 'Mason', 'Sydney', 'Jay']

function TaskNotesBlock({ task, onChange }: { task: BoardTask; onChange: (patch: Partial<BoardTask>) => void }) {
  const [newNote, setNewNote] = useState('')
  const [author, setAuthor] = useState(TASK_NOTE_AUTHORS[1])

  const addNote = () => {
    if (!newNote.trim()) return
    const entry = { text: newNote.trim(), author, at: new Date().toISOString() }
    onChange({ notes_log: [...(task.notes_log || []), entry] } as any)
    setNewNote('')
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Notes</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select value={author} onChange={e => setAuthor(e.target.value)} style={{ padding: '6px 8px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, outline: 'none', cursor: 'pointer' }}>
          {TASK_NOTE_AUTHORS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          placeholder="Add a note…"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addNote() }}
          style={{ flex: 1, padding: '6px 10px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, outline: 'none' }}
        />
        <button onClick={addNote} disabled={!newNote.trim()} style={{ padding: '6px 12px', borderRadius: 6, background: newNote.trim() ? '#22d3ee' : '#333', border: 'none', color: newNote.trim() ? '#000' : '#666', fontSize: 11, fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'default' }}>Add</button>
      </div>
      {(task.notes_log || []).slice().reverse().map((n, i) => (
        <div key={i} style={{ padding: '6px 8px', background: '#0d0d0d', borderRadius: 5, marginBottom: 4, borderLeft: '2px solid rgba(148,163,184,0.3)' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
            <strong style={{ color: '#94a3b8' }}>{n.author}</strong> · {new Date(n.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 12, color: '#e2e8f0' }}>{n.text}</div>
        </div>
      ))}
    </div>
  )
}

function ColumnDroppableArea({ stageKey, hasItems, children }: { stageKey: string; hasItems: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stageKey}` })
  return (
    <div ref={setNodeRef} style={{
      flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
      border: isOver ? '1px dashed rgba(148,163,184,0.35)' : '1px dashed transparent',
      borderRadius: 8,
      transition: 'border-color 0.15s, background 0.15s',
      minHeight: 80,
      background: isOver && !hasItems ? 'rgba(148,163,184,0.04)' : 'transparent',
    }}>{children}</div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Preview (mini calendar like production card)
// ---------------------------------------------------------------------------

function SchedulePreview({ doc }: { doc: ProductionDocument }) {
  const event = doc.calendar_events?.[0]
  if (!event || !event.vehicle_start || !event.vehicle_end) return null

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const vStart = event.vehicle_start
  const vEnd = event.vehicle_end
  const iStart = event.install_start
  const iEnd = event.install_end

  const vStartDate = new Date(vStart + 'T00:00:00')
  const vEndDate = new Date(vEnd + 'T00:00:00')

  // Vehicle status
  const daysUntilStart = Math.ceil((vStartDate.getTime() - today.getTime()) / 86400000)
  const daysUntilEnd = Math.ceil((vEndDate.getTime() - today.getTime()) / 86400000)
  const vehicleDays = Math.ceil((vEndDate.getTime() - vStartDate.getTime()) / 86400000)

  let statusText = ''
  let statusColor = '#64748b'
  if (daysUntilStart > 0) { statusText = `Arrives in ${daysUntilStart}d`; statusColor = '#3b82f6' }
  else if (daysUntilEnd > 0) { const dayIn = Math.ceil((today.getTime() - vStartDate.getTime()) / 86400000); statusText = `Day ${dayIn} of ${vehicleDays}`; statusColor = '#22c55e' }
  else if (daysUntilEnd === 0) { statusText = 'Pickup today'; statusColor = '#f59e0b' }
  else { statusText = `${Math.abs(daysUntilEnd)}d past pickup`; statusColor = '#ef4444' }

  // Build calendar strip days
  const stripStart = new Date(vStartDate); stripStart.setDate(stripStart.getDate() - 1)
  const stripEnd = new Date(vEndDate); stripEnd.setDate(stripEnd.getDate() + 1)
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const days: { date: Date; isVehicle: boolean; isInstall: boolean; isToday: boolean }[] = []
  const cursor = new Date(stripStart)

  while (cursor <= stripEnd) {
    const d = new Date(cursor)
    const ds = toStr(d)
    const isVehicle = ds >= vStart && ds <= vEnd
    const isInstall = iStart && iEnd ? ds >= iStart && ds <= iEnd : false
    days.push({ date: d, isVehicle, isInstall, isToday: ds === toStr(today) })
    cursor.setDate(cursor.getDate() + 1)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12 }}>📅</span> Schedule
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: `${statusColor}18`, padding: '2px 8px', borderRadius: 4 }}>{statusText}</span>
      </div>

      {/* Mini calendar strip */}
      <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
        {days.map((day, i) => {
          const isBuffer = !day.isVehicle && !day.isInstall
          let bg = 'transparent'
          let border = '1px solid rgba(148,163,184,0.05)'
          let numColor = '#475569'
          if (day.isInstall) { bg = 'rgba(168,85,247,0.25)'; border = '2px solid rgba(168,85,247,0.5)'; numColor = '#e9d5ff' }
          else if (day.isVehicle) { bg = 'rgba(59,130,246,0.08)'; border = '1px dashed rgba(59,130,246,0.4)'; numColor = '#bfdbfe' }
          if (day.isToday) { numColor = '#22c55e' }
          if (isBuffer) { numColor = '#1e293b' }

          return (
            <div key={i} style={{
              flex: isBuffer ? '0 0 24px' : 1, minWidth: isBuffer ? 24 : 36,
              padding: '4px 2px', borderRadius: 5, background: bg, border,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              opacity: isBuffer ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 8, color: day.isToday ? '#22c55e' : '#475569', fontWeight: 600 }}>{dayNames[day.date.getDay()]}</div>
              <div style={{ fontSize: 11, fontWeight: day.isToday ? 800 : 600, color: numColor }}>{day.date.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 4, borderRadius: 1, border: '1px dashed rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.1)' }} /> Vehicle
        </span>
        {iStart && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 4, borderRadius: 1, background: 'rgba(168,85,247,0.4)' }} /> Install
          </span>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '12px 0 0' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notes Section
// ---------------------------------------------------------------------------

function NotesSection({ docId, initialNotes, onNotesUpdate }: {
  docId: string
  initialNotes: NoteEntry[]
  onNotesUpdate: (notes: NoteEntry[]) => void
}) {
  const [notes, setNotes] = useState<NoteEntry[]>(initialNotes)
  const [newText, setNewText] = useState('')
  const [author, setAuthor] = useState(NOTE_AUTHORS[0])
  const [saving, setSaving] = useState(false)

  // Sync if docId changes
  useEffect(() => {
    setNotes(initialNotes)
  }, [docId, initialNotes])

  const addNote = async () => {
    if (!newText.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${docId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText.trim(), author }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotes(updated)
        onNotesUpdate(updated)
        setNewText('')
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const formatNoteDate = (at: string) => {
    const d = new Date(at)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8 }}>Notes</div>

      {/* Add note input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select
          value={author}
          onChange={e => setAuthor(e.target.value)}
          style={{ padding: '6px 8px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#94a3b8', fontSize: 11, outline: 'none', flexShrink: 0 }}
        >
          {NOTE_AUTHORS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addNote() }}
          placeholder="Add a note..."
          style={{ flex: 1, padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#f1f5f9', fontSize: 12, outline: 'none' }}
        />
        <button
          onClick={addNote}
          disabled={!newText.trim() || saving}
          style={{ padding: '6px 12px', borderRadius: 6, background: newText.trim() ? '#22d3ee' : '#333', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: newText.trim() ? 'pointer' : 'default', opacity: saving ? 0.6 : 1, flexShrink: 0 }}
        >
          {saving ? '...' : 'Add'}
        </button>
      </div>

      {/* Existing notes */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
          {notes.map((note, i) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#22d3ee' }}>{note.author}</span>
                <span style={{ fontSize: 9, color: '#475569' }}>{note.at ? formatNoteDate(note.at) : ''}</span>
              </div>
              <div style={{ fontSize: 12, color: '#c8cdd8', lineHeight: 1.4 }}>{note.text}</div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No notes yet</div>
      )}

      <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '12px 0 0' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Complete + Notify Modal
// ---------------------------------------------------------------------------

const TEXT_PRESETS = [
  { label: 'Ready for Pickup', key: 'pickup', template: (doc: ProductionDocument) => `Hi ${doc.customer_name?.split(' ')[0] || 'there'}! Your project with Frederick Wraps & Graphics is complete and ready for pickup. We'll see you soon! 🎉` },
  { label: 'Ready — Vehicle', key: 'vehicle', template: (doc: ProductionDocument) => `Hi ${doc.customer_name?.split(' ')[0] || 'there'}! Your ${doc.vehicle_description || 'vehicle'} is done and ready for pickup at Frederick Wraps & Graphics. Can't wait for you to see it! 🎉` },
  { label: 'Ready for Delivery', key: 'delivery', template: (doc: ProductionDocument) => `Hi ${doc.customer_name?.split(' ')[0] || 'there'}! Your project with Frederick Wraps & Graphics is complete. We'll be reaching out to schedule delivery. Thanks!` },
]

const EMAIL_PRESETS = [
  { label: 'Ready for Pickup', key: 'pickup', template: (doc: ProductionDocument) => `<p>Hi ${doc.customer_name?.split(' ')[0] || 'there'},</p><p>Great news — your project with Frederick Wraps & Graphics is <strong>complete and ready for pickup</strong>!</p>${doc.vehicle_description ? `<p><strong>${doc.vehicle_description}</strong></p>` : ''}<p>We can't wait for you to see it. Let us know if you have any questions!</p><p>— The FWG Team</p>` },
  { label: 'Ready — Vehicle', key: 'vehicle', template: (doc: ProductionDocument) => `<p>Hi ${doc.customer_name?.split(' ')[0] || 'there'},</p><p>Your <strong>${doc.vehicle_description || 'vehicle'}</strong> is finished and looking incredible! It's ready for pickup at our shop.</p><p>Our hours are Monday–Friday 9am–5pm. Let us know if you need to arrange a different time!</p><p>— The FWG Team</p>` },
  { label: 'Ready for Delivery', key: 'delivery', template: (doc: ProductionDocument) => `<p>Hi ${doc.customer_name?.split(' ')[0] || 'there'},</p><p>Your project with Frederick Wraps & Graphics is <strong>complete</strong>! We'll be in touch shortly to schedule delivery.</p>${doc.vehicle_description ? `<p><strong>${doc.vehicle_description}</strong></p>` : ''}<p>Thanks for your business!</p><p>— The FWG Team</p>` },
]

function CompleteModal({ doc, teamMembers, onComplete, onCancel }: {
  doc: ProductionDocument
  teamMembers: TeamMember[]
  onComplete: (options: { sendText: boolean; sendEmail: boolean; textMsg: string; emailSubject: string; emailBody: string; qcSignOff: string }) => void
  onCancel: () => void
}) {
  const hasPhone = !!doc.customer_phone
  const hasEmail = !!doc.customer_email

  const [sendText, setSendText] = useState(hasPhone)
  const [sendEmail, setSendEmail] = useState(hasEmail)
  const [textPreset, setTextPreset] = useState('pickup')
  const [emailPreset, setEmailPreset] = useState('pickup')
  const [textMsg, setTextMsg] = useState(TEXT_PRESETS[0].template(doc))
  const [emailSubject, setEmailSubject] = useState(`Your project is ready! — ${doc.doc_number}`)
  const [emailBody, setEmailBody] = useState(EMAIL_PRESETS[0].template(doc))
  const [qcSignOff, setQcSignOff] = useState('')

  const applyTextPreset = (key: string) => {
    setTextPreset(key)
    const preset = TEXT_PRESETS.find(p => p.key === key)
    if (preset) setTextMsg(preset.template(doc))
  }

  const applyEmailPreset = (key: string) => {
    setEmailPreset(key)
    const preset = EMAIL_PRESETS.find(p => p.key === key)
    if (preset) setEmailBody(preset.template(doc))
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, color: '#f1f5f9', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: '#111111', borderRadius: 16, padding: '24px', width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🎉</div>
        <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: '0 0 4px', textAlign: 'center' }}>Mark as Complete</h3>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>
          {doc.customer_name} — {doc.vehicle_description || doc.project_description || doc.doc_number}
        </p>

        {/* QC Sign-off */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>QC Sign-off</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {teamMembers.map(m => (
              <button key={m.id} onClick={() => setQcSignOff(qcSignOff === m.name ? '' : m.name)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: qcSignOff === m.name ? `${m.color}20` : 'rgba(255,255,255,0.04)',
                  border: qcSignOff === m.name ? `2px solid ${m.color}` : '2px solid rgba(148,163,184,0.15)',
                  color: qcSignOff === m.name ? m.color : '#94a3b8',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                {m.name}
              </button>
            ))}
          </div>
          {!qcSignOff && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 6 }}>Select who did the final QC</div>}
        </div>

        <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 16px' }} />

        {/* Notification channels */}
        {(hasPhone || hasEmail) && (
          <>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Notify Customer</div>

            {/* Text toggle + content */}
            {hasPhone && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={sendText} onChange={e => setSendText(e.target.checked)}
                    style={{ accentColor: '#22c55e', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: sendText ? '#f1f5f9' : '#64748b', fontWeight: 600 }}>📱 Text to {doc.customer_phone}</span>
                </label>
                {sendText && (
                  <div style={{ marginLeft: 24 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {TEXT_PRESETS.map(p => (
                        <button key={p.key} onClick={() => applyTextPreset(p.key)}
                          style={{ padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: textPreset === p.key ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)', border: textPreset === p.key ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(148,163,184,0.1)', color: textPreset === p.key ? '#22d3ee' : '#64748b' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <textarea value={textMsg} onChange={e => setTextMsg(e.target.value)} rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                )}
              </div>
            )}

            {/* Email toggle + content */}
            {hasEmail && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                    style={{ accentColor: '#22c55e', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: sendEmail ? '#f1f5f9' : '#64748b', fontWeight: 600 }}>📧 Email to {doc.customer_email}</span>
                </label>
                {sendEmail && (
                  <div style={{ marginLeft: 24 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {EMAIL_PRESETS.map(p => (
                        <button key={p.key} onClick={() => applyEmailPreset(p.key)}
                          style={{ padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: emailPreset === p.key ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)', border: emailPreset === p.key ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(148,163,184,0.1)', color: emailPreset === p.key ? '#22d3ee' : '#64748b' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject..."
                      style={{ ...inputStyle, marginBottom: 6 }} />
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => setEmailBody(e.currentTarget.innerHTML)}
                      dangerouslySetInnerHTML={{ __html: emailBody }}
                      style={{ ...inputStyle, minHeight: 80, lineHeight: 1.5, cursor: 'text', whiteSpace: 'pre-wrap' }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (!qcSignOff) return
              onComplete({ sendText: false, sendEmail: false, textMsg, emailSubject, emailBody, qcSignOff })
            }}
            disabled={!qcSignOff}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: qcSignOff ? 'pointer' : 'default',
              background: qcSignOff ? 'rgba(255,255,255,0.06)' : '#222',
              border: qcSignOff ? '1px solid rgba(148,163,184,0.2)' : '1px solid transparent',
              color: qcSignOff ? '#f1f5f9' : '#64748b',
            }}>
            Complete Only
          </button>
          {(sendText || sendEmail) && (
            <button
              onClick={() => {
                if (!qcSignOff) return
                onComplete({ sendText, sendEmail, textMsg, emailSubject, emailBody, qcSignOff })
              }}
              disabled={!qcSignOff}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: qcSignOff ? 'pointer' : 'default',
                background: qcSignOff ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#333',
                color: qcSignOff ? '#fff' : '#64748b',
              }}>
              Complete + Notify
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Production Photos (before/after)
// ---------------------------------------------------------------------------

function ProductionPhotos({ doc, onUpdate }: {
  doc: ProductionDocument
  onUpdate: (photos: any[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photos = doc.production_photos || []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)

    const newPhotos = [...photos]
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentId', doc.id)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          newPhotos.push({ url: data.url, filename: file.name, uploadedAt: new Date().toISOString() })
        }
      } catch { /* ignore */ }
    }

    // Save to document
    await fetch(`/api/documents/${doc.id}/production-status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_photos: newPhotos }),
    })
    onUpdate(newPhotos)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (photos.length === 0 && !uploading) {
    return (
      <div style={{ marginBottom: 14 }}>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} style={{
          width: '100%', padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(148,163,184,0.15)', color: '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#22d3ee' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)' }}
        >📷 Add Photos</button>
        <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '12px 0 0' }} />
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>📷 Production Photos</div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }}>
            {uploading ? 'Uploading...' : '+ Add'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {photos.map((photo: any, i: number) => (
          <div key={i} style={{ width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.1)' }}>
            <img src={photo.url} alt={photo.filename} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '12px 0 0' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function LightboxOverlay({ lightbox, setLightbox }: { lightbox: { images: { url: string; label: string }[]; index: number }; setLightbox: (v: any) => void }) {
  const [zoomed, setZoomed] = React.useState(false)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const lastPos = React.useRef({ x: 0, y: 0 })
  const imgRef = React.useRef<HTMLImageElement>(null)

  const img = lightbox.images[lightbox.index]
  const hasMultiple = lightbox.images.length > 1

  const resetView = () => { setZoomed(false); setPan({ x: 0, y: 0 }); setIsDragging(false) }
  const goTo = (idx: number) => { resetView(); setLightbox({ ...lightbox, index: idx }) }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft' && hasMultiple) goTo((lightbox.index - 1 + lightbox.images.length) % lightbox.images.length)
      if (e.key === 'ArrowRight' && hasMultiple) goTo((lightbox.index + 1) % lightbox.images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox.index, lightbox.images.length, hasMultiple])

  return (
    <div
      data-lightbox
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      onClick={e => { if (e.target === e.currentTarget) setLightbox(null) }}
    >
      <button onClick={() => setLightbox(null)}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>×</button>

      {hasMultiple && (
        <button onClick={() => goTo((lightbox.index - 1 + lightbox.images.length) % lightbox.images.length)}
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 28, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>‹</button>
      )}
      {hasMultiple && (
        <button onClick={() => goTo((lightbox.index + 1) % lightbox.images.length)}
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 28, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>›</button>
      )}

      <img
        ref={imgRef}
        src={img.url}
        alt={img.label}
        draggable={false}
        onDoubleClick={() => { if (zoomed) resetView(); else setZoomed(true) }}
        style={{
          maxWidth: zoomed ? 'none' : '85vw',
          maxHeight: zoomed ? 'none' : '85vh',
          width: zoomed ? '170vw' : undefined,
          objectFit: 'contain', borderRadius: 6,
          cursor: zoomed ? 'grab' : 'zoom-in',
          transform: zoomed ? `translate(${pan.x}px, ${pan.y}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.15s ease',
          userSelect: 'none', touchAction: 'none',
        }}
      />

      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 500, marginBottom: 2 }}>{img.label}</div>
        {hasMultiple && <div>{lightbox.index + 1} / {lightbox.images.length}</div>}
      </div>
    </div>
  )
}
