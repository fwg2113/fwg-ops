'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DailyTask, DocSummary, ProductionStatusLite } from './types'

export default function DailyPlanProjectsRail({
  docs, tasks, nextUpByDoc, productionStatuses, onProjectClick,
}: {
  docs: DocSummary[]
  tasks: DailyTask[]
  nextUpByDoc: Record<string, DailyTask>
  productionStatuses: ProductionStatusLite[]
  onProjectClick: (id: string) => void
}) {
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
      <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(148,163,184,0.08)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Active Projects</h2>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, padding: '3px 10px', background: 'rgba(148,163,184,0.08)', borderRadius: 10 }}>{docs.length}</span>
      </div>
      <div style={{ padding: 14, overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
        {docs.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 12, fontStyle: 'italic' }}>No active projects.</div>
        )}
        {docs.map(doc => (
          <ProjectCard
            key={doc.id}
            doc={doc}
            nextUp={nextUpByDoc[doc.id]}
            productionStatuses={productionStatuses}
            onClick={() => onProjectClick(doc.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({ doc, nextUp, productionStatuses, onClick }: {
  doc: DocSummary
  nextUp?: DailyTask
  productionStatuses: ProductionStatusLite[]
  onClick: () => void
}) {
  const cur = doc.production_status_id ? productionStatuses.find(s => s.id === doc.production_status_id) : null
  const stage = doc.production_stage || 'QUEUE'
  const stageColors: Record<string, string> = {
    QUEUE: '#94a3b8', DESIGN: '#c4b5fd', PRINT: '#60a5fa', PRODUCTION: '#2dd4bf', COMPLETE: '#4ade80',
  }
  const stageColor = stageColors[stage] || '#94a3b8'

  return (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(180deg, #1c1c1c 0%, #161616 100%)',
        border: '1px solid rgba(148,163,184,0.1)',
        borderRadius: 12,
        padding: '13px 15px',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        alignItems: 'center',
        transition: 'all 0.18s',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(34,211,238,0.1), 0 1px 0 rgba(255,255,255,0.04)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      {/* Left: vehicle/co/customer per hierarchy */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25, letterSpacing: -0.2 }}>
          {doc.vehicle_description || doc.project_description || doc.customer_name}
        </div>
        {doc.company_name ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{doc.company_name}</div>
            <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{doc.customer_name}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{doc.customer_name}</div>
        )}
      </div>

      {/* Right: next-up draggable pill OR a stage pill if no next up */}
      <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {nextUp ? (
          <DraggableNextUpPill task={nextUp} stageColor={stageColor} />
        ) : (
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: `${stageColor}18`, color: stageColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, border: `1px solid ${stageColor}30` }}>
            {stage}
          </span>
        )}
      </div>
    </div>
  )
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
