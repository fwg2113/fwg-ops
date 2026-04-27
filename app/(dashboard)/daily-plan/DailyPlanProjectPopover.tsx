'use client'

import React, { forwardRef, useState } from 'react'
import DailyPlanLightbox from './DailyPlanLightbox'
import type { DailyTask, DocSummary, LineItemFull, CategoryLite, ProductionStatusLite } from './types'

// Mirrors the production tracker popover layout (popover-element reference)
// Triggered when clicking a Today-block task that has a parent_document_id

type Props = {
  task: DailyTask
  doc: DocSummary
  lineItems: LineItemFull[]
  categories: CategoryLite[]
  productionStatuses: ProductionStatusLite[]
  style: React.CSSProperties
  flipped: boolean
  onClose: () => void
  onToggleDone: () => void
  onOpenProjectSidebar: () => void
}

function isImage(att: any) {
  const url = att?.url || att?.file_url || ''
  const name = att?.filename || att?.name || ''
  const ct = att?.contentType || att?.type || att?.mime_type || ''
  return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
}
function attUrl(att: any) { return att?.url || att?.file_url || '' }
function attLabel(att: any) { return att?.label || att?.filename || att?.name || 'mockup' }

function fmtMoney(n: number | string | null | undefined) {
  const v = parseFloat(String(n || 0))
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STAGE_COLORS: Record<string, string> = {
  QUEUE: '#94a3b8', DESIGN: '#a855f7', PRINT: '#3b82f6', PRODUCTION: '#14b8a6', COMPLETE: '#22c55e',
}

const DailyPlanProjectPopover = forwardRef<HTMLDivElement, Props>(function DailyPlanProjectPopover(props, ref) {
  const { task, doc, lineItems, categories, productionStatuses, style, flipped, onClose, onToggleDone, onOpenProjectSidebar } = props
  const stage = doc.production_stage || 'QUEUE'
  const stageColor = STAGE_COLORS[stage] || '#94a3b8'
  const cur = doc.production_status_id ? productionStatuses.find(s => s.id === doc.production_status_id) : null

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // Aggregate mockups across all line items + doc level
  const mockups: { url: string; label: string }[] = []
  for (const li of lineItems) {
    for (const att of (li.attachments || []) as any[]) {
      if (isImage(att) && attUrl(att)) mockups.push({ url: attUrl(att), label: attLabel(att) })
    }
  }
  for (const att of (doc.attachments || []) as any[]) {
    if (isImage(att) && attUrl(att)) mockups.push({ url: attUrl(att), label: attLabel(att) })
  }

  return (
    <div
      ref={ref}
      style={{
        ...style,
        background: '#111',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 900,
        overflowY: 'auto',
        transformOrigin: flipped ? 'right top' : 'left top',
        animation: 'popIn 0.18s ease-out',
      }}
    >
      <style>{`@keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }`}</style>

      {/* Color bar — stage color */}
      <div style={{ height: 3, borderRadius: '12px 12px 0 0', background: stageColor }} />

      <div style={{ padding: '14px 16px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Subject/vehicle as headline (matches new card hierarchy) */}
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: 2 }}>
              {doc.vehicle_description || doc.project_description || '—'}
            </div>
            {doc.company_name && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{doc.company_name}</div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{doc.customer_name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 600 }}>{doc.doc_number}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: doc.balance_due && doc.balance_due > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: doc.balance_due && doc.balance_due > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                {doc.balance_due && doc.balance_due > 0 ? `${fmtMoney(doc.balance_due)} due` : 'PAID'}
              </span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${stageColor}20`, color: stageColor, fontWeight: 600 }}>{stage}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: 16, width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        {/* THE TASK row — small banner so user knows which task they clicked */}
        <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(34,211,238,0.2)', color: '#22d3ee', fontWeight: 700, letterSpacing: 0.5 }}>TASK</span>
          <span style={{ flex: 1, fontSize: 12, color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.title}
          </span>
          <button onClick={onToggleDone} style={{ background: task.status === 'DONE' ? 'rgba(34,197,94,0.15)' : 'rgba(34,211,238,0.1)', border: task.status === 'DONE' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,211,238,0.3)', color: task.status === 'DONE' ? '#4ade80' : '#22d3ee', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {task.status === 'DONE' ? '✓ Done' : 'Mark done'}
          </button>
        </div>

        {/* Status pill (read-only display) */}
        {cur && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>Production status</div>
            <span style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: `${cur.color}22`, border: `1px solid ${cur.color}55`, color: cur.color,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cur.color }} />
              {cur.label}
            </span>
            {doc.production_status_note && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#fca5a5' }}>
                ⚑ {doc.production_status_note}
              </div>
            )}
          </div>
        )}

        {/* Quick contact links */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14, fontSize: 12 }}>
          {doc.customer_phone && (
            <a href={`tel:${doc.customer_phone}`} style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>📞</span>{doc.customer_phone}
            </a>
          )}
          {doc.customer_email && (
            <a href={`mailto:${doc.customer_email}`} style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>✉</span>{doc.customer_email}
            </a>
          )}
        </div>

        {/* Project description (if separate from vehicle) */}
        {doc.project_description && doc.vehicle_description && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#e2e8f0' }}>{doc.project_description}</div>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 12px' }} />

        {/* Financials */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 12 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Total</div>
            <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{fmtMoney(doc.total)}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Paid</div>
            <div style={{ color: '#22c55e', fontWeight: 600 }}>{fmtMoney(doc.amount_paid)}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Balance</div>
            <div style={{ color: (doc.balance_due || 0) > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
              {(doc.balance_due || 0) > 0 ? fmtMoney(doc.balance_due) : 'PAID'}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 12px' }} />

        {/* Line items */}
        {lineItems.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>Line Items</div>
            {lineItems.map(li => {
              const cat = categories.find(c => c.category_key === li.category)
              return (
                <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(168,85,247,0.12)', color: '#c4b5fd', fontWeight: 600, flexShrink: 0 }}>
                      {cat?.label || li.category?.replace(/_/g, ' ') || '—'}
                    </span>
                    <span style={{ fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {li.description || '—'}
                    </span>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 8, textAlign: 'right' }}>
                    {li.quantity != null && li.quantity > 1 && <span style={{ fontSize: 10, color: '#64748b', marginRight: 6 }}>×{li.quantity}</span>}
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{fmtMoney(li.line_total)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Mockups — click to open lightbox */}
        {mockups.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>Mockups</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mockups.slice(0, 4).map((m, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  style={{ width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.1)', cursor: 'zoom-in', display: 'block', padding: 0, background: '#0d0d0d' }}
                >
                  <img alt={m.label} src={m.url} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </button>
              ))}
              {mockups.length > 4 && (
                <button onClick={onOpenProjectSidebar} style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8', padding: 8, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  + {mockups.length - 4} more in sidebar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lightboxIdx != null && mockups[lightboxIdx] && (
          <DailyPlanLightbox
            url={mockups[lightboxIdx].url}
            label={mockups[lightboxIdx].label}
            index={lightboxIdx}
            count={mockups.length}
            onClose={() => setLightboxIdx(null)}
            onPrev={mockups.length > 1 ? () => setLightboxIdx(i => (i! - 1 + mockups.length) % mockups.length) : undefined}
            onNext={mockups.length > 1 ? () => setLightboxIdx(i => (i! + 1) % mockups.length) : undefined}
          />
        )}

        <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '0 0 12px' }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a
            href={`/documents/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#c4b5fd', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            Open Invoice ↗
          </a>
          <button
            onClick={onOpenProjectSidebar}
            style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #22d3ee, #0ea5e9)', border: 'none', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Project sidebar →
          </button>
        </div>
      </div>
    </div>
  )
})

export default DailyPlanProjectPopover
