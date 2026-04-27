'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DailyPlanLightbox from './DailyPlanLightbox'
import type { DailyTask, TeamMember, DocSummary, LineItemFull, PaymentLite, CategoryLite, PipelineConfig, ProductionStatusLite } from './types'

// ============================================================================
// Helpers
// ============================================================================

function isImageAttachment(att: any): boolean {
  const url = att?.url || att?.file_url || ''
  const name = att?.filename || att?.name || ''
  const ct = att?.contentType || att?.type || att?.mime_type || ''
  return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
}
function attUrl(att: any): string { return att?.url || att?.file_url || '' }
function attName(att: any): string { return att?.label || att?.name || att?.filename || att?.file_name || 'File' }

function formatMoney(n: number | string | null | undefined): string {
  const v = parseFloat(String(n || 0))
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatDateChip(iso: string): string {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (iso === todayStr) return 'Today'
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (iso === tomorrowStr) return 'Tomorrow'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================================
// Sidebar component
// ============================================================================

export default function DailyPlanProjectSidebar({
  doc, allTasks, assigneesByTask, teamMembers, lineItems, payments, categories, pipelineConfigs, productionStatuses,
  onClose, onCreateTask, onUpdateTask, onDeleteTask, onToggleAssignee, onToggleDone, showToast,
}: {
  doc: DocSummary
  allTasks: DailyTask[]
  assigneesByTask: Record<string, TeamMember[]>
  teamMembers: TeamMember[]
  lineItems: LineItemFull[]
  payments: PaymentLite[]
  categories: CategoryLite[]
  pipelineConfigs: PipelineConfig[]
  productionStatuses: ProductionStatusLite[]
  onClose: () => void
  onCreateTask: (title: string) => Promise<DailyTask | null>
  onUpdateTask: (id: string, patch: Partial<DailyTask>) => void
  onDeleteTask: (id: string) => void
  onToggleAssignee: (taskId: string, memberId: string) => void
  onToggleDone: (taskId: string) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [customDraft, setCustomDraft] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const projectTasks = useMemo(() => allTasks
    .filter(t => t.parent_document_id === doc.id)
    .sort((a, b) => a.sort_order - b.sort_order), [allTasks, doc.id])
  const open = projectTasks.filter(t => t.status === 'TODO')
  const done = projectTasks.filter(t => t.status === 'DONE')

  const stage = doc.production_stage || 'QUEUE'
  const stageColors: Record<string, string> = {
    QUEUE: '#94a3b8', DESIGN: '#c4b5fd', PRINT: '#60a5fa', PRODUCTION: '#2dd4bf', COMPLETE: '#4ade80',
  }
  const stageColor = stageColors[stage] || '#94a3b8'
  const cur = doc.production_status_id ? productionStatuses.find(s => s.id === doc.production_status_id) : null

  // Nested DndContext for drag-reordering project tasks (isolated from the
  // page-level Daily Plan drag system).
  const sidebarSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onProjectTaskDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    const oldIdx = open.findIndex(t => t.id === activeId)
    const newIdx = open.findIndex(t => t.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(open, oldIdx, newIdx)
    reordered.forEach((t, i) => {
      const newSort = (i + 1) * 10
      if (t.sort_order !== newSort) onUpdateTask(t.id, { sort_order: newSort })
    })
  }

  const submitCustom = async () => {
    if (!customDraft.trim()) return
    await onCreateTask(customDraft.trim())
    setCustomDraft('')
  }

  // Build a FLAT mockup list so the lightbox can navigate prev/next, and an
  // index map keyed by line_item_id so per-line-item rendering still works.
  const { allMockups, lineItemMockupIndices } = useMemo(() => {
    const flat: { url: string; label: string }[] = []
    const idx: Record<string, number[]> = {}
    for (const li of lineItems) {
      for (const att of (li.attachments || []) as any[]) {
        if (isImageAttachment(att) && attUrl(att)) {
          const i = flat.length
          flat.push({ url: attUrl(att), label: attName(att) })
          if (!idx[li.id]) idx[li.id] = []
          idx[li.id].push(i)
        }
      }
    }
    return { allMockups: flat, lineItemMockupIndices: idx }
  }, [lineItems])

  // Production files = non-image attachments at doc level + line item level
  const productionFiles = useMemo(() => {
    const out: { url: string; label: string; lineItemId?: string }[] = []
    for (const li of lineItems) {
      for (const att of (li.attachments || []) as any[]) {
        if (!isImageAttachment(att) && attUrl(att)) out.push({ url: attUrl(att), label: attName(att), lineItemId: li.id })
      }
    }
    for (const att of (doc.attachments || []) as any[]) {
      if (!isImageAttachment(att) && attUrl(att)) out.push({ url: attUrl(att), label: attName(att) })
    }
    return out
  }, [lineItems, doc.attachments])

  // Internal notes: doc.notes — try to parse as JSON array of {author, text, at}
  const internalNotes = useMemo(() => {
    if (!doc.notes) return []
    try {
      const parsed = typeof doc.notes === 'string' ? JSON.parse(doc.notes) : doc.notes
      if (Array.isArray(parsed)) return parsed
      return []
    } catch { return [] }
  }, [doc.notes])

  const fulfillmentLabel = (() => {
    const t = doc.fulfillment_type
    if (!t) return '—'
    return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  })()

  return (
    <div data-modal style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 'min(680px, 70vw)', height: '100%', background: '#0d0d0d',
        boxShadow: '-12px 0 32px rgba(0,0,0,0.5)', overflowY: 'auto',
        animation: 'slideIn 0.22s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header — sticky */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(148,163,184,0.08)', position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: 2 }}>
                {doc.vehicle_description || doc.project_description || '—'}
              </div>
              {doc.company_name && (
                <div style={{ fontSize: 14, fontWeight: 600, color: '#cbd5e1', marginBottom: 1 }}>{doc.company_name}</div>
              )}
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{doc.customer_name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 600 }}>{doc.doc_number}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: doc.balance_due && doc.balance_due > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: doc.balance_due && doc.balance_due > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                  {doc.balance_due && doc.balance_due > 0 ? `${formatMoney(doc.balance_due)} due` : 'PAID'}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${stageColor}20`, color: stageColor, fontWeight: 600 }}>{stage}</span>
                {cur && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${cur.color}22`, color: cur.color, fontWeight: 600 }}>● {cur.label}</span>
                )}
              </div>
              {doc.production_status_note && (
                <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#fca5a5' }}>
                  ⚑ {doc.production_status_note}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
              <button onClick={onClose} style={{ background: 'rgba(148,163,184,0.1)', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
              <a href={`/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: 7, background: '#22d3ee', color: '#000', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                Open editor ↗
              </a>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px 30px' }}>

          {/* === PROJECT INFO grid === */}
          <SectionLabel>Project info</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <InfoField label="Subject / Vehicle" value={doc.vehicle_description} />
            <InfoField label="Project Description" value={doc.project_description} />
            <InfoField label="Customer Name" value={doc.customer_name} />
            <InfoField label="Company" value={doc.company_name} />
            <InfoField label="Email" value={doc.customer_email}
              renderValue={v => v ? <a href={`mailto:${v}`} style={{ color: '#22d3ee', textDecoration: 'none' }}>{v}</a> : null} />
            <InfoField label="Phone" value={doc.customer_phone}
              renderValue={v => v ? <a href={`tel:${v}`} style={{ color: '#22d3ee', textDecoration: 'none' }}>{v}</a> : null} />
            <InfoField label="Due Date" value={doc.due_date} renderValue={v => v ? formatDate(v) : null} />
            <InfoField label="Fulfillment Method" value={fulfillmentLabel} />
          </div>

          {/* === LINE ITEMS === */}
          {lineItems.length > 0 && (
            <>
              <SectionLabel>Line items ({lineItems.length})</SectionLabel>
              <div style={{ marginBottom: 16 }}>
                {lineItems.map(li => {
                  const cat = categories.find(c => c.category_key === li.category)
                  const mockupIndices = lineItemMockupIndices[li.id] || []
                  const mockups = mockupIndices.map(i => ({ ...allMockups[i], idx: i }))
                  return (
                    <div key={li.id} style={{ padding: '10px 12px', background: '#131313', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: mockups.length > 0 ? 8 : 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(168,85,247,0.12)', color: '#c4b5fd', fontWeight: 700 }}>
                              {cat?.label || li.category?.replace(/_/g, ' ') || '—'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{li.description || '—'}</div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Qty {li.quantity ?? 1}</div>
                          <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 700 }}>{formatMoney(li.line_total)}</div>
                        </div>
                      </div>
                      {/* Per-line mockups — full width stacked, click opens lightbox */}
                      {mockups.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                          {mockups.map((m) => (
                            <button
                              key={m.idx}
                              onClick={() => setLightboxIdx(m.idx)}
                              style={{ width: '100%', borderRadius: 8, overflow: 'hidden', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.08)', cursor: 'zoom-in', display: 'block', padding: 0 }}
                            >
                              <img src={m.url} alt={m.label} style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* === PRODUCTION FILES === */}
          {productionFiles.length > 0 && (
            <>
              <SectionLabel>Production files ({productionFiles.length})</SectionLabel>
              <div style={{ marginBottom: 16 }}>
                {productionFiles.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#131313', borderRadius: 7, marginBottom: 4, border: '1px solid rgba(148,163,184,0.06)', textDecoration: 'none' }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>↗</span>
                  </a>
                ))}
              </div>
            </>
          )}

          {/* === PAYMENTS === */}
          {payments.length > 0 && (
            <>
              <SectionLabel>Payments ({payments.length})</SectionLabel>
              <div style={{ marginBottom: 16 }}>
                {payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#131313', borderRadius: 7, marginBottom: 4, border: '1px solid rgba(148,163,184,0.06)' }}>
                    <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>{formatMoney(p.amount)}</span>
                    {p.method && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 600 }}>{p.method.toUpperCase()}</span>}
                    {p.status && p.status !== 'completed' && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontWeight: 600 }}>{p.status}</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>{formatDate(p.created_at)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === INTERNAL NOTES === */}
          <SectionLabel>Internal notes</SectionLabel>
          <div style={{ marginBottom: 16 }}>
            {internalNotes.length === 0 && (
              <div style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>No notes yet — add them from the editor.</div>
            )}
            {internalNotes.slice().reverse().map((n: any, i: number) => (
              <div key={i} style={{ padding: '7px 10px', background: '#131313', borderRadius: 7, marginBottom: 4, borderLeft: '2px solid rgba(148,163,184,0.3)' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                  <strong style={{ color: '#94a3b8' }}>{n.author || '—'}</strong>{n.at ? ` · ${formatDate(n.at)}` : ''}
                </div>
                <div style={{ fontSize: 12, color: '#e2e8f0' }}>{n.text || ''}</div>
              </div>
            ))}
          </div>

          {/* === PROJECT TASKS === */}
          <SectionLabel>
            Project tasks <span style={{ fontWeight: 500, color: '#64748b', fontSize: 10, letterSpacing: 0, marginLeft: 6 }}>{open.length} open · drag the "next up" pill on the project card to schedule</span>
          </SectionLabel>

          {open.length === 0 && (
            <div style={{ padding: '14px 12px', textAlign: 'center', color: '#475569', fontSize: 12, fontStyle: 'italic', border: '1px dashed rgba(148,163,184,0.12)', borderRadius: 8 }}>
              No project tasks yet. Use "Add from template" below or type a custom one.
            </div>
          )}

          <DndContext sensors={sidebarSensors} collisionDetection={closestCenter} onDragEnd={onProjectTaskDragEnd}>
            <SortableContext items={open.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {open.map((t, i) => {
                const ass = assigneesByTask[t.id] || []
                const isNextUp = !t.scheduled_date && i === open.findIndex(x => !x.scheduled_date)
                return (
                  <SortableProjectTaskRow
                    key={t.id}
                    task={t}
                    assignees={ass}
                    teamMembers={teamMembers}
                    isNextUp={isNextUp}
                    onChangeTitle={(title) => onUpdateTask(t.id, { title })}
                    onChangeDate={(date) => onUpdateTask(t.id, { scheduled_date: date })}
                    onTogglePriority={() => onUpdateTask(t.id, { is_priority: !t.is_priority })}
                    onToggleAssignee={(memberId) => onToggleAssignee(t.id, memberId)}
                    onToggleDone={() => onToggleDone(t.id)}
                    onDelete={() => onDeleteTask(t.id)}
                  />
                )
              })}
            </SortableContext>
          </DndContext>

          {/* Custom inline add */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              type="text"
              value={customDraft}
              onChange={e => setCustomDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCustom() }}
              placeholder='Add a custom task to this project…'
              style={{ flex: 1, padding: '8px 12px', background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, color: '#f1f5f9', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={submitCustom} disabled={!customDraft.trim()} style={{ padding: '8px 14px', borderRadius: 7, background: customDraft.trim() ? '#22d3ee' : '#222', border: 'none', color: customDraft.trim() ? '#000' : '#666', fontSize: 12, fontWeight: 600, cursor: customDraft.trim() ? 'pointer' : 'default' }}>+ Add</button>
          </div>

          {/* Add from template toggle */}
          <button
            onClick={() => setShowTemplates(v => !v)}
            style={{ marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {showTemplates ? '▴ Hide template tasks' : '▾ Add from template'}
          </button>

          {/* Inline template panel */}
          {showTemplates && (
            <TemplateInlinePanel
              lineItems={lineItems}
              categories={categories}
              pipelineConfigs={pipelineConfigs}
              existingTitles={new Set(open.map(t => t.title.toLowerCase()))}
              onAddTask={async (title) => {
                await onCreateTask(title)
                showToast(`Added "${title}"`)
              }}
            />
          )}

          {/* === DONE === */}
          {done.length > 0 && (
            <>
              <SectionLabel style={{ marginTop: 22 }}>Completed ({done.length})</SectionLabel>
              {done.map(t => (
                <div key={t.id} style={{ padding: '7px 11px', borderRadius: 7, marginBottom: 3, background: '#0d0d0d', fontSize: 12, color: '#64748b', textDecoration: 'line-through', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#22c55e' }}>✓</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx != null && allMockups[lightboxIdx] && (
        <DailyPlanLightbox
          url={allMockups[lightboxIdx].url}
          label={allMockups[lightboxIdx].label}
          index={lightboxIdx}
          count={allMockups.length}
          onClose={() => setLightboxIdx(null)}
          onPrev={allMockups.length > 1 ? () => setLightboxIdx(i => (i! - 1 + allMockups.length) % allMockups.length) : undefined}
          onNext={allMockups.length > 1 ? () => setLightboxIdx(i => (i! + 1) % allMockups.length) : undefined}
        />
      )}
    </div>
  )
}

// ============================================================================
// Helper sub-components
// ============================================================================

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, letterSpacing: 1.5, ...style }}>
      {children}
    </div>
  )
}

function InfoField({ label, value, renderValue }: {
  label: string
  value?: string | null
  renderValue?: (v: string) => React.ReactNode
}) {
  const display = value ? (renderValue ? renderValue(value) : value) : '—'
  return (
    <div>
      <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: value ? '#e2e8f0' : '#475569', fontStyle: value ? 'normal' : 'italic' }}>
        {display || '—'}
      </div>
    </div>
  )
}

// ============================================================================
// Sortable project task row — drag handle on the left
// ============================================================================
function SortableProjectTaskRow({ task, assignees, teamMembers, isNextUp, onChangeTitle, onChangeDate, onTogglePriority, onToggleAssignee, onToggleDone, onDelete }: {
  task: DailyTask
  assignees: TeamMember[]
  teamMembers: TeamMember[]
  isNextUp: boolean
  onChangeTitle: (title: string) => void
  onChangeDate: (date: string | null) => void
  onTogglePriority: () => void
  onToggleAssignee: (memberId: string) => void
  onToggleDone: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    transition: { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  const [assignMenuOpen, setAssignMenuOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assignMenuOpen) return
    const handler = (e: MouseEvent) => { if (!assignRef.current?.contains(e.target as Node)) setAssignMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [assignMenuOpen])
  useEffect(() => {
    if (!datePickerOpen) return
    const handler = (e: MouseEvent) => { if (!dateRef.current?.contains(e.target as Node)) setDatePickerOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [datePickerOpen])

  const assignedIds = new Set(assignees.map(a => a.id))

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    visibility: isDragging ? 'hidden' : 'visible',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 11px',
    borderRadius: 8,
    marginBottom: 5,
    background: '#131313',
    border: isNextUp ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(148,163,184,0.06)',
    borderLeft: task.is_priority ? '3px solid #fb923c' : (isNextUp ? '3px solid #22d3ee' : undefined),
  }

  const stopAll = (e: React.SyntheticEvent) => { e.stopPropagation() }

  return (
    <div ref={setNodeRef} suppressHydrationWarning style={style}>
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{
          cursor: 'grab', padding: '2px 4px', color: '#475569',
          fontSize: 14, lineHeight: 1, userSelect: 'none', flexShrink: 0,
        }}
      >⋮⋮</div>

      {/* Complete checkbox */}
      <button
        onClick={(e) => { stopAll(e); onToggleDone() }}
        onPointerDown={e => e.stopPropagation()}
        title={task.status === 'DONE' ? 'Reopen' : 'Mark complete'}
        style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: '2px solid ' + (task.status === 'DONE' ? '#22c55e' : 'rgba(148,163,184,0.4)'),
          background: task.status === 'DONE' ? '#22c55e' : 'transparent',
          color: '#0d2317',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
          padding: 0,
          fontFamily: 'inherit',
        }}
      >{task.status === 'DONE' ? '✓' : ''}</button>

      <input
        type="text"
        value={task.title}
        onChange={e => onChangeTitle(e.target.value)}
        onPointerDown={e => e.stopPropagation()}
        style={{
          flex: 1, background: 'transparent', border: 'none',
          color: task.status === 'DONE' ? '#64748b' : '#e2e8f0',
          textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
          fontSize: 13, outline: 'none', padding: 0, fontFamily: 'inherit', minWidth: 80,
        }}
      />

      {isNextUp && (
        <span title="Next up on the project card" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', fontWeight: 700, flexShrink: 0 }}>↑ Next up</span>
      )}

      {/* Date picker button */}
      <div ref={dateRef} style={{ position: 'relative', flexShrink: 0 }} onPointerDown={e => e.stopPropagation()}>
        <button
          onClick={(e) => { stopAll(e); setDatePickerOpen(v => !v) }}
          title="Set scheduled date"
          style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
            background: task.scheduled_date ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.06)',
            border: task.scheduled_date ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(148,163,184,0.15)',
            color: task.scheduled_date ? '#4ade80' : '#94a3b8',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {task.scheduled_date ? formatDateChip(task.scheduled_date) : '+ date'}
        </button>
        {datePickerOpen && (
          <div onClick={stopAll} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: 8, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            <input
              type="date"
              value={task.scheduled_date || ''}
              onChange={e => { onChangeDate(e.target.value || null); setDatePickerOpen(false) }}
              autoFocus
              style={{ padding: '6px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 6, color: '#f1f5f9', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            {task.scheduled_date && (
              <button
                onClick={() => { onChangeDate(null); setDatePickerOpen(false) }}
                style={{ marginLeft: 6, padding: '5px 9px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >Clear</button>
            )}
          </div>
        )}
      </div>

      {/* Assignees */}
      {assignees.slice(0, 1).map(a => (
        <span key={a.id} title={a.name} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${a.color}20`, color: a.color, fontWeight: 700, flexShrink: 0 }}>
          {a.short_name || a.name.split(' ')[0]}
        </span>
      ))}
      {assignees.length > 1 && (
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>+{assignees.length - 1}</span>
      )}
      <div ref={assignRef} style={{ position: 'relative', flexShrink: 0 }} onPointerDown={e => e.stopPropagation()}>
        <button
          onClick={(e) => { stopAll(e); setAssignMenuOpen(v => !v) }}
          title="Assign people"
          style={{
            width: 22, height: 22, borderRadius: 4,
            background: 'rgba(148,163,184,0.06)',
            border: '1px solid rgba(148,163,184,0.15)',
            color: '#94a3b8',
            cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >+</button>
        {assignMenuOpen && (
          <div onClick={stopAll} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 140, padding: 4 }}>
            {teamMembers.map(m => {
              const isAssigned = assignedIds.has(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => onToggleAssignee(m.id)}
                  style={{
                    width: '100%', padding: '5px 8px', textAlign: 'left',
                    background: isAssigned ? `${m.color}20` : 'transparent',
                    border: 'none', borderRadius: 5, cursor: 'pointer',
                    color: isAssigned ? m.color : '#cbd5e1',
                    fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                  <span style={{ flex: 1 }}>{m.short_name || m.name}</span>
                  {isAssigned && <span style={{ fontSize: 9 }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Priority toggle */}
      <button
        onClick={(e) => { stopAll(e); onTogglePriority() }}
        onPointerDown={e => e.stopPropagation()}
        title={task.is_priority ? 'Remove priority' : 'Make priority'}
        style={{
          width: 22, height: 22, borderRadius: 4,
          background: task.is_priority ? 'rgba(251,146,60,0.18)' : 'rgba(148,163,184,0.06)',
          border: task.is_priority ? '1px solid rgba(251,146,60,0.4)' : '1px solid rgba(148,163,184,0.12)',
          color: task.is_priority ? '#fb923c' : '#475569',
          cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >🔥</button>

      <button
        onClick={onDelete}
        onPointerDown={e => e.stopPropagation()}
        style={{ background: 'rgba(239,68,68,0.06)', border: 'none', color: '#ef4444', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 12, padding: 0, flexShrink: 0 }}
      >×</button>
    </div>
  )
}

// ============================================================================
// Template inline panel (Joey's spec: appears below tasks list, drag or click + to add)
// ============================================================================

function TemplateInlinePanel({
  lineItems, categories, pipelineConfigs, existingTitles, onAddTask,
}: {
  lineItems: LineItemFull[]
  categories: CategoryLite[]
  pipelineConfigs: PipelineConfig[]
  existingTitles: Set<string>
  onAddTask: (title: string) => void
}) {
  const groups = useMemo(() => {
    const usedCategories = Array.from(new Set(lineItems.map(li => li.category).filter(Boolean)))
    return usedCategories.map(catKey => {
      const cat = categories.find(c => c.category_key === catKey)
      const tasksForCat = pipelineConfigs.filter(pc => pc.category_key === catKey)
      const liCount = lineItems.filter(li => li.category === catKey).length
      return {
        categoryKey: catKey,
        categoryLabel: cat?.label || catKey.replace(/_/g, ' '),
        liCount,
        tasks: tasksForCat,
      }
    }).filter(g => g.tasks.length > 0)
  }, [lineItems, categories, pipelineConfigs])

  if (groups.length === 0) {
    return (
      <div style={{ marginTop: 10, padding: 14, background: '#0d0d0d', borderRadius: 8, border: '1px dashed rgba(148,163,184,0.15)', textAlign: 'center', color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>
        No template tasks for this project's line item categories.
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, padding: 12, background: 'rgba(168,85,247,0.04)', borderRadius: 10, border: '1px solid rgba(168,85,247,0.15)' }}>
      <div style={{ fontSize: 10, color: '#c4b5fd', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
        Template tasks · click + or drag to add
      </div>
      {groups.map(g => (
        <div key={g.categoryKey} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 5 }}>
            <span style={{ color: '#a855f7' }}>●</span> {g.categoryLabel}
            <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500, marginLeft: 6 }}>— {g.liCount} line item{g.liCount === 1 ? '' : 's'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
            {g.tasks.map(pc => {
              const alreadyAdded = existingTitles.has(pc.task_label.toLowerCase())
              return (
                <button
                  key={`${g.categoryKey}::${pc.task_key}`}
                  onClick={() => !alreadyAdded && onAddTask(pc.task_label)}
                  disabled={alreadyAdded}
                  title={alreadyAdded ? 'Already added' : 'Click to add to project'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 10px', borderRadius: 6,
                    background: alreadyAdded ? 'rgba(34,197,94,0.06)' : '#131313',
                    border: alreadyAdded ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(148,163,184,0.1)',
                    color: alreadyAdded ? '#4ade80' : '#cbd5e1',
                    fontSize: 11, fontWeight: 500,
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  {pc.task_icon && <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{pc.task_icon}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pc.task_label}</span>
                  <span style={{ fontSize: 13, color: alreadyAdded ? '#4ade80' : '#22d3ee', fontWeight: 700 }}>
                    {alreadyAdded ? '✓' : '+'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
