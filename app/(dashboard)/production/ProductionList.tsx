'use client'

import React, { useState, useMemo, Fragment, useEffect } from 'react'
import {
  isTrackComplete,
  getPipelineWithDbFallback,
  getTasksWithDb,
  computeDocProductionStatusWithDb,
  type ChecklistState,
  type ChecklistTask,
  type PipelineConfig,
  type DbPipelineRow,
} from '../../lib/production/checklist-config'

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
  production_checklist?: ChecklistState
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

type ProductionDocument = {
  id: string
  doc_number: string
  doc_type: string
  status: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  total: number
  in_production: boolean
  created_at: string
  due_date?: string
  production_sort_order?: number
  vehicle_description?: string
  project_description?: string
  fulfillment_type?: string
  attachments?: Attachment[]
  line_items: LineItem[]
  calendar_events: CalendarEvent[]
}

type Tab = 'all' | 'automotive' | 'signage' | 'completed'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'automotive', label: 'Automotive' },
  { key: 'signage', label: 'Signage' },
  { key: 'completed', label: 'Completed' },
]

const COMPLETED_STATUSES = ['completed', 'shipped', 'picked_up']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'paid': return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Paid' }
    case 'in_production': return { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'In Production' }
    case 'complete': return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Complete' }
    case 'completed': return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Completed' }
    case 'shipped': return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Shipped' }
    case 'picked_up': return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Picked Up' }
    default: return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: status || 'Unknown' }
  }
}

// docHasAutomotive, docHasSignage, getLineItemsForTab, getCategoryBadge
// are defined inside the component (need access to categoriesData)

const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600,
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type CategoryData = { category_key: string; parent_category: string; label: string; calendar_color?: string; has_types?: boolean; active?: boolean }

export default function ProductionList({ documents, pipelineConfigs, categoriesData }: { documents: ProductionDocument[]; pipelineConfigs: DbPipelineRow[]; categoriesData: CategoryData[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [checklistOverrides, setChecklistOverrides] = useState<Record<string, ChecklistState>>({})

  // DB-driven category lookups
  const catMap = useMemo(() => {
    const m: Record<string, CategoryData> = {}
    for (const c of categoriesData) m[c.category_key] = c
    return m
  }, [categoriesData])
  const isAuto = (cat: string) => catMap[cat]?.parent_category === 'AUTOMOTIVE'
  const isSign = (cat: string) => catMap[cat]?.parent_category === 'SIGNAGE'
  const isApparelCat = (cat: string) => catMap[cat]?.parent_category === 'APPAREL'
  const isOtherCat = (cat: string) => !isAuto(cat) && !isSign(cat) && !isApparelCat(cat)
  const isProduction = (cat: string) => !isApparelCat(cat)

  const getCategoryBadge = (category: string): { bg: string; color: string; label: string } => {
    const catData = catMap[category]
    const label = catData?.label || category.replace(/_/g, ' ')
    if (isAuto(category)) return { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label }
    if (isSign(category)) return { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6', label }
    return { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label }
  }

  const docHasAutomotive = (doc: ProductionDocument) => doc.line_items.some(li => isAuto(li.category))
  const docHasSignage = (doc: ProductionDocument) => doc.line_items.some(li => isSign(li.category))

  const getLineItemsForTab = (doc: ProductionDocument, tab: Tab): LineItem[] => {
    if (tab === 'all' || tab === 'completed') return doc.line_items.filter(li => isProduction(li.category))
    if (tab === 'automotive') {
      const autoItems = doc.line_items.filter(li => isAuto(li.category))
      const otherItems = docHasAutomotive(doc) ? doc.line_items.filter(li => isOtherCat(li.category)) : []
      return [...autoItems, ...otherItems]
    }
    if (tab === 'signage') {
      const signItems = doc.line_items.filter(li => isSign(li.category))
      const otherItems = !docHasAutomotive(doc) && docHasSignage(doc) ? doc.line_items.filter(li => isOtherCat(li.category)) : []
      return [...signItems, ...otherItems]
    }
    return []
  }

  const getChecklist = (li: LineItem): ChecklistState => {
    return checklistOverrides[li.id] || li.production_checklist || {}
  }

  type UnifiedRow = {
    id: string; docNumber: string; customerName: string; date: string
    dueDate: string; sortOrder: number; status: string; statusLabel: string
    done: number; total: number; description: string; raw: ProductionDocument
  }

  // Compute all rows once for tab counts and filtering
  const allRows = useMemo(() => {
    return documents.map(d => {
      const itemsWithOverrides = d.line_items.map(li => ({ ...li, production_checklist: getChecklist(li) }))
      const { status, label, done, total } = computeDocProductionStatusWithDb(itemsWithOverrides, d.status, pipelineConfigs)
      return {
        id: d.id, docNumber: d.doc_number || '—', customerName: d.customer_name || '—',
        date: d.created_at, dueDate: d.due_date || '', sortOrder: d.production_sort_order || 0,
        status, statusLabel: label, done, total,
        description: d.vehicle_description || d.project_description || '', raw: d,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, checklistOverrides])

  const tabCounts = useMemo(() => {
    const isComplete = (r: UnifiedRow) => COMPLETED_STATUSES.includes(r.raw.status) || r.status === 'complete'
    const isAutoRow = (r: UnifiedRow) => docHasAutomotive(r.raw) || (!docHasAutomotive(r.raw) && !docHasSignage(r.raw) && r.raw.line_items.some(li => isOtherCat(li.category)))
    const isSignRow = (r: UnifiedRow) => docHasSignage(r.raw)
    return {
      all: allRows.filter(r => !isComplete(r)).length,
      automotive: allRows.filter(r => !isComplete(r) && isAutoRow(r)).length,
      signage: allRows.filter(r => !isComplete(r) && isSignRow(r)).length,
      completed: allRows.filter(r => isComplete(r)).length,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows])

  const filteredRows = useMemo(() => {
    const rows = allRows

    let list: UnifiedRow[]
    if (activeTab === 'completed') {
      list = rows.filter(r => COMPLETED_STATUSES.includes(r.raw.status) || r.status === 'complete')
    } else if (activeTab === 'all') {
      list = rows.filter(r => !COMPLETED_STATUSES.includes(r.raw.status) && r.status !== 'complete')
    } else if (activeTab === 'automotive') {
      list = rows.filter(r => {
        if (COMPLETED_STATUSES.includes(r.raw.status) || r.status === 'complete') return false
        return docHasAutomotive(r.raw) || (!docHasAutomotive(r.raw) && !docHasSignage(r.raw) && r.raw.line_items.some(li => isOtherCat(li.category)))
      })
    } else {
      list = rows.filter(r => {
        if (COMPLETED_STATUSES.includes(r.raw.status) || r.status === 'complete') return false
        return docHasSignage(r.raw)
      })
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.docNumber.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    }

    list.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    return list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, activeTab, search])

  // Drag and drop
  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [rowOrder, setRowOrder] = useState<string[]>([])
  const [hasCustomOrder, setHasCustomOrder] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderToast, setOrderToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => { if (!hasCustomOrder) setRowOrder(filteredRows.map(r => r.id)) }, [filteredRows, hasCustomOrder])

  const displayRows = useMemo(() => {
    if (!hasCustomOrder) return filteredRows
    return rowOrder.map(id => filteredRows.find(r => r.id === id)).filter(Boolean) as typeof filteredRows
  }, [filteredRows, rowOrder, hasCustomOrder])

  const handleDragStart = (id: string) => setDragRowId(id)
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragRowId || dragRowId === targetId) return
    setRowOrder(prev => {
      const order = hasCustomOrder ? [...prev] : filteredRows.map(r => r.id)
      const from = order.indexOf(dragRowId); const to = order.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      order.splice(from, 1); order.splice(to, 0, dragRowId); return order
    })
    if (!hasCustomOrder) setHasCustomOrder(true)
  }
  const handleDragEnd = () => setDragRowId(null)
  const saveRowOrder = async () => {
    setSavingOrder(true)
    try {
      let failed = false
      for (let i = 0; i < rowOrder.length; i++) {
        const res = await fetch(`/api/documents/${rowOrder[i]}/production-status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ production_sort_order: i + 1 }),
        })
        if (!res.ok) { failed = true; break }
      }
      if (failed) {
        setOrderToast({ message: 'Failed to save order — try again', type: 'error' })
        setTimeout(() => setOrderToast(null), 3000)
      } else {
        setHasCustomOrder(false)
        setOrderToast({ message: 'Order saved', type: 'success' })
        setTimeout(() => setOrderToast(null), 2000)
      }
    } catch {
      setOrderToast({ message: 'Network error — check your connection', type: 'error' })
      setTimeout(() => setOrderToast(null), 3000)
    } finally {
      setSavingOrder(false)
    }
  }
  const resetRowOrder = () => { setHasCustomOrder(false); setRowOrder(filteredRows.map(r => r.id)) }

  return (
    <div style={{ padding: '32px', maxWidth: '1800px', margin: '0 auto' }}>
      {orderToast && (
        <div style={{ position: 'fixed', top: 20, right: 20, padding: '10px 18px', borderRadius: 8, background: orderToast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 13, fontWeight: 500, zIndex: 9999 }}>{orderToast.message}</div>
      )}
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          FWG <span style={{ background: 'linear-gradient(90deg, #a855f7, #14b8a6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Production</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Automotive & signage production tracking</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#1a1a1a', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          const count = tabCounts[tab.key]
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setExpandedRow(null) }}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: isActive ? '#a855f7' : 'transparent', color: isActive ? '#fff' : '#94a3b8', fontSize: '14px', fontWeight: isActive ? 600 : 500, cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.label}
              {count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(148,163,184,0.15)', color: isActive ? '#fff' : '#64748b', minWidth: 18, textAlign: 'center' }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '400px' }}>
        <input type="text" placeholder="Search by doc #, customer, or description..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 16px', paddingRight: search ? '36px' : '16px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(148,163,184,0.15)', border: 'none', color: '#94a3b8', width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Content */}
      {displayRows.length === 0 ? (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '60px 20px', textAlign: 'center' }}>
          {search ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🔍</div>
              <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No results for &ldquo;{search}&rdquo;</p>
              <p style={{ color: '#475569', fontSize: 13, margin: '0 0 16px' }}>Try a different doc number, customer name, or description</p>
              <button onClick={() => setSearch('')} style={{ padding: '8px 20px', borderRadius: 6, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear search</button>
            </>
          ) : activeTab === 'completed' ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>✓</div>
              <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>No completed production items yet</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>📋</div>
              <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No active production items</p>
              <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Documents move here when they&apos;re paid or marked for production</p>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden' }}>
          {hasCustomOrder && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(168,85,247,0.06)', borderBottom: '1px solid rgba(168,85,247,0.15)' }}>
              <span style={{ fontSize: 12, color: '#a855f7', fontWeight: 600 }}>Custom order — drag rows to reorder</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetRowOrder} disabled={savingOrder} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: savingOrder ? 'not-allowed' : 'pointer', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', opacity: savingOrder ? 0.5 : 1 }}>Reset</button>
                <button onClick={saveRowOrder} disabled={savingOrder} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: savingOrder ? 'not-allowed' : 'pointer', background: '#a855f7', border: 'none', color: '#fff', opacity: savingOrder ? 0.7 : 1 }}>{savingOrder ? 'Saving...' : 'Save Order'}</button>
              </div>
            </div>
          )}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Doc #', 'Customer', 'Description', 'Due Date', 'Progress', 'Status', ''].map(col => (
                    <th key={col} style={{ padding: '14px 16px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => {
                  const status = getStatusStyle(row.status)
                  const isExpanded = expandedRow === row.id
                  const isDragging = dragRowId === row.id
                  let rowTint = 'transparent'
                  if (row.dueDate) {
                    const due = new Date(row.dueDate + 'T00:00:00'); const now = new Date(); now.setHours(0,0,0,0)
                    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
                    rowTint = daysLeft <= 0 ? 'rgba(239,68,68,0.06)' : daysLeft <= 2 ? 'rgba(239,68,68,0.04)' : daysLeft <= 4 ? 'rgba(245,158,11,0.04)' : 'rgba(34,197,94,0.04)'
                  }
                  return (
                    <Fragment key={row.id}>
                      <tr draggable onDragStart={() => handleDragStart(row.id)} onDragOver={e => handleDragOver(e, row.id)} onDragEnd={handleDragEnd}
                        style={{ borderBottom: '1px solid rgba(148,163,184,0.05)', transition: 'background 0.15s ease, opacity 0.15s', cursor: 'grab', background: rowTint, opacity: isDragging ? 0.5 : 1, borderLeft: row.dueDate ? `3px solid ${(() => { const due = new Date(row.dueDate + 'T00:00:00'); const now = new Date(); now.setHours(0,0,0,0); const d = Math.ceil((due.getTime() - now.getTime()) / 86400000); return d <= 0 ? '#ef4444' : d <= 2 ? '#ef4444' : d <= 4 ? '#f59e0b' : '#22c55e' })()}` : '3px solid transparent' }}
                        onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                        onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(148,163,184,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = rowTint }}>
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600 }}>
                          <a href={`/documents/${row.id}`} onClick={e => e.stopPropagation()} style={{ color: '#a855f7', textDecoration: 'none' }}
                            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }} onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>{row.docNumber}</a>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#f1f5f9', fontSize: '14px' }}>{row.customerName}</td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {(() => {
                            if (!row.dueDate) return <span style={{ color: '#475569', fontSize: 13 }}>—</span>
                            const due = new Date(row.dueDate + 'T00:00:00'); const now = new Date(); now.setHours(0,0,0,0)
                            const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
                            const c = daysLeft <= 0 ? '#ef4444' : daysLeft <= 2 ? '#ef4444' : daysLeft <= 4 ? '#f59e0b' : '#22c55e'
                            const txt = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`
                            return (<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: '#94a3b8', fontSize: 13 }}>{formatDate(row.dueDate)}</span><span style={{ fontSize: 11, fontWeight: 600, color: c }}>{txt}</span></div>)
                          })()}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {row.total > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.1)', overflow: 'hidden' }}>
                                <div style={{ width: `${(row.done / row.total) * 100}%`, height: '100%', borderRadius: 3, background: row.done === row.total ? '#22c55e' : '#a855f7', transition: 'width 0.3s ease' }} />
                              </div>
                              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{row.done}/{row.total}</span>
                            </div>
                          ) : <span style={{ color: '#475569', fontSize: 13 }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', background: status.bg, color: status.color, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.statusLabel}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}><span style={{ color: '#475569', fontSize: '18px', lineHeight: 1, userSelect: 'none' }}>{isExpanded ? '▲' : '▼'}</span></td>
                      </tr>
                      {isExpanded && (
                        <tr><td colSpan={7} style={{ padding: 0 }}>
                          <DocumentDetail doc={row.raw} tab={activeTab} getChecklist={getChecklist} pipelineConfigs={pipelineConfigs} getCategoryBadge={getCategoryBadge} getLineItemsForTab={getLineItemsForTab} isAuto={isAuto}
                            onChecklistUpdate={(lineItemId, checklist) => { setChecklistOverrides(prev => ({ ...prev, [lineItemId]: checklist })) }} />
                        </td></tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline visualization components (mirrors FA Orders)
// ---------------------------------------------------------------------------

function PipeNode({ done, active, children, label, onClick }: {
  done: boolean; active: boolean; children: React.ReactNode; label: string; onClick?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 90 }}>
      <div onClick={onClick} style={{
        width: 56, height: 56, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
        background: done ? 'rgba(52,211,153,0.15)' : active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.04)',
        border: `3px solid ${done ? '#22c55e' : active ? '#a855f7' : 'rgba(148,163,184,0.15)'}`,
        color: done ? '#22c55e' : active ? '#a855f7' : '#475569',
        boxShadow: active ? '0 0 0 5px rgba(168,85,247,0.12)' : done ? '0 0 0 4px rgba(34,197,94,0.08)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}>{children}</div>
      <div style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.3, fontWeight: 600, marginTop: 8, color: done ? '#22c55e' : active ? '#a855f7' : '#94a3b8', whiteSpace: 'pre-line', maxWidth: 88 }}>{label}</div>
    </div>
  )
}

function TrackConnector({ done }: { done: boolean }) {
  return <div style={{ flex: 1, minWidth: 24, height: 3, borderRadius: 2, background: done ? '#22c55e' : 'rgba(148,163,184,0.1)', flexShrink: 0, marginBottom: 28, transition: 'background 0.3s ease' }} />
}

function SharedConnector({ done }: { done: boolean }) {
  return <div style={{ flex: 1, minWidth: 20, height: 3, borderRadius: 2, background: done ? '#22c55e' : 'rgba(148,163,184,0.1)', flexShrink: 0, transition: 'background 0.3s ease' }} />
}

function SharedNode({ done, active, icon, label, onClick }: {
  done: boolean; active: boolean; icon: string; label: string; onClick?: () => void
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: 86 }}>
      <div onClick={onClick} style={{
        width: 52, height: 52, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0,
        background: done ? 'rgba(52,211,153,0.15)' : active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.04)',
        border: `3px solid ${done ? '#22c55e' : active ? '#a855f7' : 'rgba(148,163,184,0.15)'}`,
        color: done ? '#22c55e' : active ? '#a855f7' : '#475569',
        boxShadow: active ? '0 0 0 5px rgba(168,85,247,0.12)' : done ? '0 0 0 4px rgba(34,197,94,0.08)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}>{done ? '✓' : icon}</div>
      <div style={{ position: 'absolute', top: '100%', marginTop: 8, fontSize: 11, textAlign: 'center', lineHeight: 1.3, fontWeight: 600, color: done ? '#22c55e' : active ? '#a855f7' : '#94a3b8', whiteSpace: 'pre-line', maxWidth: 84 }}>
        {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Line item pipeline renderer
// ---------------------------------------------------------------------------

function LineItemPipeline({ pipeline, checklist, onToggle, onAddTrackTask }: {
  pipeline: PipelineConfig
  checklist: ChecklistState
  onToggle: (taskKey: string, currentDone: boolean) => void
  onAddTrackTask: (track: string, label: string, position?: number) => void
}) {
  const [addingToTrack, setAddingToTrack] = React.useState<string | null>(null)
  const [addingAtPosition, setAddingAtPosition] = React.useState<number>(99)
  const [trackTaskLabel, setTrackTaskLabel] = React.useState('')

  // Merge ad-hoc tasks into preset tracks at the right position
  // Preset tasks have integer positions (0, 1, 2...), ad-hoc use fractional (0.5 = between 0 and 1)
  const mergeTrackTasks = (presetTasks: ChecklistTask[], track: string): ChecklistTask[] => {
    const adHocEntries = Object.entries(checklist)
      .filter(([k, v]) => k.startsWith('custom_') && v?.track === track)
      .map(([k, v]) => ({ key: k, label: v?.label || k.replace('custom_', '').replace(/_/g, ' '), icon: '＋', position: v?.position ?? 99 }))
      .sort((a, b) => a.position - b.position)

    if (adHocEntries.length === 0) return presetTasks

    const merged: ChecklistTask[] = []
    let adHocIdx = 0
    for (let i = 0; i < presetTasks.length; i++) {
      // Insert ad-hoc tasks that go before this preset (position < i)
      while (adHocIdx < adHocEntries.length && adHocEntries[adHocIdx].position < i) {
        merged.push(adHocEntries[adHocIdx])
        adHocIdx++
      }
      merged.push(presetTasks[i])
    }
    // Append remaining
    while (adHocIdx < adHocEntries.length) {
      merged.push(adHocEntries[adHocIdx])
      adHocIdx++
    }
    return merged
  }

  const fullPrepTasks = mergeTrackTasks(pipeline.prepTasks, 'prep')
  const fullDesignTasks = mergeTrackTasks(pipeline.designTasks, 'design')
  const fullProdTasks = mergeTrackTasks(pipeline.productionTasks, 'production')

  const prepDone = isTrackComplete(fullPrepTasks, checklist)
  const designDone = isTrackComplete(fullDesignTasks, checklist)
  const readyForProduction = prepDone && designDone
  const GAP = 24
  const DIAG_W = 56

  const getNextKey = (tasks: ChecklistTask[]): string | null => {
    for (const t of tasks) { if (!checklist[t.key]?.done) return t.key }
    return null
  }
  const prepNext = getNextKey(fullPrepTasks)
  const designNext = getNextKey(fullDesignTasks)
  const prodNext = readyForProduction ? getNextKey(fullProdTasks) : null
  const prodDoneCount = fullProdTasks.filter(t => checklist[t.key]?.done).length

  const handleAddToTrack = (track: string, position: number) => {
    if (!trackTaskLabel.trim()) return
    onAddTrackTask(track, trackTaskLabel.trim(), position)
    setAddingToTrack(null)
    setTrackTaskLabel('')
    setAddingAtPosition(99)
  }

  // Inline add input that appears where you clicked "+"
  const InlineAddInput = ({ track, position }: { track: string; position: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 96, flexShrink: 0, padding: '0 4px' }}>
      <input
        value={trackTaskLabel}
        onChange={e => setTrackTaskLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAddToTrack(track, position); if (e.key === 'Escape') { setAddingToTrack(null); setTrackTaskLabel('') } }}
        placeholder="Task name..."
        autoFocus
        style={{ width: '100%', padding: '8px 10px', background: '#111', border: '2px solid #a855f7', borderRadius: 8, color: '#f1f5f9', fontSize: 12, textAlign: 'center', outline: 'none', boxShadow: '0 0 0 4px rgba(168,85,247,0.12)' }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => handleAddToTrack(track, position)} style={{ padding: '4px 14px', borderRadius: 5, background: '#a855f7', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Add</button>
        <button onClick={() => { setAddingToTrack(null); setTrackTaskLabel('') }} style={{ padding: '4px 10px', borderRadius: 5, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>×</button>
      </div>
    </div>
  )

  // Small "+" button that appears on hover between nodes
  const InsertButton = ({ track, position }: { track: string; position: number }) => {
    if (addingToTrack === `${track}:${position}`) {
      return (
        <>
          <TrackConnector done={false} />
          <InlineAddInput track={track} position={position} />
        </>
      )
    }
    return null
  }

  // End-of-track add button
  const EndAddButton = ({ track, position, isShared, lastTaskDone }: { track: string; position: number; isShared?: boolean; lastTaskDone?: boolean }) => {
    const trackPos = `${track}:end`
    if (addingToTrack === trackPos) {
      return (
        <>
          {isShared ? <SharedConnector done={!!lastTaskDone} /> : <TrackConnector done={!!lastTaskDone} />}
          <InlineAddInput track={track} position={position} />
        </>
      )
    }
    return (
      <>
        {isShared ? <SharedConnector done={!!lastTaskDone} /> : <TrackConnector done={!!lastTaskDone} />}
        <div
          onClick={() => { setAddingToTrack(trackPos); setTrackTaskLabel(''); setAddingAtPosition(position) }}
          style={{
            width: isShared ? 40 : 42, height: isShared ? 40 : 42, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px dashed rgba(148,163,184,0.2)', background: 'transparent',
            color: '#475569', fontSize: isShared ? 16 : 18, cursor: 'pointer',
            marginBottom: isShared ? 0 : 28,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.color = '#a855f7'; e.currentTarget.style.background = 'rgba(168,85,247,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' }}
          title="Add task"
        >+</div>
      </>
    )
  }

  const renderTrackNodes = (tasks: ChecklistTask[], nextKey: string | null, trackName: string, presetTasks: ChecklistTask[], isShared?: boolean) => {
    return tasks.map((task, idx) => {
      const taskDone = !!checklist[task.key]?.done
      const isActive = task.key === nextKey
      const isAdHoc = task.key.startsWith('custom_')
      const presetIdx = presetTasks.findIndex(t => t.key === task.key)
      const insertPos = presetIdx >= 0 ? presetIdx - 0.5 : idx - 0.5
      const insertKey = `${trackName}:${insertPos}`
      const isInsertingHere = addingToTrack === insertKey

      // A connector line is green if EITHER the task before it OR the task after it is done
      const prevDone = idx > 0 ? !!checklist[tasks[idx - 1].key]?.done : false
      const lineGreen = taskDone || prevDone
      const lineColor = lineGreen ? '#22c55e' : 'rgba(148,163,184,0.1)'

      if (isShared) {
        // For the first shared node, also check if merge point has progress
        const sharedLineGreen = idx === 0 ? (taskDone || prodDoneCount > 0) : lineGreen
        const sharedLineColor = sharedLineGreen ? '#22c55e' : 'rgba(148,163,184,0.1)'
        return (
          <React.Fragment key={task.key}>
            {isInsertingHere ? (
              <>
                <SharedConnector done={sharedLineGreen} />
                <InlineAddInput track={trackName} position={insertPos} />
                <SharedConnector done={sharedLineGreen} />
              </>
            ) : (
              <div style={{ flex: 1, minWidth: 20, height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
                onClick={() => { setAddingToTrack(insertKey); setTrackTaskLabel('') }}
                title="Insert task here">
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: sharedLineColor, transition: 'background 0.3s ease' }} />
              </div>
            )}
            <SharedNode done={taskDone} active={isActive} icon={task.icon || '○'} label={task.label} onClick={() => onToggle(task.key, taskDone)} />
          </React.Fragment>
        )
      }
      return (
        <React.Fragment key={task.key}>
          {idx > 0 && (
            isInsertingHere ? (
              <>
                <TrackConnector done={lineGreen} />
                <InlineAddInput track={trackName} position={insertPos} />
                <TrackConnector done={lineGreen} />
              </>
            ) : (
              <div style={{ flex: 1, minWidth: 24, height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', marginBottom: 28 }}
                onClick={() => { setAddingToTrack(insertKey); setTrackTaskLabel('') }}
                title="Insert task here">
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: lineColor, transition: 'background 0.3s ease' }} />
              </div>
            )
          )}
          <PipeNode done={taskDone} active={isActive} label={task.label} onClick={() => onToggle(task.key, taskDone)}>
            {taskDone ? '✓' : (task.icon || (isAdHoc ? '＋' : '○'))}
          </PipeNode>
        </React.Fragment>
      )
    })
  }

  return (
    <div style={{ marginBottom: 8, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>

        {/* LEFT: Two stacked tracks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP + 4, flex: '0 0 40%' }}>

          {/* PREP track (top) */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>{pipeline.prepLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {renderTrackNodes(fullPrepTasks, prepNext, 'prep', pipeline.prepTasks)}
              <EndAddButton track="prep" position={pipeline.prepTasks.length + 0.5} lastTaskDone={fullPrepTasks.length > 0 && !!checklist[fullPrepTasks[fullPrepTasks.length - 1].key]?.done} />
            </div>
          </div>

          {/* DESIGN track (bottom) */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>{pipeline.designLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {renderTrackNodes(fullDesignTasks, designNext, 'design', pipeline.designTasks)}
              <EndAddButton track="design" position={pipeline.designTasks.length + 0.5} lastTaskDone={fullDesignTasks.length > 0 && !!checklist[fullDesignTasks[fullDesignTasks.length - 1].key]?.done} />
            </div>
          </div>
        </div>

        {/* DIAGONAL SVG connector */}
        <div style={{ position: 'relative', width: DIAG_W + 8, flexShrink: 0 }}>
          <svg width={DIAG_W + 8} height="100%" style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="none">
            <line x1="0" y1="68" x2={DIAG_W + 8} y2="50%" stroke={prepDone || (fullPrepTasks.length > 0 && !!checklist[fullPrepTasks[fullPrepTasks.length - 1].key]?.done) ? '#22c55e' : 'rgba(148,163,184,0.15)'} strokeWidth="3" strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }}/>
            <line x1="0" y1="calc(100% - 68px)" x2={DIAG_W + 8} y2="50%" stroke={designDone || (fullDesignTasks.length > 0 && !!checklist[fullDesignTasks[fullDesignTasks.length - 1].key]?.done) ? '#22c55e' : 'rgba(148,163,184,0.15)'} strokeWidth="3" strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }}/>
          </svg>
        </div>

        {/* RIGHT: Shared production track */}
        <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center', flex: 1 }}>
          {/* Merge point */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: 86 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0,
              background: prodDoneCount > 0 ? 'rgba(52,211,153,0.15)' : readyForProduction ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
              border: `3px solid ${prodDoneCount > 0 ? '#22c55e' : readyForProduction ? '#a855f7' : 'rgba(148,163,184,0.15)'}`,
              color: prodDoneCount > 0 ? '#22c55e' : readyForProduction ? '#a855f7' : '#475569',
              boxShadow: readyForProduction && prodDoneCount === 0 ? '0 0 0 6px rgba(168,85,247,0.12)' : prodDoneCount > 0 ? '0 0 0 5px rgba(34,197,94,0.08)' : 'none',
              transition: 'all 0.3s ease',
            }}>
              {prodDoneCount > 0 ? '✓' : '⚡'}
            </div>
            <div style={{ position: 'absolute', top: '100%', marginTop: 8, fontSize: 11, textAlign: 'center', lineHeight: 1.3, fontWeight: 600, color: prodDoneCount > 0 ? '#22c55e' : readyForProduction ? '#a855f7' : '#94a3b8', whiteSpace: 'nowrap' }}>
              Ready for<br/>Production
            </div>
          </div>

          {renderTrackNodes(fullProdTasks, prodNext, 'production', pipeline.productionTasks, true)}

          {/* Add to production track */}
          <EndAddButton track="production" position={pipeline.productionTasks.length + 0.5} isShared lastTaskDone={fullProdTasks.length > 0 && !!checklist[fullProdTasks[fullProdTasks.length - 1].key]?.done} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expanded row detail
// ---------------------------------------------------------------------------

function DocumentDetail({ doc, tab, getChecklist, onChecklistUpdate, pipelineConfigs, getCategoryBadge, getLineItemsForTab, isAuto }: {
  doc: ProductionDocument; tab: Tab
  getChecklist: (li: LineItem) => ChecklistState
  onChecklistUpdate: (lineItemId: string, checklist: ChecklistState) => void
  pipelineConfigs: DbPipelineRow[]
  getCategoryBadge: (category: string) => { bg: string; color: string; label: string }
  getLineItemsForTab: (doc: ProductionDocument, tab: Tab) => LineItem[]
  isAuto: (cat: string) => boolean
}) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000) }
  const [lightbox, setLightbox] = useState<{ images: { url: string; label: string }[]; index: number } | null>(null)
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set())
  const [addingAdHocTask, setAddingAdHocTask] = useState<{ lineItemId: string; track: string } | null>(null)
  const [adHocTaskLabel, setAdHocTaskLabel] = useState('')

  const relevantItems = getLineItemsForTab(doc, tab)
  const hasAutoItems = doc.line_items.some(li => isAuto(li.category))

  // Gather all image attachments for the document level
  const getAttUrl = (a: Attachment) => a.url || a.file_url || ''
  const getAttName = (a: Attachment) => a.label || a.name || a.filename || a.file_name || 'File'
  const isImage = (a: Attachment) => {
    const url = getAttUrl(a)
    const name = getAttName(a)
    const ct = a.contentType || a.type || a.mime_type || ''
    return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
  }
  const docAttachments = doc.attachments || []

  const handleToggle = async (lineItem: LineItem, taskKey: string, currentDone: boolean) => {
    const newDone = !currentDone
    const oldChecklist = getChecklist(lineItem)
    const newChecklist = { ...oldChecklist, [taskKey]: newDone ? { done: true, at: new Date().toISOString() } : { done: false } }
    onChecklistUpdate(lineItem.id, newChecklist)
    try {
      const res = await fetch('/api/line-items/production-checklist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_item_id: lineItem.id, task_key: taskKey, done: newDone }),
      })
      if (!res.ok) { onChecklistUpdate(lineItem.id, oldChecklist); showToast('Failed to save', 'error') }
    } catch { onChecklistUpdate(lineItem.id, oldChecklist); showToast('Failed to save', 'error') }
  }

  const handleAddAdHocTask = async (lineItem: LineItem) => {
    if (!adHocTaskLabel.trim()) return
    const taskKey = `custom_${adHocTaskLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now()}`
    const oldChecklist = getChecklist(lineItem)
    const newChecklist = { ...oldChecklist, [taskKey]: { done: false, label: adHocTaskLabel.trim() } }
    onChecklistUpdate(lineItem.id, newChecklist)
    // Save directly to Supabase via a raw update (ad-hoc tasks bypass validation)
    try {
      const res = await fetch('/api/line-items/production-checklist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_item_id: lineItem.id, task_key: taskKey, done: false, label: adHocTaskLabel.trim(), ad_hoc: true }),
      })
      if (!res.ok) { onChecklistUpdate(lineItem.id, oldChecklist); showToast('Failed to add task', 'error') }
    } catch { onChecklistUpdate(lineItem.id, oldChecklist); showToast('Failed to add task', 'error') }
    setAddingAdHocTask(null)
    setAdHocTaskLabel('')
  }

  return (
    <div style={{ padding: '20px 20px 24px 48px', background: 'rgba(168,85,247,0.02)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, padding: '10px 18px', borderRadius: 8, background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 13, fontWeight: 500, zIndex: 9999 }}>{toast.message}</div>
      )}

      {/* Doc info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div>
          <div style={labelStyle}>Customer</div>
          <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{doc.customer_name || '—'}</div>
          {doc.customer_phone && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{doc.customer_phone}</div>}
        </div>
        <div>
          <div style={labelStyle}>Document</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href={`/documents/${doc.id}`} style={{ fontSize: 14, color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }} onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>{doc.doc_number || '—'}</a>
            <a
              href={`/documents/${doc.id}`}
              style={{
                padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
                color: '#a855f7', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open {doc.doc_type === 'invoice' ? 'Invoice' : doc.doc_type === 'quote' ? 'Quote' : 'Doc'}
            </a>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{doc.doc_type === 'invoice' ? 'Invoice' : doc.doc_type === 'quote' ? 'Quote' : doc.doc_type || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Total</div>
          <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{doc.total != null ? `$${Number(doc.total).toFixed(2)}` : '—'}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{doc.created_at ? formatDate(doc.created_at) : '—'}</div>
        </div>
      </div>

      {(doc.vehicle_description || doc.project_description) && (
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>{doc.vehicle_description ? 'Vehicle' : 'Project'}</div>
          <div style={{ fontSize: 13, color: '#c8cdd8' }}>{doc.vehicle_description || doc.project_description}</div>
        </div>
      )}

      {/* Job Schedule — shown for automotive docs */}
      {hasAutoItems && <ScheduleInfo doc={doc} />}

      {/* Line items with pipeline visualization */}
      {relevantItems.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>No production line items for this tab.</p>
      ) : (
        relevantItems.map(li => {
          const pipeline = getPipelineWithDbFallback(li.category, pipelineConfigs, li.line_type)
          const checklist = getChecklist(li)
          const badge = getCategoryBadge(li.category)
          const allTasks = getTasksWithDb(li.category, pipelineConfigs, li.line_type)
          // Include any ad-hoc tasks stored in checklist but not in the pipeline config
          const adHocKeys = Object.keys(checklist).filter(k => !allTasks.find(t => t.key === k) && k.startsWith('custom_'))
          const adHocTasks = adHocKeys.map(k => ({ key: k, label: checklist[k]?.label || k.replace('custom_', '').replace(/_/g, ' ') }))
          const totalTasks = [...allTasks, ...adHocTasks]
          const doneCount = totalTasks.filter(t => checklist[t.key]?.done).length
          const allDone = totalTasks.length > 0 && doneCount === totalTasks.length
          const isCollapsed = relevantItems.length > 1 && !expandedLineItems.has(li.id)

          return (
            <div key={li.id} style={{
              background: allDone ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${allDone ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.1)'}`,
              borderRadius: 8, marginBottom: 10, overflow: 'hidden',
              borderLeft: allDone ? '3px solid #22c55e' : '3px solid transparent',
            }}>
              {/* Line item header — clickable to expand/collapse when multiple items */}
              <div
                onClick={() => { if (relevantItems.length > 1) setExpandedLineItems(prev => { const n = new Set(prev); if (n.has(li.id)) n.delete(li.id); else n.add(li.id); return n }) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  cursor: relevantItems.length > 1 ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (relevantItems.length > 1) e.currentTarget.style.background = 'rgba(148,163,184,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {relevantItems.length > 1 && (
                    <span style={{ color: '#475569', fontSize: 12 }}>{isCollapsed ? '▶' : '▼'}</span>
                  )}
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  <span style={{ color: allDone ? '#22c55e' : '#f1f5f9', fontWeight: 500, fontSize: 13 }}>{li.description || li.custom_fields?.item_number || '—'}</span>
                  {li.quantity > 1 && <span style={{ fontSize: 11, color: '#64748b' }}>× {li.quantity}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {allDone ? (
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Complete
                    </span>
                  ) : totalTasks.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.1)', overflow: 'hidden' }}>
                        <div style={{ width: `${(doneCount / totalTasks.length) * 100}%`, height: '100%', borderRadius: 2, background: '#a855f7' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{doneCount}/{totalTasks.length}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Expanded content */}
              {!isCollapsed && (
                <div style={{ padding: '0 16px 16px' }}>
                  {/* Two-track pipeline visualization */}
                  {pipeline && (
                    <LineItemPipeline
                      pipeline={pipeline}
                      checklist={checklist}
                      onToggle={(taskKey, currentDone) => handleToggle(li, taskKey, currentDone)}
                      onAddTrackTask={async (track, label, position) => {
                        const taskKey = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now()}`
                        const oldChecklist = getChecklist(li)
                        const newChecklist = { ...oldChecklist, [taskKey]: { done: false, label, track, position: position ?? 99, ad_hoc: true } as any }
                        onChecklistUpdate(li.id, newChecklist)
                        try {
                          const res = await fetch('/api/line-items/production-checklist', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ line_item_id: li.id, task_key: taskKey, done: false, label, track, position: position ?? 99, ad_hoc: true }),
                          })
                          if (!res.ok) { onChecklistUpdate(li.id, oldChecklist); showToast('Failed to add task', 'error') }
                        } catch { onChecklistUpdate(li.id, oldChecklist); showToast('Failed to add task', 'error') }
                      }}
                    />
                  )}

                  {/* Ad-hoc tasks */}
                  {adHocTasks.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Additional Tasks</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {adHocTasks.map(task => {
                          const isDone = !!checklist[task.key]?.done
                          return (
                            <button key={task.key} onClick={() => handleToggle(li, task.key, isDone)}
                              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${isDone ? '#22c55e' : 'rgba(148,163,184,0.15)'}`, background: isDone ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.02)', color: isDone ? '#22c55e' : '#475569', transition: 'all 0.15s ease' }}>
                              {isDone ? '✓ ' : ''}{task.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add ad-hoc task */}
                  {addingAdHocTask?.lineItemId === li.id ? (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select value={addingAdHocTask.track} onChange={e => setAddingAdHocTask(prev => prev ? { ...prev, track: e.target.value } : prev)}
                        style={{ padding: '5px 8px', borderRadius: 5, background: '#111', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 11 }}>
                        <option value="prep">Prep Track</option>
                        <option value="design">Design Track</option>
                        <option value="production">Production Track</option>
                        <option value="custom">Additional Task</option>
                      </select>
                      <input value={adHocTaskLabel} onChange={e => setAdHocTaskLabel(e.target.value)} placeholder="Task name..."
                        style={{ flex: 1, padding: '5px 10px', background: '#111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 5, color: '#f1f5f9', fontSize: 12, outline: 'none' }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleAddAdHocTask(li) }}
                      />
                      <button onClick={() => handleAddAdHocTask(li)}
                        style={{ padding: '5px 12px', borderRadius: 5, background: '#a855f7', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                      <button onClick={() => { setAddingAdHocTask(null); setAdHocTaskLabel('') }}
                        style={{ padding: '5px 8px', borderRadius: 5, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingAdHocTask({ lineItemId: li.id, track: 'production' })}
                      style={{ marginTop: 10, padding: '5px 14px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: 'transparent', border: '1px dashed rgba(148,163,184,0.15)', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                      + Add Task
                    </button>
                  )}

                  {/* Line item attachments */}
                  {(() => {
                    const atts = (li.attachments || []) as Attachment[]
                    if (atts.length === 0) return null
                    return (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Attachments</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {atts.map((att, idx) => {
                            const url = getAttUrl(att)
                            const name = getAttName(att)
                            const img = isImage(att)
                            if (!url) return null
                            return (
                              <div
                                key={att.key || att.file_id || idx}
                                title={name}
                                onClick={() => {
                                  if (img) {
                                    const allImages = atts.filter(a => isImage(a) && getAttUrl(a))
                                    const imgIdx = allImages.findIndex(a => (a.key || a.file_id) === (att.key || att.file_id))
                                    setLightbox({ images: allImages.map(a => ({ url: getAttUrl(a), label: getAttName(a) })), index: imgIdx >= 0 ? imgIdx : 0 })
                                  } else {
                                    window.open(url, '_blank')
                                  }
                                }}
                                style={{
                                  width: 64, height: 64, borderRadius: 6, overflow: 'hidden',
                                  background: '#0d1220', border: '1px solid rgba(148,163,184,0.1)',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexDirection: 'column', gap: 2, transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)' }}
                              >
                                {img ? (
                                  <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; const fallback = el.parentElement; if (fallback) { const placeholder = document.createElement('div'); placeholder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(148,163,184,0.06);color:#475569;font-size:9px;font-weight:600;'; placeholder.textContent = 'No preview'; fallback.appendChild(placeholder) } }} />
                                ) : (
                                  <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <span style={{ fontSize: 8, color: '#475569', textAlign: 'center', lineHeight: 1.1, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.split('.').pop()?.toUpperCase()}</span>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Document-level files */}
      {docAttachments.length > 0 && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: 10 }}>Project Files</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {docAttachments.map((att, idx) => {
              const url = getAttUrl(att)
              const name = getAttName(att)
              const img = isImage(att)
              if (!url) return null
              return (
                <div
                  key={att.key || att.file_id || idx}
                  title={name}
                  onClick={() => {
                    if (img) {
                      const allImages = docAttachments.filter(a => isImage(a) && getAttUrl(a))
                      const imgIdx = allImages.findIndex(a => (a.key || a.file_id) === (att.key || att.file_id))
                      setLightbox({ images: allImages.map(a => ({ url: getAttUrl(a), label: getAttName(a) })), index: imgIdx >= 0 ? imgIdx : 0 })
                    } else {
                      window.open(url, '_blank')
                    }
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    width: 80, padding: 6, background: '#0d1220',
                    border: '1px solid rgba(148,163,184,0.1)', borderRadius: 6,
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)' }}
                >
                  {img ? (
                    <img src={url} alt={name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4 }} onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; const fallback = el.parentElement; if (fallback) { const placeholder = document.createElement('div'); placeholder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(148,163,184,0.06);color:#475569;font-size:9px;font-weight:600;'; placeholder.textContent = 'No preview'; fallback.appendChild(placeholder) } }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 4, background: 'rgba(148,163,184,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>{name.split('.').pop()?.toUpperCase()}</span>
                    </div>
                  )}
                  <span style={{ fontSize: 9, color: '#475569', textAlign: 'center', lineHeight: 1.2, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && <LightboxOverlay lightbox={lightbox} setLightbox={setLightbox} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule info component (automotive)
// ---------------------------------------------------------------------------

function ScheduleInfo({ doc }: { doc: ProductionDocument }) {
  const event = doc.calendar_events?.[0] // Use first linked calendar event

  if (!event) {
    return (
      <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>No job scheduled</div>
            <div style={{ fontSize: 11, color: '#92750a' }}>This project hasn't been linked to a calendar event yet.</div>
          </div>
        </div>
        <a
          href={`/documents/${doc.id}`}
          style={{
            padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: '#f59e0b', color: '#000', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Schedule It
        </a>
      </div>
    )
  }

  // Calculate durations
  const vehicleDays = event.vehicle_start && event.vehicle_end
    ? Math.ceil((new Date(event.vehicle_end + 'T00:00:00').getTime() - new Date(event.vehicle_start + 'T00:00:00').getTime()) / 86400000)
    : null

  const installDays = event.install_start && event.install_end
    ? Math.ceil((new Date(event.install_end + 'T00:00:00').getTime() - new Date(event.install_start + 'T00:00:00').getTime()) / 86400000)
    : null

  // How many days until vehicle arrives / how many days in
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const vehicleStartDate = event.vehicle_start ? new Date(event.vehicle_start + 'T00:00:00') : null
  const vehicleEndDate = event.vehicle_end ? new Date(event.vehicle_end + 'T00:00:00') : null
  const installStartDate = event.install_start ? new Date(event.install_start + 'T00:00:00') : null
  const installEndDate = event.install_end ? new Date(event.install_end + 'T00:00:00') : null

  let vehicleStatus = ''
  let vehicleStatusColor = '#64748b'
  if (vehicleStartDate && vehicleEndDate) {
    const daysUntilStart = Math.ceil((vehicleStartDate.getTime() - today.getTime()) / 86400000)
    const daysUntilEnd = Math.ceil((vehicleEndDate.getTime() - today.getTime()) / 86400000)
    if (daysUntilStart > 0) {
      vehicleStatus = `Arrives in ${daysUntilStart}d`
      vehicleStatusColor = '#3b82f6'
    } else if (daysUntilEnd > 0) {
      const daysIn = Math.ceil((today.getTime() - vehicleStartDate.getTime()) / 86400000)
      vehicleStatus = `Day ${daysIn} of ${vehicleDays}`
      vehicleStatusColor = '#22c55e'
    } else if (daysUntilEnd === 0) {
      vehicleStatus = 'Pickup today'
      vehicleStatusColor = '#f59e0b'
    } else {
      vehicleStatus = `${Math.abs(daysUntilEnd)}d past pickup`
      vehicleStatusColor = '#ef4444'
    }
  }

  let installStatus = ''
  let installStatusColor = '#64748b'
  if (installStartDate && installEndDate) {
    const daysUntilInstall = Math.ceil((installStartDate.getTime() - today.getTime()) / 86400000)
    const daysUntilInstallEnd = Math.ceil((installEndDate.getTime() - today.getTime()) / 86400000)
    if (daysUntilInstall > 0) {
      installStatus = `Starts in ${daysUntilInstall}d`
      installStatusColor = '#3b82f6'
    } else if (daysUntilInstallEnd > 0) {
      const dayNum = Math.ceil((today.getTime() - installStartDate.getTime()) / 86400000)
      installStatus = `Day ${dayNum} of ${installDays}`
      installStatusColor = '#a855f7'
    } else if (daysUntilInstallEnd === 0) {
      installStatus = 'Last day'
      installStatusColor = '#f59e0b'
    } else {
      installStatus = `${Math.abs(daysUntilInstallEnd)}d past end`
      installStatusColor = '#ef4444'
    }
  }

  const fmtDate = (d: string | null) => d ? formatDate(d) : '—'

  // Build the day cells for the mini calendar strip
  // Show from vehicle_start to vehicle_end (or a reasonable window)
  const stripDays: { date: Date; label: string; dayOfWeek: string; isVehicle: boolean; isInstall: boolean; isToday: boolean; isPast: boolean }[] = []

  if (vehicleStartDate && vehicleEndDate) {
    // Add 1 day padding before and after
    const stripStart = new Date(vehicleStartDate); stripStart.setDate(stripStart.getDate() - 1)
    const stripEnd = new Date(vehicleEndDate); stripEnd.setDate(stripEnd.getDate() + 1)
    const cursor = new Date(stripStart)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    while (cursor <= stripEnd) {
      const d = new Date(cursor)
      const isVehicle = d >= vehicleStartDate && d <= vehicleEndDate
      const isInstall = installStartDate && installEndDate ? d >= installStartDate && d <= installEndDate : false
      const isToday = d.getTime() === today.getTime()
      const isPast = d < today
      stripDays.push({
        date: d,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        dayOfWeek: dayNames[d.getDay()],
        isVehicle,
        isInstall,
        isToday,
        isPast,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return (
    <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 8 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 14 }}>📅</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Job Schedule</span>
        {vehicleStatus && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: vehicleStatusColor, background: `${vehicleStatusColor}15`, padding: '3px 10px', borderRadius: 4 }}>
            {vehicleStatus}
          </span>
        )}
      </div>

      {/* Mini calendar strip */}
      {stripDays.length > 0 && (() => {
        // Determine boundary indices for inline labels
        const firstVehicleIdx = stripDays.findIndex(d => d.isVehicle)
        const lastVehicleIdx = stripDays.length - 1 - [...stripDays].reverse().findIndex(d => d.isVehicle)
        const firstInstallIdx = stripDays.findIndex(d => d.isInstall)
        const lastInstallIdx = stripDays.length - 1 - [...stripDays].reverse().findIndex(d => d.isInstall)
        const hasInstall = firstInstallIdx !== -1

        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingTop: 2, paddingBottom: 4 }}>
              {stripDays.map((day, i) => {
                const isBuffer = !day.isVehicle && !day.isInstall
                const isPastActive = day.isPast && !day.isToday

                // Inline sub-label inside the cell
                let subLabel = ''
                let subColor = ''
                if (i === firstVehicleIdx && !day.isInstall) { subLabel = 'Drop-off'; subColor = '#60a5fa' }
                if (i === lastVehicleIdx && !day.isInstall && lastVehicleIdx !== firstVehicleIdx) { subLabel = 'Pickup'; subColor = '#60a5fa' }
                if (i === firstInstallIdx) { subLabel = 'Install'; subColor = '#c084fc' }
                if (i === lastInstallIdx && lastInstallIdx !== firstInstallIdx) { subLabel = 'Last day'; subColor = '#c084fc' }

                // Styling
                let bg: string
                let border: string
                let dateColor: string
                let dayColor: string

                if (isBuffer) {
                  bg = 'rgba(255,255,255,0.01)'
                  border = '1px solid rgba(148,163,184,0.03)'
                  dateColor = '#1e293b'
                  dayColor = '#1e293b'
                } else if (day.isInstall) {
                  bg = isPastActive ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.3)'
                  border = `2px solid ${isPastActive ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.6)'}`
                  dateColor = isPastActive ? 'rgba(216,180,254,0.5)' : '#e9d5ff'
                  dayColor = isPastActive ? 'rgba(168,85,247,0.4)' : '#c084fc'
                } else if (day.isVehicle) {
                  bg = isPastActive ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.1)'
                  border = `2px dashed ${isPastActive ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.5)'}`
                  dateColor = isPastActive ? 'rgba(147,197,253,0.4)' : '#bfdbfe'
                  dayColor = isPastActive ? 'rgba(59,130,246,0.35)' : '#60a5fa'
                } else {
                  bg = 'transparent'
                  border = '1px solid rgba(148,163,184,0.06)'
                  dateColor = '#475569'
                  dayColor = '#475569'
                }

                // Today override
                if (day.isToday) {
                  dateColor = '#22c55e'
                  dayColor = '#22c55e'
                  if (!subLabel) { subLabel = 'Today'; subColor = '#22c55e' }
                }

                return (
                  <div key={i} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flex: isBuffer ? '0 0 40px' : 1, minWidth: isBuffer ? 40 : 72,
                    padding: isBuffer ? '6px 4px' : '10px 6px 8px', borderRadius: 8,
                    background: bg, border,
                    opacity: isBuffer ? 0.35 : 1,
                    transition: 'all 0.15s ease',
                  }}>
                    <div style={{ fontSize: isBuffer ? 8 : 11, color: dayColor, fontWeight: day.isToday ? 700 : 600, marginBottom: 2, letterSpacing: '0.02em' }}>
                      {day.dayOfWeek}
                    </div>
                    <div style={{ fontSize: isBuffer ? 11 : 16, fontWeight: day.isToday ? 800 : 700, color: dateColor }}>
                      {day.label}
                    </div>
                    {subLabel && (
                      <div style={{ fontSize: 8, fontWeight: 700, color: subColor, marginTop: 4, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                        {subLabel}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Compact info row below strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 11 }}>
              <span style={{ color: '#60a5fa', fontWeight: 500 }}>🚗 Vehicle: {vehicleDays}d on-site</span>
              {hasInstall && <span style={{ color: '#c084fc', fontWeight: 500 }}>🔧 Install: {installDays}d</span>}
              {installStatus && <span style={{ fontWeight: 600, color: installStatusColor, marginLeft: 'auto' }}>{installStatus}</span>}
            </div>
          </div>
        )
      })()}

      {/* Date summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#64748b', minWidth: 52 }}>Drop-off:</span>
          <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{fmtDate(event.vehicle_start)}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>→</span>
          <span style={{ fontSize: 10, color: '#64748b', minWidth: 42 }}>Pickup:</span>
          <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{fmtDate(event.vehicle_end)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#64748b', minWidth: 52 }}>Install:</span>
          <span style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 500 }}>{fmtDate(event.install_start)}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>→</span>
          <span style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 500 }}>{fmtDate(event.install_end)}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lightbox overlay (same as FA Orders)
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return
    e.preventDefault()
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    imgRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    imgRef.current?.releasePointerCapture(e.pointerId)
  }

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          maxWidth: zoomed ? 'none' : '85vw',
          maxHeight: zoomed ? 'none' : '85vh',
          width: zoomed ? '170vw' : undefined,
          objectFit: 'contain', borderRadius: 6,
          cursor: zoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
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
