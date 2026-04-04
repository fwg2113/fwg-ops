'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGES = [
  { key: 'QUEUE', label: 'Queue', color: '#64748b', dotColor: '#94a3b8' },
  { key: 'DESIGN', label: 'Design', color: '#a855f7', dotColor: '#a855f7' },
  { key: 'PRINT', label: 'Print', color: '#3b82f6', dotColor: '#3b82f6' },
  { key: 'PRODUCTION', label: 'Production', color: '#14b8a6', dotColor: '#14b8a6' },
  { key: 'QC', label: 'QC', color: '#f59e0b', dotColor: '#f59e0b' },
  { key: 'COMPLETE', label: 'Complete', color: '#22c55e', dotColor: '#22c55e' },
] as const

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
}: {
  documents: ProductionDocument[]
  categoriesData: CategoryData[]
  teamMembers: TeamMember[]
  initialAssignments: ProductionAssignment[]
}) {
  const [docs, setDocs] = useState(documents)
  const [assignments, setAssignments] = useState<ProductionAssignment[]>(initialAssignments)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [stuckModalOpen, setStuckModalOpen] = useState(false)
  const [stuckReason, setStuckReason] = useState('')
  const [completeModalDocId, setCompleteModalDocId] = useState<string | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: { url: string; label: string }[]; index: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [dragState, setDragState] = useState<{ dragId: string | null; overId: string | null; position: 'above' | 'below' | null }>({ dragId: null, overId: null, position: null })
  const [search, setSearch] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const catMap = useMemo(() => {
    const m: Record<string, CategoryData> = {}
    for (const c of categoriesData) m[c.category_key] = c
    return m
  }, [categoriesData])

  // Group docs by stage
  const columns = useMemo(() => {
    const map: Record<string, ProductionDocument[]> = {}
    for (const s of STAGES) map[s.key] = []

    const filtered = search
      ? docs.filter(d => {
          const q = search.toLowerCase()
          return (d.doc_number || '').toLowerCase().includes(q) ||
                 (d.customer_name || '').toLowerCase().includes(q) ||
                 (d.vehicle_description || '').toLowerCase().includes(q) ||
                 (d.project_description || '').toLowerCase().includes(q)
        })
      : docs

    for (const d of filtered) {
      const stage = d.production_stage || 'QUEUE'
      if (map[stage]) map[stage].push(d)
      else map['QUEUE'].push(d)
    }

    // Sort each column by production_sort_order, then due_date
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if ((a.production_sort_order || 0) !== (b.production_sort_order || 0))
          return (a.production_sort_order || 0) - (b.production_sort_order || 0)
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        if (a.due_date) return -1
        if (b.due_date) return 1
        return 0
      })
    }
    return map
  }, [docs, search])

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

    setDocs(ds => ds.map(d => d.id === docId ? { ...d, production_stage: newStage } : d))

    const updates: Record<string, any> = { production_stage: newStage }
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

  // Drag-and-drop: reorder within columns AND move between columns
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, docId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragState({ dragId: docId, overId: null, position: null })
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragState.dragId || dragState.dragId === targetId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'above' : 'below'
    setDragState(prev => ({ ...prev, overId: targetId, position: pos }))
  }

  const handleColumnDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault()
    if (!dragState.dragId) return
    setDragOverColumn(stageKey)
  }

  const handleColumnDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string | null, stageKey: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    const { dragId, position } = dragState
    if (!dragId) { setDragState({ dragId: null, overId: null, position: null }); return }

    const dragDoc = docs.find(d => d.id === dragId)
    if (!dragDoc) { setDragState({ dragId: null, overId: null, position: null }); return }

    const fromStage = dragDoc.production_stage || 'QUEUE'
    const toStage = stageKey
    const isCrossColumn = fromStage !== toStage

    if (isCrossColumn) {
      setDragState({ dragId: null, overId: null, position: null })

      // If dragging to COMPLETE, show the notification prompt
      if (toStage === 'COMPLETE') {
        setCompleteModalDocId(dragId)
        return
      }

      // Move to different column
      setDocs(ds => ds.map(d => d.id === dragId ? { ...d, production_stage: toStage, production_sort_order: 0 } : d))

      const updates: Record<string, any> = { production_stage: toStage, production_sort_order: 0 }
      if (fromStage === 'COMPLETE' && toStage !== 'COMPLETE') updates.in_production = true

      try {
        const res = await fetch(`/api/documents/${dragId}/production-status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          setDocs(ds => ds.map(d => d.id === dragId ? dragDoc : d))
          showToast('Failed to move job', 'error')
        }
      } catch {
        setDocs(ds => ds.map(d => d.id === dragId ? dragDoc : d))
        showToast('Network error', 'error')
      }
      return
    }

    // Same column reorder
    if (!targetId || dragId === targetId || !position) {
      setDragState({ dragId: null, overId: null, position: null })
      return
    }

    const col = [...(columns[stageKey] || [])]
    const fromIdx = col.findIndex(d => d.id === dragId)
    const toIdx = col.findIndex(d => d.id === targetId)
    if (fromIdx === -1 || toIdx === -1) {
      setDragState({ dragId: null, overId: null, position: null })
      return
    }

    col.splice(fromIdx, 1)
    const insertIdx = position === 'above' ? col.findIndex(d => d.id === targetId) : col.findIndex(d => d.id === targetId) + 1
    col.splice(insertIdx, 0, dragDoc)

    const sortUpdates = col.map((d, i) => ({ id: d.id, sort: i + 1 }))
    setDocs(ds => ds.map(d => {
      const u = sortUpdates.find(u => u.id === d.id)
      return u ? { ...d, production_sort_order: u.sort } : d
    }))

    setDragState({ dragId: null, overId: null, position: null })

    for (const u of sortUpdates) {
      fetch(`/api/documents/${u.id}/production-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production_sort_order: u.sort }),
      }).catch(() => {})
    }
  }

  const handleDragEnd = () => {
    setDragState({ dragId: null, overId: null, position: null })
    setDragOverColumn(null)
  }

  // Popover positioning
  const openPopover = useCallback((docId: string, cardEl: HTMLElement) => {
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
    setSelectedId(docId)
    setPopoverVisible(true)
    setAssignModalOpen(false)
    setStuckModalOpen(false)
  }, [])

  const closePopover = () => {
    setPopoverVisible(false)
    setSelectedId(null)
    setAssignModalOpen(false)
    setStuckModalOpen(false)
  }

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!popoverVisible) return
      const target = e.target as HTMLElement
      if (popoverRef.current?.contains(target)) return
      if (target.closest('[data-card-id]')) return
      // Don't close popover if clicking inside a modal overlay
      if (target.closest('[data-modal]')) return
      closePopover()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null)
        else closePopover()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [popoverVisible, lightbox])

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
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
            FWG <span style={{ backgroundImage: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Production</span>
          </h1>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 14px', paddingRight: search ? 30 : 14, background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', width: 220 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(148,163,184,0.15)', border: 'none', color: '#94a3b8', width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}>×</button>
            )}
          </div>
        </div>

        {/* Stats + Metrics */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Overview metrics */}
          {(() => {
            const totalActive = docs.filter(d => d.production_stage !== 'COMPLETE').length
            const stuckCount = docs.filter(d => d.production_stuck).length
            const overdueCount = docs.filter(d => {
              if (!d.due_date || d.production_stage === 'COMPLETE') return false
              const due = new Date(d.due_date + 'T00:00:00'); const now = new Date(); now.setHours(0, 0, 0, 0)
              return due < now
            }).length
            const completedThisWeek = docs.filter(d => {
              if (d.production_stage !== 'COMPLETE') return false
              const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
              return true // All complete jobs count for now
            }).length

            return (
              <>
                <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 700 }}>
                  {totalActive} Active
                </div>
                {stuckCount > 0 && (
                  <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700 }}>
                    {stuckCount} Stuck
                  </div>
                )}
                {overdueCount > 0 && (
                  <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontWeight: 700 }}>
                    {overdueCount} Overdue
                  </div>
                )}
                <div style={{ width: 1, height: 20, background: 'rgba(148,163,184,0.15)' }} />
              </>
            )
          })()}
          {STAGES.filter(s => s.key !== 'COMPLETE').map(s => {
            const count = columns[s.key]?.length || 0
            return (
              <div key={s.key} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dotColor, display: 'inline-block' }} />
                <span style={{ fontWeight: 700, color: '#94a3b8' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Board */}
      <div ref={boardRef} style={{ display: 'flex', gap: 10, padding: '12px 16px', flex: 1, overflow: 'auto' }}>
        {STAGES.map(stage => (
          <div key={stage.key} style={{
            flex: stage.key === 'COMPLETE' ? '0 0 220px' : 1,
            minWidth: 210,
            display: 'flex', flexDirection: 'column',
            borderRadius: 10,
            background: '#111111',
            opacity: stage.key === 'COMPLETE' ? 0.7 : 1,
            overflow: 'hidden',
          }}>
            {/* Column header */}
            <div style={{
              padding: '12px 14px', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(148,163,184,0.1)', color: '#94a3b8',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.dotColor, display: 'inline-block' }} />
              {stage.label}
              <span style={{ marginLeft: 'auto', background: '#1a1a1a', padding: '2px 8px', borderRadius: 6, fontSize: 11, color: '#94a3b8' }}>
                {columns[stage.key]?.length || 0}
              </span>
            </div>

            {/* Cards */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
              border: dragOverColumn === stage.key && dragState.dragId && !(columns[stage.key] || []).find(d => d.id === dragState.dragId)
                ? '2px dashed rgba(34,211,238,0.5)' : '2px dashed transparent',
              borderRadius: 6,
              transition: 'border-color 0.15s',
              minHeight: 60,
            }}
              onDragOver={e => { handleColumnDragOver(e, stage.key) }}
              onDragLeave={handleColumnDragLeave}
              onDrop={e => { if (!dragState.overId || !columns[stage.key]?.find(d => d.id === dragState.overId)) handleDrop(e, null, stage.key) }}
            >
              {(columns[stage.key] || []).map(doc => {
                const catColor = getDocCategoryColor(doc, catMap)
                const duePill = getDuePill(doc.due_date)
                const nextStage = getNextStage(stage.key)
                const isSelected = selectedId === doc.id
                const isDragging = dragState.dragId === doc.id
                const isOver = dragState.overId === doc.id
                const docAssignees = getAssignmentsForDoc(doc.id)
                const docLeader = teamMembers.find(tm => tm.id === doc.production_leader_id)

                return (
                  <div key={doc.id}>
                    {/* Insertion line above */}
                    {isOver && dragState.position === 'above' && (
                      <div style={{ height: 3, background: '#22d3ee', borderRadius: 2, marginBottom: 4 }} />
                    )}
                    <div
                      data-card-id={doc.id}
                      draggable
                      onDragStart={e => handleDragStart(e, doc.id)}
                      onDragOver={e => handleDragOver(e, doc.id)}
                      onDrop={e => handleDrop(e, doc.id, stage.key)}
                      onDragEnd={handleDragEnd}
                      onClick={e => {
                        if ((e.target as HTMLElement).closest('.move-btn')) return
                        const card = e.currentTarget
                        if (isSelected) { closePopover(); return }
                        openPopover(doc.id, card)
                      }}
                      style={{
                        background: '#1a1a1a',
                        borderRadius: 10,
                        padding: 12,
                        cursor: 'pointer',
                        borderTop: doc.production_stuck ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
                        borderRight: doc.production_stuck ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
                        borderBottom: doc.production_stuck ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
                        borderLeft: `4px solid ${doc.production_stuck ? '#ef4444' : catColor}`,
                        boxShadow: doc.production_stuck
                          ? '0 0 12px rgba(239,68,68,0.3)'
                          : isSelected ? '0 0 12px rgba(34,211,238,0.3)' : 'none',
                        opacity: isDragging ? 0.4 : 1,
                        transition: 'box-shadow 0.15s, opacity 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{doc.doc_number}</span>
                          {doc.production_stuck && (
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stuck</span>
                          )}
                        </div>
                        {duePill && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: duePill.bg, color: duePill.color }}>
                            {duePill.text}
                          </span>
                        )}
                      </div>

                      {/* Customer name */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.customer_name}
                      </div>

                      {/* Description */}
                      <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                        {doc.vehicle_description || doc.project_description || '—'}
                      </div>

                      {/* Stuck reason on card */}
                      {doc.production_stuck && doc.production_stuck_reason && (
                        <div style={{ fontSize: 10, color: '#f87171', marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          ⚠ {doc.production_stuck_reason}
                        </div>
                      )}

                      {/* Target date */}
                      {doc.production_target_date && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11 }}>🎯</span>
                          Finish by {formatDate(doc.production_target_date)}
                        </div>
                      )}

                      {/* Team assignments */}
                      {(docAssignees.length > 0 || docLeader) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                          {docLeader && (
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${docLeader.color}20`, color: docLeader.color, fontWeight: 700, border: `1px solid ${docLeader.color}40` }}>
                              ★ {docLeader.short_name || docLeader.name}
                            </span>
                          )}
                          {docAssignees.filter(a => a.id !== doc.production_leader_id).map(member => (
                            <span key={member.id} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${member.color}15`, color: member.color, fontWeight: 600 }}>
                              {member.short_name || member.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Move button */}
                      {nextStage && (
                        <button
                          className="move-btn"
                          onClick={e => {
                            e.stopPropagation()
                            moveToStage(doc.id, nextStage)
                          }}
                          style={{
                            width: '100%', padding: 6, border: 'none', borderRadius: 6,
                            background: '#22d3ee', color: '#000', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#0ea5e9' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#22d3ee' }}
                        >
                          Move to {getStageLabel(nextStage)} →
                        </button>
                      )}
                    </div>
                    {/* Insertion line below */}
                    {isOver && dragState.position === 'below' && (
                      <div style={{ height: 3, background: '#22d3ee', borderRadius: 2, marginTop: 4 }} />
                    )}
                  </div>
                )
              })}

              {/* Empty state */}
              {(columns[stage.key] || []).length === 0 && (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#475569', fontSize: 12 }}>
                  No jobs
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{selectedDoc.customer_name}</div>
                {selectedDoc.company_name && (
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{selectedDoc.company_name}</div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 600 }}>{selectedDoc.doc_number}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: selectedDoc.balance_due && selectedDoc.balance_due > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: selectedDoc.balance_due && selectedDoc.balance_due > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                    {selectedDoc.balance_due && selectedDoc.balance_due > 0 ? `$${Number(selectedDoc.balance_due).toFixed(0)} due` : 'PAID'}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${STAGES.find(s => s.key === (selectedDoc.production_stage || 'QUEUE'))?.color || '#64748b'}20`, color: STAGES.find(s => s.key === (selectedDoc.production_stage || 'QUEUE'))?.color || '#64748b', fontWeight: 600 }}>
                    {getStageLabel(selectedDoc.production_stage || 'QUEUE')}
                  </span>
                </div>
              </div>
              <button onClick={closePopover} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: 16, width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
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
              <button
                onClick={() => {
                  if (selectedDoc.production_stuck) {
                    // Unstick
                    setDocs(ds => ds.map(d => d.id === selectedDoc.id ? { ...d, production_stuck: false, production_stuck_reason: undefined } : d))
                    fetch(`/api/documents/${selectedDoc.id}/production-status`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ production_stuck: false, production_stuck_reason: null }),
                    })
                  } else {
                    setStuckReason('')
                    setStuckModalOpen(true)
                  }
                }}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  background: selectedDoc.production_stuck ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.06)',
                  border: selectedDoc.production_stuck ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.2)',
                  color: selectedDoc.production_stuck ? '#f87171' : '#ef4444',
                  transition: 'all 0.15s',
                }}
              >
                {selectedDoc.production_stuck ? '✓ Unstick' : '⚠ Mark Stuck'}
              </button>
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

            {/* Vehicle / project */}
            {(selectedDoc.vehicle_description || selectedDoc.project_description) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
                  {selectedDoc.vehicle_description || selectedDoc.project_description}
                </div>
                {selectedDoc.vehicle_description && selectedDoc.project_description && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedDoc.project_description}</div>
                )}
              </div>
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

            {/* Stuck reason display */}
            {selectedDoc.production_stuck && selectedDoc.production_stuck_reason && (
              <div style={{ marginBottom: 14, padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: 10, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>⚠ Stuck Reason</div>
                <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>{selectedDoc.production_stuck_reason}</div>
              </div>
            )}

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
      {/* STUCK REASON MODAL                                             */}
      {/* ============================================================= */}
      {stuckModalOpen && selectedDoc && (
        <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setStuckModalOpen(false) }}>
          <div style={{ background: '#111111', borderRadius: 16, padding: '24px', width: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>⚠ Mark as Stuck</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>What&apos;s holding up this job?</p>
            <input
              value={stuckReason}
              onChange={e => setStuckReason(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && stuckReason.trim()) {
                  setDocs(ds => ds.map(d => d.id === selectedDoc.id ? { ...d, production_stuck: true, production_stuck_reason: stuckReason.trim() } : d))
                  fetch(`/api/documents/${selectedDoc.id}/production-status`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ production_stuck: true, production_stuck_reason: stuckReason.trim() }),
                  })
                  setStuckModalOpen(false)
                }
              }}
              placeholder="e.g., Waiting on customer approval, material backordered..."
              autoFocus
              style={{ width: '100%', padding: '10px 14px', background: '#111', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setStuckModalOpen(false)} style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  if (!stuckReason.trim()) return
                  setDocs(ds => ds.map(d => d.id === selectedDoc.id ? { ...d, production_stuck: true, production_stuck_reason: stuckReason.trim() } : d))
                  fetch(`/api/documents/${selectedDoc.id}/production-status`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ production_stuck: true, production_stuck_reason: stuckReason.trim() }),
                  })
                  setStuckModalOpen(false)
                }}
                disabled={!stuckReason.trim()}
                style={{ padding: '8px 18px', borderRadius: 8, background: stuckReason.trim() ? '#ef4444' : '#333', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: stuckReason.trim() ? 'pointer' : 'default' }}
              >Mark Stuck</button>
            </div>
          </div>
        </div>
      )}

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
      {/* LIGHTBOX                                                       */}
      {/* ============================================================= */}
      {lightbox && (
        <LightboxOverlay lightbox={lightbox} setLightbox={setLightbox} />
      )}
    </div>
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
