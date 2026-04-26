'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProductionStatus } from './StatusManager'

type Attachment = { url?: string; file_url?: string; filename?: string; name?: string; label?: string; contentType?: string; type?: string }
type LineItem = { id: string; document_id: string; category: string; line_type?: string; attachments?: Attachment[] }
type ProductionDocument = {
  id: string; doc_number: string; customer_name: string; vehicle_description?: string; project_description?: string
  due_date?: string; production_sort_order?: number; production_stage?: string;
  production_status_id?: string | null; production_status_note?: string | null
  production_leader_id?: string; line_items: LineItem[]
}
type BoardTask = {
  id: string; title: string; description?: string | null; production_stage?: string
  production_sort_order?: number; production_status_id?: string | null; production_status_note?: string | null
  due_date?: string | null; leader_id?: string | null; archived: boolean
  task_completed_at?: string | null; mockups?: { url: string; filename: string; uploadedAt: string }[]
}
type TeamMember = { id: string; name: string; short_name?: string; color: string }
type CategoryData = { category_key: string; parent_category: string; label: string; calendar_color?: string }

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDuePill(dueDate: string | undefined | null) {
  if (!dueDate) return null
  const due = new Date(String(dueDate) + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (daysLeft < 0) return { text: `${Math.abs(daysLeft)}d overdue`, bg: '#5c1212', color: '#f87171' }
  if (daysLeft === 0) return { text: 'Due today', bg: '#5c3d12', color: '#fbbf24' }
  if (daysLeft <= 3) return { text: `${daysLeft}d left`, bg: '#5c3d12', color: '#fbbf24' }
  return { text: `${formatDate(dueDate)}`, bg: '#16533a', color: '#4ade80' }
}

export type SortableBoardCardProps = {
  itemKind: 'doc' | 'task'
  itemId: string
  sortableId: string

  doc?: ProductionDocument
  task?: BoardTask

  isSelected: boolean
  onClickCard: (el: HTMLElement) => void

  // Status pill
  status?: ProductionStatus | null
  stageStatuses: ProductionStatus[]
  showStatusPill: boolean
  onOpenStatusDropdown: (rect: DOMRect) => void

  // Archive (only shown when stageKey === 'COMPLETE')
  isComplete?: boolean
  onArchive?: () => void

  // Doc-specific data
  catMap?: Record<string, CategoryData>
  teamMembers?: TeamMember[]
  docAssignees?: TeamMember[]
  docLeader?: TeamMember | null

  // Task-specific data
  taskAssignees?: TeamMember[]
  taskLeader?: TeamMember | null
}

export default function SortableBoardCard(props: SortableBoardCardProps) {
  const {
    itemKind, itemId, sortableId, doc, task, isSelected, onClickCard,
    status, stageStatuses, showStatusPill, onOpenStatusDropdown,
    isComplete, onArchive,
    catMap, teamMembers, docAssignees, docLeader, taskAssignees, taskLeader,
  } = props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    cursor: 'grab',
    position: 'relative',
    userSelect: 'none',
  }

  if (itemKind === 'doc' && doc && catMap) {
    const catColor = getDocCategoryColor(doc, catMap)
    const duePill = getDuePill(doc.due_date)
    const hasAttention = !!doc.production_status_note
    const edgeColor = hasAttention ? '#ef4444' : (status?.color || catColor)

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-card-id={itemId}
        onClick={e => {
          if ((e.target as HTMLElement).closest('.status-pill') || (e.target as HTMLElement).closest('.status-dropdown') || (e.target as HTMLElement).closest('.archive-btn')) return
          onClickCard(e.currentTarget as HTMLElement)
        }}
        style={{
          ...style,
          borderTop: hasAttention ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          borderRight: hasAttention ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          borderBottom: hasAttention ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          borderLeft: `4px solid ${edgeColor}`,
          boxShadow: hasAttention ? '0 0 12px rgba(239,68,68,0.3)' : isSelected ? '0 0 12px rgba(34,211,238,0.3)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{doc.doc_number}</span>
            {hasAttention && (
              <span title={doc.production_status_note || ''} style={{ fontSize: 14, color: '#ef4444', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}>⚑</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {duePill && (
              <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 7, fontWeight: 600, background: duePill.bg, color: duePill.color }}>
                {duePill.text}
              </span>
            )}
            {isComplete && onArchive && (
              <button
                className="archive-btn"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onArchive() }}
                title="Archive this card (invoice stays untouched)"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >×</button>
            )}
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.customer_name}
        </div>
        <div style={{ fontSize: 14, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>
          {doc.vehicle_description || doc.project_description || '—'}
        </div>

        {hasAttention && doc.production_status_note && (
          <div style={{ fontSize: 12, color: '#f87171', marginBottom: 5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠ {doc.production_status_note}
          </div>
        )}

        {((docAssignees && docAssignees.length > 0) || docLeader) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {docLeader && (
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${docLeader.color}20`, color: docLeader.color, fontWeight: 700, border: `1px solid ${docLeader.color}40` }}>
                ★ {docLeader.short_name || docLeader.name}
              </span>
            )}
            {(docAssignees || []).filter(a => a.id !== doc.production_leader_id).map(member => (
              <span key={member.id} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${member.color}15`, color: member.color, fontWeight: 600 }}>
                {member.short_name || member.name}
              </span>
            ))}
          </div>
        )}

        {showStatusPill && stageStatuses.length > 0 && (
          <StatusPillButton status={status || null} onOpen={onOpenStatusDropdown} />
        )}
      </div>
    )
  }

  if (itemKind === 'task' && task) {
    const duePill = getDuePill(task.due_date)
    const hasAttention = !!task.production_status_note
    const edgeColor = hasAttention ? '#ef4444' : (status?.color || '#94a3b8')

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-card-id={itemId}
        onClick={e => {
          if ((e.target as HTMLElement).closest('.status-pill') || (e.target as HTMLElement).closest('.status-dropdown') || (e.target as HTMLElement).closest('.archive-btn')) return
          onClickCard(e.currentTarget as HTMLElement)
        }}
        style={{
          ...style,
          borderTop: hasAttention ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          borderRight: hasAttention ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          borderBottom: hasAttention ? '2px solid #ef4444' : isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          borderLeft: `4px solid ${edgeColor}`,
          boxShadow: hasAttention ? '0 0 12px rgba(239,68,68,0.3)' : isSelected ? '0 0 12px rgba(34,211,238,0.3)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>TASK</span>
            {hasAttention && (
              <span title={task.production_status_note || ''} style={{ fontSize: 14, color: '#ef4444', cursor: 'help' }}>⚑</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {duePill && (
              <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 7, fontWeight: 600, background: duePill.bg, color: duePill.color }}>
                {duePill.text}
              </span>
            )}
            {isComplete && onArchive && (
              <button
                className="archive-btn"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onArchive() }}
                title="Archive this task"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >×</button>
            )}
          </div>
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>
          {task.title}
        </div>
        {task.description && (
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.description}
          </div>
        )}

        {hasAttention && task.production_status_note && (
          <div style={{ fontSize: 12, color: '#f87171', marginBottom: 5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠ {task.production_status_note}
          </div>
        )}

        {((taskAssignees && taskAssignees.length > 0) || taskLeader) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {taskLeader && (
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${taskLeader.color}20`, color: taskLeader.color, fontWeight: 700, border: `1px solid ${taskLeader.color}40` }}>
                ★ {taskLeader.short_name || taskLeader.name}
              </span>
            )}
            {(taskAssignees || []).filter(a => a.id !== task.leader_id).map(member => (
              <span key={member.id} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${member.color}15`, color: member.color, fontWeight: 600 }}>
                {member.short_name || member.name}
              </span>
            ))}
          </div>
        )}

        {(task.mockups && task.mockups.length > 0) && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>
            🖼 {task.mockups.length} mockup{task.mockups.length > 1 ? 's' : ''}
          </div>
        )}

        {showStatusPill && stageStatuses.length > 0 && (
          <StatusPillButton status={status || null} onOpen={onOpenStatusDropdown} />
        )}
      </div>
    )
  }

  return null
}

function StatusPillButton({ status, onOpen }: { status: ProductionStatus | null; onOpen: (rect: DOMRect) => void }) {
  return (
    <div className="status-pill">
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())
        }}
        style={{
          width: '100%', padding: '8px 13px', borderRadius: 7,
          background: status ? `${status.color}22` : 'rgba(148,163,184,0.1)',
          border: `1px solid ${status ? `${status.color}55` : 'rgba(148,163,184,0.2)'}`,
          color: status ? status.color : '#94a3b8',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: status?.color || '#94a3b8' }} />
          {status?.label || 'Set status'}
        </span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>▾</span>
      </button>
    </div>
  )
}
