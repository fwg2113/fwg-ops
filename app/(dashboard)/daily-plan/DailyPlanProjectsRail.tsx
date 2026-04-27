'use client'

import React, { useState, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DailyTask, DocSummary, ProductionStatusLite, TeamMember } from './types'

type FilterKey = 'all' | 'stuck' | 'overdue'

export default function DailyPlanProjectsRail({
  docs, tasks, nextUpByDoc, productionStatuses, teamMembers, onProjectClick,
}: {
  docs: DocSummary[]
  tasks: DailyTask[]
  nextUpByDoc: Record<string, DailyTask>
  productionStatuses: ProductionStatusLite[]
  teamMembers?: TeamMember[]
  onProjectClick: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  // Open task counts per doc (used on cards + for "Most tasks" sort/filter)
  const openTaskCountByDoc = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of tasks) {
      if (t.status !== 'TODO') continue
      if (!t.parent_document_id) continue
      m[t.parent_document_id] = (m[t.parent_document_id] || 0) + 1
    }
    return m
  }, [tasks])

  // Today's date for overdue check
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter(d => {
      if (q) {
        const haystack = [
          d.doc_number, d.customer_name, d.company_name,
          d.vehicle_description, d.project_description,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filter === 'stuck') {
        if (!d.production_status_note) return false
      }
      if (filter === 'overdue') {
        if (!d.due_date) return false
        if (d.due_date >= todayStr) return false
      }
      return true
    })
  }, [docs, search, filter, todayStr])

  const counts = useMemo(() => {
    const stuck = docs.filter(d => !!d.production_status_note).length
    const overdue = docs.filter(d => d.due_date && d.due_date < todayStr).length
    return { all: docs.length, stuck, overdue }
  }, [docs, todayStr])

  return (
    <div style={{
      background: 'linear-gradient(180deg, #161616 0%, #121212 100%)',
      border: '1px solid rgba(148,163,184,0.1)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Active Projects</h2>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, padding: '3px 10px', background: 'rgba(148,163,184,0.08)', borderRadius: 10 }}>
            {filtered.length}{filtered.length !== docs.length ? ` / ${docs.length}` : ''}
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, company, vehicle, doc#…"
            style={{
              width: '100%',
              padding: '9px 36px 9px 36px',
              background: '#0d0d0d',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: 9,
              color: '#f1f5f9',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(148,163,184,0.15)', border: 'none', color: '#94a3b8', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 5 }}>
          <FilterChip label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} accent="#22d3ee" />
          <FilterChip label="🚩 Stuck" count={counts.stuck} active={filter === 'stuck'} onClick={() => setFilter('stuck')} accent="#ef4444" />
          <FilterChip label="⏰ Overdue" count={counts.overdue} active={filter === 'overdue'} onClick={() => setFilter('overdue')} accent="#fb923c" />
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: 14, overflowY: 'auto', maxHeight: 'calc(100vh - 460px)' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
            {docs.length === 0 ? 'No active projects.' : 'No projects match.'}
          </div>
        )}
        {filtered.map(doc => (
          <ProjectCard
            key={doc.id}
            doc={doc}
            nextUp={nextUpByDoc[doc.id]}
            productionStatuses={productionStatuses}
            teamMembers={teamMembers}
            openTaskCount={openTaskCountByDoc[doc.id] || 0}
            todayStr={todayStr}
            onClick={() => onProjectClick(doc.id)}
          />
        ))}
      </div>
    </div>
  )
}

function FilterChip({ label, count, active, onClick, accent }: { label: string; count: number; active: boolean; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 11px',
        borderRadius: 7,
        border: active ? `1px solid ${accent}` : '1px solid rgba(148,163,184,0.15)',
        background: active ? `${accent}1a` : 'rgba(148,163,184,0.06)',
        color: active ? accent : '#94a3b8',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {label}
      {count > 0 && <span style={{ fontSize: 10, opacity: 0.75 }}>{count}</span>}
    </button>
  )
}

function ProjectCard({ doc, nextUp, productionStatuses, teamMembers, openTaskCount, todayStr, onClick }: {
  doc: DocSummary
  nextUp?: DailyTask
  productionStatuses: ProductionStatusLite[]
  teamMembers?: TeamMember[]
  openTaskCount: number
  todayStr: string
  onClick: () => void
}) {
  const cur = doc.production_status_id ? productionStatuses.find(s => s.id === doc.production_status_id) : null
  const stage = doc.production_stage || 'QUEUE'
  const stageColors: Record<string, string> = {
    QUEUE: '#94a3b8', DESIGN: '#c4b5fd', PRINT: '#60a5fa', PRODUCTION: '#2dd4bf', COMPLETE: '#4ade80',
  }
  const stageColor = stageColors[stage] || '#94a3b8'
  const leader = doc.production_leader_id ? teamMembers?.find(t => t.id === doc.production_leader_id) : null
  const isStuck = !!doc.production_status_note
  const duePill = formatDuePill(doc.due_date, todayStr)

  return (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(180deg, #1c1c1c 0%, #161616 100%)',
        border: isStuck ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(148,163,184,0.1)',
        borderLeft: isStuck ? '3px solid #ef4444' : '1px solid rgba(148,163,184,0.1)',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.18s',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isStuck ? 'rgba(239,68,68,0.6)' : 'rgba(34,211,238,0.35)'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(34,211,238,0.1), 0 1px 0 rgba(255,255,255,0.04)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isStuck ? 'rgba(239,68,68,0.35)' : 'rgba(148,163,184,0.1)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      {/* Top row: stage pill + due date pill + task count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${stageColor}20`, color: stageColor, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', border: `1px solid ${stageColor}30` }}>
          {stage}
        </span>
        {duePill && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: duePill.bg, color: duePill.color, fontWeight: 700 }}>
            {duePill.text}
          </span>
        )}
        {openTaskCount > 0 && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontWeight: 600 }}>
            {openTaskCount} task{openTaskCount === 1 ? '' : 's'}
          </span>
        )}
        {isStuck && (
          <span title={doc.production_status_note || ''} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 700, cursor: 'help' }}>
            🚩 Stuck
          </span>
        )}
        {leader && (
          <span title={leader.name} style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${leader.color}20`, color: leader.color, fontWeight: 700, border: `1px solid ${leader.color}40` }}>
            ★ {leader.short_name || leader.name}
          </span>
        )}
      </div>

      {/* Body row: project info (left) + next-up pill (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25, letterSpacing: -0.2 }}>
            {doc.vehicle_description || doc.project_description || doc.customer_name}
          </div>
          {doc.company_name ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{doc.company_name}</div>
              <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{doc.customer_name} · {doc.doc_number}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{doc.customer_name} · {doc.doc_number}</div>
          )}
        </div>

        <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {nextUp ? (
            <DraggableNextUpPill task={nextUp} stageColor={stageColor} />
          ) : (
            cur ? (
              <span style={{ fontSize: 10, padding: '5px 9px', borderRadius: 6, background: `${cur.color}1c`, color: cur.color, fontWeight: 700, border: `1px solid ${cur.color}40` }}>● {cur.label}</span>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}

function formatDuePill(dueDate: string | null | undefined, todayStr: string): { text: string; bg: string; color: string } | null {
  if (!dueDate) return null
  // Compute days difference using UTC math
  const dueD = new Date(dueDate + 'T00:00:00Z').getTime()
  const todayD = new Date(todayStr + 'T00:00:00Z').getTime()
  const days = Math.round((dueD - todayD) / 86400000)
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
  if (days === 0) return { text: 'Due today', bg: 'rgba(251,146,60,0.15)', color: '#fb923c' }
  if (days <= 3) return { text: `Due in ${days}d`, bg: 'rgba(251,146,60,0.12)', color: '#fbbf24' }
  if (days <= 7) return { text: `Due in ${days}d`, bg: 'rgba(34,197,94,0.1)', color: '#4ade80' }
  return null  // hide if more than a week out — not pressing
}

function DraggableNextUpPill({ task, stageColor }: { task: DailyTask; stageColor: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: task.id })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 7,
    background: `${stageColor}22`,
    color: stageColor,
    border: `1px solid ${stageColor}50`,
    fontWeight: 700,
    cursor: 'grab',
    whiteSpace: 'nowrap',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    boxShadow: `0 2px 8px ${stageColor}20`,
  }
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} suppressHydrationWarning title={`Drag to a day to schedule: ${task.title}`} style={style}>
      <span style={{ fontSize: 9 }}>↑</span>
      {task.title}
    </div>
  )
}
