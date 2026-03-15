'use client'

import React, { useState, useMemo, Fragment, useCallback, useEffect } from 'react'

type OrderItem = {
  id: string
  order_id: string
  name: string
  description?: string
  quantity: number
  unit_price_cents: number
  total_price_cents: number
  product_type?: string
  metadata?: any
  file_url?: string
  thumbnail_url?: string
}

type FAOrder = {
  id: string
  order_number: string
  customer_name: string
  email: string
  customer_phone?: string
  status: string
  staff_notes?: string
  items: any[]
  order_items: OrderItem[]
  metadata: Record<string, any>
  created_at: string
}

type LineItem = {
  id: string
  document_id: string
  category: string
  description?: string
  quantity: number
  unit_price?: number
  line_total?: number
  supplier?: string
  decoration_type?: string
  custom_fields?: any
  garment_source?: string
  garment_status?: string
  received_quantities?: Record<string, number>
  receiving_notes?: string
  transfer_status?: string
  attachments?: any[]
  garments_sorted?: boolean
  transfers_printed?: boolean
  transfers_cut_sorted?: boolean
}

type FADocument = {
  id: string
  doc_number: string
  doc_type: string
  status: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  total: number
  category?: string
  in_production: boolean
  paid_at?: string
  created_at: string
  line_items: LineItem[]
  folded_counted_sorted?: boolean
  ready_for_customer?: boolean
  design_approved?: boolean
  sent_to_zayn?: boolean
  digitized?: boolean
  due_date?: string
  production_sort_order?: number
  // New pipeline fields
  ready_for_qc?: boolean
  qc_passed?: boolean
  packaged?: boolean
  shipped?: boolean
  tracking_number?: string
  shipping_label_url?: string
  easypost_shipment_id?: string
  pickup_location?: string
  customer_notified_at?: string
  notification_method?: string
  fulfillment_type?: string
  fulfillment_details?: any
}

type Tab = 'dtf' | 'embroidery' | 'apparel' | 'completed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'dtf', label: 'DTF Transfers' },
  { key: 'embroidery', label: 'Embroidery' },
  { key: 'apparel', label: 'Apparel' },
  { key: 'completed', label: 'Completed' },
]

const COMPLETED_STATUSES = ['completed', 'picked_up', 'shipped']

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'in_production', label: 'In Production' },
  { value: 'printed', label: 'Printed' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'paid':
      return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Paid' }
    case 'new':
      return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'New' }
    case 'in_production':
      return { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'In Production' }
    case 'printed':
      return { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', label: 'Printed' }
    case 'ready_for_pickup':
      return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Ready for Pickup' }
    case 'shipped':
      return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Shipped' }
    case 'picked_up':
      return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Picked Up' }
    case 'completed':
      return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Completed' }
    case 'cancelled':
      return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Cancelled' }
    // Pipeline-derived statuses
    case 'awaiting_garments':
      return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Awaiting Garments' }
    case 'garments_received':
      return { bg: 'rgba(34,211,238,0.15)', color: '#22d3ee', label: 'Garments Received' }
    case 'ready_for_production':
      return { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', label: 'Ready for Production' }
    case 'folded_packed':
      return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Folded & Packed' }
    case 'ready_for_qc':
      return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Ready for QC' }
    case 'qc_passed':
      return { bg: 'rgba(34,211,238,0.15)', color: '#22d3ee', label: 'QC Passed' }
    case 'packaged':
      return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Packaged' }
    default:
      return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: status || 'Unknown' }
  }
}

function getDocPipelineStatus(d: FADocument, tab: Tab): string {
  // Terminal statuses take precedence
  if (COMPLETED_STATUSES.includes(d.status) || d.status === 'cancelled') return d.status

  // New pipeline statuses (check most advanced first)
  if (d.shipped) return 'shipped'
  if (d.packaged) return 'packaged'
  if (d.qc_passed) return 'qc_passed'
  if (d.ready_for_qc) return 'ready_for_qc'

  // Legacy fallbacks
  if (d.ready_for_customer) return 'ready_for_pickup'
  if (d.folded_counted_sorted) return 'folded_packed'

  // In production
  if (d.in_production) return 'in_production'

  // Compute garment track status from line items
  const apparelItems = d.line_items.filter(li =>
    li.custom_fields?.apparel_mode === true || li.custom_fields?.apparel_mode === 'true'
  )
  const isEmb = tab === 'embroidery'
  const relevantItems = isEmb
    ? apparelItems.filter(li => li.category === 'EMBROIDERY')
    : apparelItems.filter(li => li.category !== 'EMBROIDERY')

  if (relevantItems.length === 0) return d.status

  // Check garments
  const allGarmentsSorted = relevantItems.every(li => li.garments_sorted)
  const allGarmentsReceived = relevantItems.every(li => {
    const src = li.garment_source || li.custom_fields?.garment_source || ''
    if (!src) return false
    const rawSizes: Record<string, any> = li.custom_fields?.sizes || {}
    const totalOrdered = Object.values(rawSizes).reduce((a: number, v: any) => a + (typeof v === 'object' && v !== null ? Number(v.qty ?? v) : Number(v)), 0)
    const totalReceived = Object.values(li.received_quantities || {}).reduce((a: number, b: any) => a + Number(b), 0)
    return totalOrdered > 0 && totalReceived >= totalOrdered
  })

  // Check second track (artwork/transfers)
  const allArtworkDone = relevantItems.every(li => li.custom_fields?.artwork_source === 'already_done' || li.custom_fields?.artwork_source === 'same_logo')
  let secondTrackDone = false
  if (isEmb) {
    secondTrackDone = (d.digitized || allArtworkDone) ? true : false
  } else {
    secondTrackDone = relevantItems.every(li => li.transfers_cut_sorted) || allArtworkDone
  }

  // Ready for production = both tracks complete
  if (allGarmentsSorted && secondTrackDone) return 'ready_for_production'
  if (allGarmentsReceived) return 'garments_received'

  const anySourceSet = relevantItems.some(li => li.garment_source || li.custom_fields?.garment_source)
  if (anySourceSet) return 'awaiting_garments'

  return d.status
}

function getItemsSummary(items: any[]): string {
  if (!items || items.length === 0) return '—'
  const totalQty = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
  return `${items.length} item${items.length !== 1 ? 's' : ''} (${totalQty} qty)`
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '4px',
  fontWeight: 600,
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

export default function FAOrdersList({ faOrders, documents }: { faOrders: FAOrder[]; documents: FADocument[] }) {
  const [orders, setOrders] = useState<FAOrder[]>(faOrders)
  const [activeTab, setActiveTab] = useState<Tab>('dtf')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const handleOrderUpdate = useCallback((updated: FAOrder) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }, [])

  const getOrderTab = useCallback((order: FAOrder): Tab => {
    const names = (order.order_items || []).map(i => (i.name || '').toLowerCase())
    if (names.some(n => /dtf|transfer/.test(n))) return 'dtf'
    if (names.some(n => /embroidery/.test(n))) return 'embroidery'
    if (names.some(n => /apparel|shirt|hoodie|hat/.test(n))) return 'apparel'
    return 'dtf'
  }, [])

  const getDocumentTab = useCallback((doc: FADocument): Tab => {
    const categories = doc.line_items.map(li => li.category)
    if (categories.includes('DTF_TRANSFER')) return 'dtf'
    if (categories.includes('EMBROIDERY')) return 'embroidery'
    if (categories.includes('APPAREL')) return 'apparel'
    return 'apparel'
  }, [])

  // Unified row type for rendering both FA orders and FWG documents in the same table
  type UnifiedRow = {
    id: string
    source: 'fa_order' | 'document'
    orderNumber: string
    customerName: string
    email: string
    date: string
    dueDate: string
    sortOrder: number
    status: string
    itemsSummary: string
    raw: FAOrder | FADocument
  }

  const filteredRows = useMemo(() => {
    // Build unified rows from FA orders
    const orderRows: UnifiedRow[] = orders.map(o => ({
      id: o.id,
      source: 'fa_order' as const,
      orderNumber: o.order_number || '—',
      customerName: o.customer_name || '—',
      email: o.email || '—',
      date: o.created_at,
      dueDate: '',
      sortOrder: 0,
      status: o.status,
      itemsSummary: getItemsSummary(o.items),
      raw: o,
    }))

    // Build unified rows from documents
    const docRows: UnifiedRow[] = documents.map(d => {
      const totalQty = d.line_items.reduce((sum, li) => sum + (li.quantity || 1), 0)
      return {
        id: d.id,
        source: 'document' as const,
        orderNumber: d.doc_number || '—',
        customerName: d.customer_name || '—',
        email: '',
        date: d.created_at,
        dueDate: d.due_date || '',
        sortOrder: d.production_sort_order || 0,
        status: getDocPipelineStatus(d, activeTab),
        itemsSummary: `${d.line_items.length} item${d.line_items.length !== 1 ? 's' : ''} (${totalQty} qty)`,
        raw: d,
      }
    })

    const allRows = [...orderRows, ...docRows]

    let list: UnifiedRow[]

    if (activeTab === 'completed') {
      list = allRows.filter(r => COMPLETED_STATUSES.includes(r.status))
    } else {
      list = allRows.filter(r => {
        if (COMPLETED_STATUSES.includes(r.status) || r.status === 'cancelled') return false
        if (r.source === 'fa_order') return getOrderTab(r.raw as FAOrder) === activeTab
        return getDocumentTab(r.raw as FADocument) === activeTab
      })
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.orderNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      )
    }

    // Sort: custom order first, then by due date (soonest first), then created date
    list.sort((a, b) => {
      // Custom sort order takes priority (non-zero means manually ordered)
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      // Then by due date (soonest first, no due date goes last)
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      // Then by created date descending
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return list
  }, [orders, documents, activeTab, search, getOrderTab, getDocumentTab])

  // Drag and drop state
  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [rowOrder, setRowOrder] = useState<string[]>([])
  const [hasCustomOrder, setHasCustomOrder] = useState(false)

  // Sync row order from filteredRows
  useEffect(() => {
    if (!hasCustomOrder) {
      setRowOrder(filteredRows.map(r => r.id))
    }
  }, [filteredRows, hasCustomOrder])

  const displayRows = useMemo(() => {
    if (!hasCustomOrder) return filteredRows
    return rowOrder.map(id => filteredRows.find(r => r.id === id)).filter(Boolean) as typeof filteredRows
  }, [filteredRows, rowOrder, hasCustomOrder])

  const handleDragStart = (rowId: string) => {
    setDragRowId(rowId)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragRowId || dragRowId === targetId) return
    setRowOrder(prev => {
      const order = hasCustomOrder ? [...prev] : filteredRows.map(r => r.id)
      const fromIdx = order.indexOf(dragRowId)
      const toIdx = order.indexOf(targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, dragRowId)
      return order
    })
    if (!hasCustomOrder) setHasCustomOrder(true)
  }

  const handleDragEnd = () => {
    setDragRowId(null)
  }

  const saveRowOrder = async () => {
    const updates = rowOrder.map((id, idx) => ({ id, sort_order: idx + 1 }))
    for (const u of updates) {
      const row = filteredRows.find(r => r.id === u.id)
      if (row?.source === 'document') {
        await fetch(`/api/documents/${u.id}/production-status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ production_sort_order: u.sort_order }),
        })
      }
    }
    setHasCustomOrder(false)
  }

  const resetRowOrder = () => {
    setHasCustomOrder(false)
    setRowOrder(filteredRows.map(r => r.id))
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          FA <span style={{
            background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Orders</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Frederick Apparel order management
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: '#1a1a1a',
        borderRadius: '10px',
        padding: '4px',
        width: 'fit-content',
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setExpandedOrder(null) }}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#22d3ee' : 'transparent',
                color: isActive ? '#000' : '#94a3b8',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '10px 16px',
            background: '#1d1d1d',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Content */}
      {filteredRows.length === 0 ? (
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
            {search ? 'No orders match your search' : 'No orders yet'}
          </p>
        </div>
      ) : (
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {hasCustomOrder && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(34,211,238,0.06)', borderBottom: '1px solid rgba(34,211,238,0.15)' }}>
              <span style={{ fontSize: 12, color: '#22d3ee', fontWeight: 600 }}>Custom order — drag rows to reorder</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetRowOrder} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}>Reset</button>
                <button onClick={saveRowOrder} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#22d3ee', border: 'none', color: '#000' }}>Save Order</button>
              </div>
            </div>
          )}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Order #', 'Customer Name', 'Due Date', 'Items', 'Status', 'Actions'].map(col => (
                    <th key={col} style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      color: '#64748b',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => {
                  const status = getStatusStyle(row.status)
                  const isExpanded = expandedOrder === row.id
                  const isDragging = dragRowId === row.id
                  // Due date row tint
                  let rowTint = 'transparent'
                  if (row.dueDate) {
                    const due = new Date(row.dueDate + 'T00:00:00')
                    const now = new Date(); now.setHours(0, 0, 0, 0)
                    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    rowTint = daysLeft <= 0 ? 'rgba(239,68,68,0.06)' : daysLeft <= 2 ? 'rgba(239,68,68,0.04)' : daysLeft <= 4 ? 'rgba(245,158,11,0.04)' : 'rgba(34,197,94,0.04)'
                  }
                  return (
                    <Fragment key={`${row.source}-${row.id}`}>
                      <tr
                        draggable
                        onDragStart={() => handleDragStart(row.id)}
                        onDragOver={(e) => handleDragOver(e, row.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                          borderBottom: '1px solid rgba(148,163,184,0.05)',
                          transition: 'background 0.15s ease, opacity 0.15s',
                          cursor: 'grab',
                          background: rowTint,
                          opacity: isDragging ? 0.5 : 1,
                          borderLeft: row.dueDate ? `3px solid ${(() => { const due = new Date(row.dueDate + 'T00:00:00'); const now = new Date(); now.setHours(0,0,0,0); const d = Math.ceil((due.getTime() - now.getTime()) / 86400000); return d <= 0 ? '#ef4444' : d <= 2 ? '#ef4444' : d <= 4 ? '#f59e0b' : '#22c55e' })()}` : '3px solid transparent',
                        }}
                        onClick={() => setExpandedOrder(isExpanded ? null : row.id)}
                        onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(148,163,184,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = rowTint }}
                      >
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600 }}>
                          {row.source === 'document' ? (
                            <a
                              href={`/documents/${row.id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#22d3ee', textDecoration: 'none' }}
                              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                            >
                              {row.orderNumber}
                            </a>
                          ) : (
                            <span style={{ color: '#22d3ee' }}>{row.orderNumber}</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#f1f5f9', fontSize: '14px' }}>
                          {row.customerName}
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {(() => {
                            if (!row.dueDate) return <span style={{ color: '#475569', fontSize: 13 }}>—</span>
                            const due = new Date(row.dueDate + 'T00:00:00')
                            const now = new Date()
                            now.setHours(0, 0, 0, 0)
                            const diffMs = due.getTime() - now.getTime()
                            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
                            const dueDateColor = daysLeft <= 0 ? '#ef4444' : daysLeft <= 2 ? '#ef4444' : daysLeft <= 4 ? '#f59e0b' : '#22c55e'
                            const countdown = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: '#94a3b8', fontSize: 13 }}>{formatDate(row.dueDate)}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: dueDateColor }}>{countdown}</span>
                              </div>
                            )
                          })()}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '14px' }}>
                          {row.itemsSummary}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: status.bg,
                            color: status.color,
                            fontSize: '12px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            color: '#475569',
                            fontSize: '18px',
                            lineHeight: 1,
                            userSelect: 'none',
                          }}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && row.source === 'fa_order' && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <OrderDetail order={row.raw as FAOrder} onUpdate={handleOrderUpdate} />
                          </td>
                        </tr>
                      )}
                      {isExpanded && row.source === 'document' && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <DocumentDetail doc={row.raw as FADocument} mode={activeTab === 'embroidery' ? 'embroidery' : 'apparel'} />
                          </td>
                        </tr>
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

function OrderDetail({ order, onUpdate }: { order: FAOrder; onUpdate: (o: FAOrder) => void }) {
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [notes, setNotes] = useState(order.staff_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showShipForm, setShowShipForm] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [printFileUrl, setPrintFileUrl] = useState<string | null>(null)
  const [printFileLoading, setPrintFileLoading] = useState(false)
  const [printFileNotFound, setPrintFileNotFound] = useState(false)
  const [driveStatus, setDriveStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const items = order.items || []
  const artworkToken = order.metadata?.artwork_session_token

  useEffect(() => {
    if (!artworkToken) return
    setPrintFileLoading(true)
    fetch(`/api/fa-orders/print-file?session_token=${encodeURIComponent(artworkToken)}`)
      .then(res => {
        if (!res.ok) { setPrintFileNotFound(true); return null }
        return res.json()
      })
      .then(data => {
        if (data?.url) setPrintFileUrl(data.url)
        else setPrintFileNotFound(true)
      })
      .catch(() => setPrintFileNotFound(true))
      .finally(() => setPrintFileLoading(false))
  }, [artworkToken])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleStatusChange = async (newStatus: string, extra?: Record<string, string>) => {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/fa-orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extra }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to update status', 'error')
        return
      }
      onUpdate({ ...order, ...data.order })
      showToast('Status updated', 'success')
      setShowShipForm(false)
      setTrackingNumber('')
      window.dispatchEvent(new Event('unread-counts-changed'))
    } catch {
      showToast('Failed to update status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSendToDrive = async () => {
    if (!printFileUrl || !order.order_number) return
    setDriveStatus('sending')
    try {
      const res = await fetch(`/api/fa-orders/${order.id}/send-to-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printFileUrl, orderNumber: order.order_number }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setDriveStatus('error')
        showToast(data.error || 'Drive upload failed', 'error')
        return
      }
      setDriveStatus('sent')
      showToast('File sent to Google Drive', 'success')
    } catch {
      setDriveStatus('error')
      showToast('Drive upload failed', 'error')
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/fa-orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to save notes', 'error')
        return
      }
      onUpdate({ ...order, ...data.order })
      showToast('Notes saved', 'success')
    } catch {
      showToast('Failed to save notes', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div style={{
      padding: '24px 20px 24px 48px',
      background: 'rgba(34,211,238,0.03)',
      borderBottom: '1px solid rgba(148,163,184,0.1)',
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 9999,
        }}>
          {toast.message}
        </div>
      )}

      {/* Customer Info + Order Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div>
          <div style={labelStyle}>Customer</div>
          <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>{order.customer_name || '—'}</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{order.email || '—'}</div>
          {order.customer_phone && (
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{order.customer_phone}</div>
          )}
        </div>
        <div>
          <div style={labelStyle}>Order Number</div>
          <div style={{ fontSize: '14px', color: '#22d3ee', fontWeight: 600 }}>{order.order_number || '—'}</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
            {order.created_at ? formatDate(order.created_at) : '—'}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Status</div>
          <select
            value={order.status}
            disabled={updatingStatus}
            onChange={async (e) => {
              const newStatus = e.target.value
              if (newStatus === order.status) return
              if (newStatus === 'shipped') {
                setShowShipForm(true)
                return
              }
              await handleStatusChange(newStatus)
            }}
            style={{
              padding: '6px 28px 6px 10px',
              borderRadius: '999px',
              border: `1px solid ${getStatusStyle(order.status).color}40`,
              background: getStatusStyle(order.status).bg,
              color: getStatusStyle(order.status).color,
              fontSize: '12px',
              fontWeight: 600,
              cursor: updatingStatus ? 'not-allowed' : 'pointer',
              opacity: updatingStatus ? 0.5 : 1,
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {updatingStatus && <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>Saving...</span>}
        </div>
      </div>

      {/* Line Items */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ ...labelStyle, marginBottom: '10px' }}>Line Items</div>
        {items.length > 0 ? (
          <div style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Item', 'Size', 'Qty', 'Unit Price', 'Total'].map(col => (
                    <th key={col} style={thStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => {
                  const qty = item.quantity || 1
                  const price = item.price != null ? Number(item.price) : null
                  const total = price != null ? price * qty : null
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                      <td style={{ padding: '10px 14px', color: '#f1f5f9', fontSize: '13px' }}>
                        {item.name || item.description || item.title || `Item ${i + 1}`}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '13px' }}>
                        {item.size || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '13px' }}>
                        {qty}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '13px' }}>
                        {price != null ? `$${price.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#f1f5f9', fontSize: '13px', fontWeight: 500 }}>
                        {total != null ? `$${total.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No line items</p>
        )}
      </div>

      {/* Print-Ready File */}
      {artworkToken && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ ...labelStyle, marginBottom: '10px' }}>Print-Ready File</div>
          {printFileLoading ? (
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Loading print file...</span>
          ) : printFileNotFound ? (
            <span style={{ fontSize: '13px', color: '#64748b' }}>No print file found</span>
          ) : printFileUrl ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <a
                href={printFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'rgba(34,211,238,0.1)',
                  border: '1px solid rgba(34,211,238,0.25)',
                  color: '#22d3ee',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Print File
              </a>
              {driveStatus === 'sent' ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  color: '#22c55e',
                  fontSize: '13px',
                  fontWeight: 500,
                }}>
                  Sent to Drive
                </span>
              ) : driveStatus === 'error' ? (
                <button
                  onClick={handleSendToDrive}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  Drive upload failed — try again
                </button>
              ) : (
                <button
                  onClick={handleSendToDrive}
                  disabled={driveStatus === 'sending'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'rgba(66,133,244,0.1)',
                    border: '1px solid rgba(66,133,244,0.25)',
                    color: '#4285f4',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: driveStatus === 'sending' ? 'not-allowed' : 'pointer',
                    opacity: driveStatus === 'sending' ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M7.71 3.5L1.15 15l3.43 5.95h6.86l-3.43-5.95L7.71 3.5zm1.14 0l6.56 11.5H22l-6.56-11.5H8.85zM14.29 15.95L17.71 22H4.57l3.43-5.95h6.29z" />
                  </svg>
                  {driveStatus === 'sending' ? 'Sending...' : 'Send to Drive'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Shipping Form (shown when "Shipped" is selected from dropdown) */}
      {showShipForm && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', whiteSpace: 'nowrap' }}>Tracking #</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="Optional"
              style={{
                padding: '8px 12px',
                background: '#111111',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '13px',
                outline: 'none',
                width: '180px',
              }}
              autoFocus
            />
            <button
              onClick={() => handleStatusChange('shipped', trackingNumber.trim() ? { tracking_number: trackingNumber.trim() } : undefined)}
              disabled={updatingStatus}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#22c55e',
                color: '#000',
                fontSize: '13px',
                fontWeight: 600,
                cursor: updatingStatus ? 'not-allowed' : 'pointer',
                opacity: updatingStatus ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {updatingStatus ? 'Updating...' : 'Confirm Shipment'}
            </button>
            <button
              onClick={() => { setShowShipForm(false); setTrackingNumber('') }}
              disabled={updatingStatus}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <div style={{ ...labelStyle, marginBottom: '10px' }}>Internal Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add internal notes about this order..."
          rows={3}
          style={{
            width: '100%',
            maxWidth: '600px',
            padding: '10px 14px',
            background: '#1a1a1a',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: '13px',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes || notes === (order.staff_notes || '')}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: notes === (order.staff_notes || '') ? '#282a30' : '#22d3ee',
              color: notes === (order.staff_notes || '') ? '#64748b' : '#000',
              fontSize: '13px',
              fontWeight: 600,
              cursor: savingNotes || notes === (order.staff_notes || '') ? 'not-allowed' : 'pointer',
              opacity: savingNotes ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {savingNotes ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShippingLabelModal({ doc, docState, setDocState, showToast, onClose }: { doc: FADocument; docState: any; setDocState: (fn: any) => void; showToast: (m: string, t: 'success' | 'error') => void; onClose: () => void }) {
  const [step, setStep] = React.useState<'dimensions' | 'rates' | 'purchased'>( docState.shipping_label_url ? 'purchased' : 'dimensions')
  const [parcel, setParcel] = React.useState({ length: '', width: '', height: '', weight: '' })
  const [rates, setRates] = React.useState<any[]>([])
  const [shipmentId, setShipmentId] = React.useState('')
  const [selectedRate, setSelectedRate] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [notifying, setNotifying] = React.useState(false)

  const getRates = async () => {
    if (!parcel.length || !parcel.width || !parcel.height || !parcel.weight) {
      showToast('Fill in all dimensions', 'error'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, parcel: { length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height), weight: Number(parcel.weight) } }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed to get rates', 'error'); return }
      setRates(data.rates)
      setShipmentId(data.shipment_id)
      setStep('rates')
    } catch { showToast('Failed to get rates', 'error') }
    finally { setLoading(false) }
  }

  const buyLabel = async () => {
    if (!selectedRate) { showToast('Select a rate', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/shipping/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, shipment_id: shipmentId, rate_id: selectedRate }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed to buy label', 'error'); return }
      setDocState((prev: any) => ({ ...prev, shipped: true, tracking_number: data.tracking_number, shipping_label_url: data.label_url }))
      showToast('Label purchased!', 'success')
      setStep('purchased')
    } catch { showToast('Failed to purchase label', 'error') }
    finally { setLoading(false) }
  }

  const notifyCustomer = async () => {
    setNotifying(true)
    try {
      const channels = []
      if (doc.customer_email) channels.push('email')
      if (doc.customer_phone) channels.push('sms')
      if (channels.length === 0) { showToast('No customer email or phone on file', 'error'); setNotifying(false); return }
      const res = await fetch('/api/notifications/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, type: 'shipped', channels }),
      })
      if (!res.ok) { showToast('Notification failed', 'error'); return }
      setDocState((prev: any) => ({ ...prev, customer_notified_at: new Date().toISOString() }))
      showToast('Customer notified!', 'success')
    } catch { showToast('Notification failed', 'error') }
    finally { setNotifying(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9', fontSize: 13 }

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Shipping Label</div>

      {step === 'dimensions' && (
        <>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Enter package dimensions to get shipping rates.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Length (in)</div>
              <input type="number" value={parcel.length} onChange={e => setParcel(p => ({ ...p, length: e.target.value }))} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Width (in)</div>
              <input type="number" value={parcel.width} onChange={e => setParcel(p => ({ ...p, width: e.target.value }))} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Height (in)</div>
              <input type="number" value={parcel.height} onChange={e => setParcel(p => ({ ...p, height: e.target.value }))} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Weight (oz)</div>
              <input type="number" value={parcel.weight} onChange={e => setParcel(p => ({ ...p, weight: e.target.value }))} style={inputStyle} placeholder="0" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={getRates} disabled={loading} style={{ padding: '8px 16px', borderRadius: 6, background: '#22d3ee', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Getting Rates...' : 'Get Rates'}
            </button>
          </div>
        </>
      )}

      {step === 'rates' && (
        <>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Select a shipping rate:</div>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
            {rates.map((r: any) => (
              <div key={r.id} onClick={() => setSelectedRate(r.id)}
                style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 8, cursor: 'pointer', border: `2px solid ${selectedRate === r.id ? '#22d3ee' : 'rgba(148,163,184,0.1)'}`, background: selectedRate === r.id ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{r.carrier} — {r.service}</div>
                    {r.delivery_days && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.delivery_days} business day{r.delivery_days !== 1 ? 's' : ''}</div>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>${Number(r.rate).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {rates.length === 0 && <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No rates available</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button onClick={() => setStep('dimensions')} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Back</button>
            <button onClick={buyLabel} disabled={loading || !selectedRate} style={{ padding: '8px 16px', borderRadius: 6, background: '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (loading || !selectedRate) ? 0.5 : 1 }}>
              {loading ? 'Purchasing...' : '🏷 Buy Label'}
            </button>
          </div>
        </>
      )}

      {step === 'purchased' && (
        <>
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>Label Purchased!</div>
            {docState.tracking_number && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Tracking: <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{docState.tracking_number}</span></div>}
            {docState.shipping_label_url && <a href={docState.shipping_label_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#22d3ee', textDecoration: 'underline' }}>Print Label →</a>}
          </div>
          {!docState.customer_notified_at && (
            <button onClick={notifyCustomer} disabled={notifying} style={{ width: '100%', padding: '10px 16px', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: notifying ? 0.6 : 1, marginBottom: 8 }}>
              {notifying ? 'Sending...' : `📬 Notify Customer${doc.customer_email ? ' (Email' : ''}${doc.customer_email && doc.customer_phone ? ' + SMS)' : doc.customer_email ? ')' : doc.customer_phone ? ' (SMS)' : ''}`}
            </button>
          )}
          {docState.customer_notified_at && (
            <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', marginBottom: 8 }}>✓ Customer notified</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
          </div>
        </>
      )}
    </>
  )
}

function ReadyForPickupModal({ doc, docState, setDocState, showToast, onClose }: { doc: FADocument; docState: any; setDocState: (fn: any) => void; showToast: (m: string, t: 'success' | 'error') => void; onClose: () => void }) {
  const [pickupLocation, setPickupLocation] = React.useState(docState.pickup_location || '')
  const [notifying, setNotifying] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const saveLocation = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/production-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup_location: pickupLocation }),
      })
      if (!res.ok) { showToast('Save failed', 'error'); return }
      setDocState((prev: any) => ({ ...prev, pickup_location: pickupLocation }))
      showToast('Location saved', 'success')
    } catch { showToast('Save failed', 'error') }
    finally { setSaving(false) }
  }

  const notifyCustomer = async () => {
    setNotifying(true)
    try {
      const channels = []
      if (doc.customer_email) channels.push('email')
      if (doc.customer_phone) channels.push('sms')
      if (channels.length === 0) { showToast('No customer email or phone on file', 'error'); setNotifying(false); return }
      const res = await fetch('/api/notifications/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, type: 'pickup', channels, pickup_location: pickupLocation }),
      })
      if (!res.ok) { showToast('Notification failed', 'error'); return }
      setDocState((prev: any) => ({ ...prev, customer_notified_at: new Date().toISOString() }))
      showToast('Customer notified!', 'success')
    } catch { showToast('Notification failed', 'error') }
    finally { setNotifying(false) }
  }

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Ready for Pickup</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Set the pickup location and notify the customer.</div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Pickup Location / Shelf</div>
        <input
          type="text"
          value={pickupLocation}
          onChange={e => setPickupLocation(e.target.value)}
          placeholder="e.g. Shelf B3, Front counter, etc."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9', fontSize: 13 }}
        />
        {pickupLocation !== docState.pickup_location && (
          <button onClick={saveLocation} disabled={saving} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }}>
            {saving ? 'Saving...' : 'Save Location'}
          </button>
        )}
      </div>

      {!docState.customer_notified_at ? (
        <button onClick={notifyCustomer} disabled={notifying} style={{ width: '100%', padding: '10px 16px', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: notifying ? 0.6 : 1, marginBottom: 12 }}>
          {notifying ? 'Sending...' : `📬 Notify Customer${doc.customer_email ? ' (Email' : ''}${doc.customer_email && doc.customer_phone ? ' + SMS)' : doc.customer_email ? ')' : doc.customer_phone ? ' (SMS)' : ''}`}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', marginBottom: 12 }}>✓ Customer notified</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
      </div>
    </>
  )
}

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
  })

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return
    e.preventDefault()
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    // Pointer capture locks all future pointer events to this element
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
      {/* Close */}
      <button
        onClick={() => setLightbox(null)}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >×</button>

      {/* Prev */}
      {hasMultiple && (
        <button
          onClick={() => goTo((lightbox.index - 1 + lightbox.images.length) % lightbox.images.length)}
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 28, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
        >‹</button>
      )}

      {/* Next */}
      {hasMultiple && (
        <button
          onClick={() => goTo((lightbox.index + 1) % lightbox.images.length)}
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 28, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
        >›</button>
      )}

      {/* Image */}
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
          objectFit: 'contain',
          borderRadius: 6,
          cursor: zoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          transform: zoomed ? `translate(${pan.x}px, ${pan.y}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.15s ease',
          userSelect: 'none',
          touchAction: 'none',
        }}
      />

      {/* Label + counter */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 500, marginBottom: 2 }}>{img.label}</div>
        {hasMultiple && <div>{lightbox.index + 1} / {lightbox.images.length}</div>}
      </div>
    </div>
  )
}

function DocumentDetail({ doc, mode = 'apparel' }: { doc: FADocument; mode?: 'apparel' | 'embroidery' }) {
  const allApparelModeItems = doc.line_items.filter(
    li => li.custom_fields?.apparel_mode === true || li.custom_fields?.apparel_mode === 'true'
  )
  const apparelItems = mode === 'embroidery'
    ? allApparelModeItems.filter(li => li.category === 'EMBROIDERY')
    : allApparelModeItems.filter(li => li.category !== 'EMBROIDERY')
  const nonApparelItems = doc.line_items.filter(
    li => !li.custom_fields?.apparel_mode && li.custom_fields?.apparel_mode !== 'true'
  )

  const [lineItemStates, setLineItemStates] = React.useState<Record<string, {
    garment_source: string
    received_quantities: Record<string, number>
    receiving_notes: string
    transfer_status: string
    transfers_printed: boolean
    transfers_cut_sorted: boolean
    garments_sorted: boolean
    saving: boolean
  }>>(() => {
    const init: Record<string, any> = {}
    doc.line_items.forEach(li => {
      init[li.id] = {
        garment_source: li.garment_source || li.custom_fields?.garment_source || '',
        received_quantities: li.received_quantities || {},
        receiving_notes: li.receiving_notes || '',
        transfer_status: li.transfer_status || 'pending',
        transfers_printed: !!li.transfers_printed,
        transfers_cut_sorted: !!li.transfers_cut_sorted,
        garments_sorted: !!li.garments_sorted,
        saving: false,
      }
    })
    return init
  })

  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [modal, setModal] = React.useState<{
    type: 'garments_ordered' | 'garments_received' | 'garments_sorted' | 'transfers_printed' | 'transfers_cut_sorted' | 'in_production' | 'folded_counted_sorted' | 'ready_for_customer' | 'design_approved' | 'send_to_zayn' | 'digitized' | 'ready_for_qc' | 'qc_passed' | 'packaged' | 'shipping_label' | 'ready_for_pickup' | null
    lineItemId?: string
  }>({ type: null })
  const [lightbox, setLightbox] = React.useState<{ images: { url: string; label: string }[]; index: number } | null>(null)

  const [docState, setDocState] = React.useState({
    in_production: !!doc.in_production,
    folded_counted_sorted: !!doc.folded_counted_sorted,
    ready_for_customer: !!doc.ready_for_customer,
    design_approved: !!doc.design_approved,
    sent_to_zayn: !!doc.sent_to_zayn,
    digitized: !!doc.digitized,
    ready_for_qc: !!doc.ready_for_qc,
    qc_passed: !!doc.qc_passed,
    packaged: !!doc.packaged,
    shipped: !!doc.shipped,
    tracking_number: doc.tracking_number || '',
    shipping_label_url: doc.shipping_label_url || '',
    pickup_location: doc.pickup_location || '',
    customer_notified_at: doc.customer_notified_at || '',
  })

  const saveDocField = async (fields: Record<string, any>) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/production-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Save failed', 'error'); return false }
      setDocState(prev => ({ ...prev, ...fields }))
      showToast('Saved', 'success')
      return true
    } catch {
      showToast('Save failed', 'error')
      return false
    }
  }

  const saveLineItemField = async (lineItemId: string, fields: Record<string, any>) => {
    try {
      const res = await fetch('/api/line-items/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_item_id: lineItemId, ...fields }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Save failed', 'error'); return false }
      showToast('Saved', 'success')
      return true
    } catch {
      showToast('Save failed', 'error')
      return false
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const updateLineItem = (id: string, patch: Partial<typeof lineItemStates[string]>) => {
    setLineItemStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const saveLineItem = async (li: any) => {
    const state = lineItemStates[li.id]
    if (!state) return
    updateLineItem(li.id, { saving: true })
    try {
      const res = await fetch('/api/line-items/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_item_id: li.id,
          garment_source: state.garment_source,
          received_quantities: state.received_quantities,
          receiving_notes: state.receiving_notes,
          transfer_status: state.transfer_status,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Save failed', 'error'); return }
      showToast('Saved', 'success')
    } catch {
      showToast('Save failed', 'error')
    } finally {
      updateLineItem(li.id, { saving: false })
    }
  }

  // Compute pipeline status
  const garmentStatuses = apparelItems.map(li => {
    const rawSizes: Record<string, any> = li.custom_fields?.sizes || {}
    const sizes: Record<string, number> = Object.fromEntries(
      Object.entries(rawSizes).map(([s, v]) => [s, typeof v === 'object' && v !== null ? Number(v.qty ?? v) : Number(v)])
    )
    const totalOrdered = Object.values(sizes).reduce((a, b) => a + b, 0)
    const totalReceived = Object.values(lineItemStates[li.id]?.received_quantities || {}).reduce((a: number, b: any) => a + Number(b), 0)
    if (!lineItemStates[li.id]?.garment_source) return 'pending_source'
    if (totalReceived === 0) return 'ordered'
    if (totalReceived >= totalOrdered) return 'received'
    return 'partially_received'
  })

  const garmentsOrdered = garmentStatuses.some(s => s !== 'pending_source')
  const allGarmentsReceived = garmentStatuses.length > 0 && garmentStatuses.every(s => s === 'received')
  const anyPartial = garmentStatuses.some(s => s === 'partially_received')
  const allGarmentsSorted = apparelItems.length > 0 && apparelItems.every(li => lineItemStates[li.id]?.garments_sorted)
  const designApproved = true
  const allTransfersPrinted = apparelItems.length > 0 && apparelItems.every(li => lineItemStates[li.id]?.transfers_printed)
  const allTransfersCutSorted = apparelItems.length > 0 && apparelItems.every(li => lineItemStates[li.id]?.transfers_cut_sorted)
  // Embroidery artwork track state
  const allArtworkAlreadyDone = apparelItems.length > 0 && apparelItems.every(li => li.custom_fields?.artwork_source === 'already_done' || li.custom_fields?.artwork_source === 'same_logo')
  const designApprovedEmb = !!docState.design_approved || allArtworkAlreadyDone
  const sentToZayn = !!docState.sent_to_zayn || allArtworkAlreadyDone
  const digitized = !!docState.digitized || allArtworkAlreadyDone
  const needsDigitizing = mode === 'embroidery' && !allArtworkAlreadyDone && apparelItems.some(li => li.custom_fields?.include_digitizing !== false)

  // Apparel/DTF artwork track — auto-complete transfers track if already vectorized
  const allTransfersAlreadyDone = mode === 'apparel' && apparelItems.length > 0 && apparelItems.every(li => li.custom_fields?.artwork_source === 'already_done' || li.custom_fields?.artwork_source === 'same_logo')

  const readyForProduction = mode === 'embroidery'
    ? allGarmentsSorted && (digitized || !needsDigitizing)
    : allGarmentsSorted && (allTransfersCutSorted || allTransfersAlreadyDone)
  const inProduction = !!docState.in_production
  const readyForQC = !!docState.ready_for_qc
  const qcPassed = !!docState.qc_passed
  const packaged = !!docState.packaged
  const shipped = !!docState.shipped
  const fulfillmentType = doc.fulfillment_type || ''
  const isShipping = fulfillmentType === 'shipping'
  // Legacy
  const foldedCountedSorted = !!docState.folded_counted_sorted
  const readyForCustomer = !!docState.ready_for_customer

  const node = (done: boolean, active: boolean, partial: boolean, icon: string): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13,
    background: done ? 'rgba(52,211,153,0.15)' : active ? 'rgba(34,211,238,0.12)' : partial ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
    border: `2px solid ${done ? '#22c55e' : active ? '#22d3ee' : partial ? '#f59e0b' : 'rgba(148,163,184,0.15)'}`,
    color: done ? '#22c55e' : active ? '#22d3ee' : partial ? '#f59e0b' : '#475569',
    boxShadow: active ? '0 0 0 3px rgba(34,211,238,0.12)' : 'none',
    flexShrink: 0,
  })
  const lbl = (done: boolean, active: boolean, partial?: boolean): React.CSSProperties => ({
    fontSize: 9, textAlign: 'center' as const, lineHeight: 1.3, fontWeight: 500, marginTop: 4,
    color: done ? '#22c55e' : active ? '#22d3ee' : partial ? '#f59e0b' : '#475569',
  })
  const line = (done: boolean): React.CSSProperties => ({
    flex: 1, height: 2, minWidth: 20,
    background: done ? '#22c55e' : 'rgba(148,163,184,0.1)',
  })

  return (
    <div style={{ padding: '20px 20px 24px 48px', background: 'rgba(59,130,246,0.02)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
      {/* Pipeline Step Modal */}
      {modal.type && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModal({ type: null })}
        >
          <div
            style={{ background: '#111826', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* GARMENTS ORDERED */}
            {modal.type === 'garments_ordered' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Garment Source</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Set the garment source for each line item</div>
                {apparelItems.map((li, idx) => {
                  const state = lineItemStates[li.id]
                  if (!state) return null
                  const sourceOpts = [
                    { val: 'sanmar', label: 'Order SanMar', color: '#22d3ee' },
                    { val: 'stock', label: 'In-House Inventory', color: '#84cc16' },
                    { val: 'customer_supplied', label: 'Customer Provided', color: '#a78bfa' },
                    { val: 'external', label: 'Already Ordered', color: '#f97316' },
                  ]
                  return (
                    <div key={li.id} style={{ padding: '12px 0', borderTop: idx > 0 ? '1px solid rgba(148,163,184,0.08)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c8cdd8', marginBottom: 8 }}>{li.custom_fields?.item_number || 'Item'} {li.custom_fields?.color ? `· ${li.custom_fields.color}` : ''}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {sourceOpts.map(opt => (
                          <button key={opt.val} onClick={() => updateLineItem(li.id, { garment_source: opt.val })}
                            style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${state.garment_source === opt.val ? opt.color : 'rgba(148,163,184,0.15)'}`, background: state.garment_source === opt.val ? `${opt.color}18` : 'transparent', color: state.garment_source === opt.val ? opt.color : '#475569', transition: 'all 0.15s' }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {state.garment_source === 'stock' && (
                        <div style={{ padding: '6px 10px', background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.15)', borderRadius: 6, fontSize: 11, color: '#84cc16', marginTop: 8 }}>
                          Go to inventory and pull these pieces.
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { for (const li of apparelItems) { await saveLineItemField(li.id, { garment_source: lineItemStates[li.id]?.garment_source }) }; setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: '#22d3ee', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Save All
                  </button>
                </div>
              </>
            )}

            {/* GARMENTS RECEIVED */}
            {modal.type === 'garments_received' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Garments Received</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Confirm received quantities for each line item</div>
                {apparelItems.map((li, idx) => {
                  const state = lineItemStates[li.id]
                  if (!state) return null
                  const rawSizes: Record<string, any> = li.custom_fields?.sizes || {}
                  const sizes: Record<string, number> = Object.fromEntries(Object.entries(rawSizes).map(([s, v]) => [s, typeof v === 'object' && v !== null ? Number(v.qty ?? v) : Number(v)]))
                  const SIZE_ORDER = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL']
                  const sizeEntries = Object.entries(sizes).filter(([,q]) => Number(q) > 0).sort(([a],[b]) => (SIZE_ORDER.indexOf(a.toUpperCase()) === -1 ? 99 : SIZE_ORDER.indexOf(a.toUpperCase())) - (SIZE_ORDER.indexOf(b.toUpperCase()) === -1 ? 99 : SIZE_ORDER.indexOf(b.toUpperCase())))
                  const totalOrdered = sizeEntries.reduce((a,[,v]) => a + Number(v), 0)
                  const totalReceived = Object.values(state.received_quantities).reduce((a:number,b:any) => a + Number(b), 0)
                  const allReceived = totalReceived >= totalOrdered && totalOrdered > 0
                  return (
                    <div key={li.id} style={{ padding: '12px 0', borderTop: idx > 0 ? '1px solid rgba(148,163,184,0.08)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#c8cdd8' }}>{li.custom_fields?.item_number || 'Item'} {li.custom_fields?.color ? `· ${li.custom_fields.color}` : ''}</div>
                        <div style={{ fontSize: 11, color: allReceived ? '#22c55e' : '#64748b' }}>{totalReceived} of {totalOrdered} received {allReceived ? '✓' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        {sizeEntries.map(([size, qty]) => {
                          const recvd = state.received_quantities[size] ?? 0
                          const checked = Number(recvd) >= Number(qty)
                          return (
                            <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52, background: checked ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? 'rgba(52,211,153,0.2)' : 'rgba(148,163,184,0.1)'}`, borderRadius: 8, padding: '8px 6px' }}>
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{size}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{qty} pcs</div>
                              <input type="checkbox" checked={checked} onChange={e => updateLineItem(li.id, { received_quantities: { ...state.received_quantities, [size]: e.target.checked ? Number(qty) : 0 } })} style={{ width: 14, height: 14, accentColor: '#22c55e', cursor: 'pointer' }} />
                              <input type="number" value={state.received_quantities[size] ?? ''} min={0} max={Number(qty)} placeholder="0"
                                onChange={e => updateLineItem(li.id, { received_quantities: { ...state.received_quantities, [size]: Number(e.target.value) } })}
                                style={{ width: 40, padding: '3px 4px', background: '#0d1220', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 4, color: '#c8cdd8', fontSize: 11, textAlign: 'center' }} />
                            </div>
                          )
                        })}
                      </div>
                      <textarea value={state.receiving_notes} onChange={e => updateLineItem(li.id, { receiving_notes: e.target.value })} placeholder="Note (e.g. 2XL backordered, ETA next week)…" rows={1}
                        style={{ width: '100%', padding: '6px 8px', background: '#0d1220', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 6, color: '#c8cdd8', fontSize: 11, resize: 'none', fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { for (const li of apparelItems) { const s = lineItemStates[li.id]; if (s) await saveLineItemField(li.id, { received_quantities: s.received_quantities, receiving_notes: s.receiving_notes }) }; setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: '#22d3ee', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Save All
                  </button>
                </div>
              </>
            )}

            {/* GARMENTS SORTED */}
            {modal.type === 'garments_sorted' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Garments Sorted</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Confirm garments are counted and sorted by size</div>
                {apparelItems.map((li, idx) => {
                  const currentlySorted = !!lineItemStates[li.id]?.garments_sorted
                  return (
                    <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: idx > 0 ? '1px solid rgba(148,163,184,0.08)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c8cdd8' }}>{li.custom_fields?.item_number || 'Item'} {li.custom_fields?.color ? `· ${li.custom_fields.color}` : ''}</div>
                      <button onClick={async () => {
                        await saveLineItemField(li.id, { garments_sorted: !currentlySorted })
                        updateLineItem(li.id, { garments_sorted: !currentlySorted })
                      }} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: currentlySorted ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${currentlySorted ? '#22c55e' : 'rgba(148,163,184,0.15)'}`, color: currentlySorted ? '#22c55e' : '#475569' }}>
                        {currentlySorted ? '✓ Sorted' : 'Mark Sorted'}
                      </button>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
                </div>
              </>
            )}

            {/* TRANSFERS PRINTED */}
            {modal.type === 'transfers_printed' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Transfers Printed</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Confirm DTF transfers have been printed</div>
                {apparelItems.map((li, idx) => {
                  const state = lineItemStates[li.id]
                  if (!state) return null
                  const currentlyPrinted = !!state.transfers_printed
                  return (
                    <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: idx > 0 ? '1px solid rgba(148,163,184,0.08)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c8cdd8' }}>{li.custom_fields?.item_number || 'Item'} {li.custom_fields?.color ? `· ${li.custom_fields.color}` : ''}</div>
                      <button onClick={async () => {
                        await saveLineItemField(li.id, { transfer_status: currentlyPrinted ? 'pending' : 'printed' })
                        updateLineItem(li.id, { transfers_printed: !currentlyPrinted })
                      }} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: currentlyPrinted ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${currentlyPrinted ? '#22c55e' : 'rgba(148,163,184,0.15)'}`, color: currentlyPrinted ? '#22c55e' : '#475569' }}>
                        {currentlyPrinted ? '✓ Printed' : 'Mark Printed'}
                      </button>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
                </div>
              </>
            )}

            {/* TRANSFERS CUT & SORTED */}
            {modal.type === 'transfers_cut_sorted' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Transfers Cut & Sorted</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Confirm transfers are cut and sorted by order</div>
                {apparelItems.map((li, idx) => {
                  const state = lineItemStates[li.id]
                  if (!state) return null
                  const currentlyCutSorted = !!state.transfers_cut_sorted
                  return (
                    <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: idx > 0 ? '1px solid rgba(148,163,184,0.08)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c8cdd8' }}>{li.custom_fields?.item_number || 'Item'} {li.custom_fields?.color ? `· ${li.custom_fields.color}` : ''}</div>
                      <button onClick={async () => {
                        await saveLineItemField(li.id, { transfer_status: currentlyCutSorted ? 'printed' : 'ready' })
                        updateLineItem(li.id, { transfers_cut_sorted: !currentlyCutSorted })
                      }} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: currentlyCutSorted ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${currentlyCutSorted ? '#22c55e' : 'rgba(148,163,184,0.15)'}`, color: currentlyCutSorted ? '#22c55e' : '#475569' }}>
                        {currentlyCutSorted ? '✓ Cut & Sorted' : 'Mark Cut & Sorted'}
                      </button>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
                </div>
              </>
            )}

            {/* IN PRODUCTION */}
            {modal.type === 'in_production' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>In Production</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {docState.in_production ? 'Mark order as NOT in production?' : 'Confirm pressing has started on this order.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { await saveDocField({ in_production: !docState.in_production }); setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: docState.in_production ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {docState.in_production ? 'Mark Not In Production' : '✓ Confirm In Production'}
                  </button>
                </div>
              </>
            )}

            {/* READY FOR QC */}
            {modal.type === 'ready_for_qc' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Ready for QC</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {readyForQC ? 'Mark order as NOT ready for QC?' : 'This will create a QC action card for Diogo or Mason to inspect the order.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { await saveDocField({ ready_for_qc: !readyForQC }); setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: readyForQC ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {readyForQC ? 'Mark Not Ready' : '✓ Mark Ready for QC'}
                  </button>
                </div>
              </>
            )}

            {/* QC PASSED */}
            {modal.type === 'qc_passed' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>QC Passed</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {qcPassed ? 'Mark QC as NOT passed?' : 'Confirm the quality control inspection has passed.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { await saveDocField({ qc_passed: !qcPassed }); setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: qcPassed ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {qcPassed ? 'Mark Not Passed' : '✓ Confirm QC Passed'}
                  </button>
                </div>
              </>
            )}

            {/* PACKAGED */}
            {modal.type === 'packaged' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Packaged</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {packaged ? 'Mark order as NOT packaged?' : 'Confirm the order has been packaged and is ready for fulfillment.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { await saveDocField({ packaged: !packaged }); setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: packaged ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {packaged ? 'Mark Not Packaged' : '✓ Confirm Packaged'}
                  </button>
                </div>
              </>
            )}

            {/* SHIPPING LABEL */}
            {modal.type === 'shipping_label' && <ShippingLabelModal doc={doc} docState={docState} setDocState={setDocState} showToast={showToast} onClose={() => setModal({ type: null })} />}

            {/* READY FOR PICKUP */}
            {modal.type === 'ready_for_pickup' && <ReadyForPickupModal doc={doc} docState={docState} setDocState={setDocState} showToast={showToast} onClose={() => setModal({ type: null })} />}

            {/* DESIGN APPROVED (Embroidery) */}
            {modal.type === 'design_approved' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Design Approved</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {docState.design_approved ? 'Mark design as NOT approved?' : 'Confirm the embroidery design has been approved by the customer.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { await saveDocField({ design_approved: !docState.design_approved }); setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: docState.design_approved ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {docState.design_approved ? 'Mark Not Approved' : '✓ Confirm Approved'}
                  </button>
                </div>
              </>
            )}

            {/* SEND TO ZAYN (Embroidery) */}
            {modal.type === 'send_to_zayn' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Send to Zayn</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {docState.sent_to_zayn
                    ? 'Mark as NOT sent to Zayn?'
                    : 'To send the digitizing files to Zayn, open the document detail page and use the "Send to Zayn" button. Once sent, come back here and confirm.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {!docState.sent_to_zayn && (
                    <a href={`/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#22d3ee', textDecoration: 'underline' }}>
                      Open Document →
                    </a>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={async () => { await saveDocField({ sent_to_zayn: !docState.sent_to_zayn }); setModal({ type: null }) }}
                      style={{ padding: '8px 16px', borderRadius: 6, background: docState.sent_to_zayn ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {docState.sent_to_zayn ? 'Mark Not Sent' : '✓ Confirm Sent to Zayn'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* DIGITIZED (Embroidery) */}
            {modal.type === 'digitized' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Digitized</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  {docState.digitized ? 'Mark design as NOT digitized?' : 'Confirm the embroidery design has been digitized and the DST file is ready.'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setModal({ type: null })} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => { await saveDocField({ digitized: !docState.digitized }); setModal({ type: null }) }}
                    style={{ padding: '8px 16px', borderRadius: 6, background: docState.digitized ? '#ef4444' : '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {docState.digitized ? 'Mark Not Digitized' : '✓ Confirm Digitized'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, padding: '10px 18px', borderRadius: 8, background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast.message}
        </div>
      )}

      {/* Customer + Doc Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div>
          <div style={labelStyle}>Customer</div>
          <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{doc.customer_name || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Document</div>
          <div style={{ fontSize: 14, color: '#3b82f6', fontWeight: 600 }}>{doc.doc_number || '—'}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{doc.doc_type === 'invoice' ? 'Invoice' : doc.doc_type || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Total</div>
          <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{doc.total != null ? `${Number(doc.total).toFixed(2)}` : '—'}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{doc.created_at ? formatDate(doc.created_at) : '—'}</div>
        </div>
      </div>

      {/* Pipeline — two parallel tracks merging at Production */}
      {apparelItems.length > 0 && (() => {
        const NODE_W = 56
        const DIAG_W = 48
        const SHARED_NODE_W = 60
        const GAP = 20

        const PipeNode = ({ done, active, partial, children, label, onClick }: { done: boolean, active: boolean, partial?: boolean, children: React.ReactNode, label: string, onClick?: () => void }) => (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: NODE_W }}>
            <div
              onClick={onClick}
              style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
              background: done ? 'rgba(52,211,153,0.15)' : active ? 'rgba(34,211,238,0.12)' : partial ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
              border: `2px solid ${done ? '#22c55e' : active ? '#22d3ee' : partial ? '#f59e0b' : 'rgba(148,163,184,0.15)'}`,
              color: done ? '#22c55e' : active ? '#22d3ee' : partial ? '#f59e0b' : '#475569',
              boxShadow: active ? '0 0 0 3px rgba(34,211,238,0.12)' : 'none',
              cursor: onClick ? 'pointer' : 'default',
            }}>{children}</div>
            <div style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.3, fontWeight: 500, marginTop: 4, color: done ? '#22c55e' : active ? '#22d3ee' : partial ? '#f59e0b' : '#475569' }}>{label}</div>
          </div>
        )

        const Con = ({ done }: { done: boolean }) => (
          <div style={{ flex: 1, minWidth: 20, height: 2, background: done ? '#22c55e' : 'rgba(148,163,184,0.1)', flexShrink: 0, marginBottom: 18 }} />
        )

        const SharedCon = ({ done }: { done: boolean }) => (
          <div style={{ flex: 1, minWidth: 16, height: 2, background: done ? '#22d3ee' : 'rgba(148,163,184,0.1)', flexShrink: 0 }} />
        )

        return (
          <div style={{ marginBottom: 24, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>

              {/* LEFT: Two stacked tracks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, flex: '0 0 45%' }}>

                {/* GARMENTS track */}
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Garments</div>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <PipeNode done={allGarmentsReceived || allGarmentsSorted} active={garmentsOrdered && !allGarmentsReceived && !anyPartial} label={'Garments\nOrdered'} onClick={() => setModal({ type: 'garments_ordered' })}>
                      {allGarmentsReceived || allGarmentsSorted ? '✓' : '📋'}
                    </PipeNode>
                    <Con done={allGarmentsReceived || anyPartial} />
                    <PipeNode done={allGarmentsSorted} active={allGarmentsReceived && !allGarmentsSorted} partial={anyPartial && !allGarmentsReceived} label={anyPartial && !allGarmentsReceived ? 'Partially\nReceived' : 'Garments\nReceived'} onClick={() => setModal({ type: 'garments_received' })}>
                      {allGarmentsSorted ? '✓' : allGarmentsReceived ? '✓' : anyPartial ? '⚠' : '📦'}
                    </PipeNode>
                    <Con done={allGarmentsReceived} />
                    <PipeNode done={allGarmentsSorted} active={allGarmentsReceived && !allGarmentsSorted} label={'Garments\nSorted'} onClick={() => setModal({ type: 'garments_sorted' })}>
                      {allGarmentsSorted ? '✓' : '🗂'}
                    </PipeNode>
                  </div>
                </div>

                {/* SECOND TRACK: Transfers (apparel) or Artwork (embroidery) */}
                {mode === 'embroidery' ? (
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Artwork</div>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <PipeNode done={designApprovedEmb} active={!designApprovedEmb} label={'Design\nApproved'} onClick={() => setModal({ type: 'design_approved' })}>
                        {designApprovedEmb ? '✓' : '🎨'}
                      </PipeNode>
                      <Con done={designApprovedEmb && (sentToZayn || !needsDigitizing)} />
                      <PipeNode
                        done={sentToZayn || !needsDigitizing}
                        active={designApprovedEmb && !sentToZayn && needsDigitizing}
                        label={!needsDigitizing ? 'Send to Zayn\n(N/A)' : 'Send to\nZayn'}
                        onClick={needsDigitizing ? () => setModal({ type: 'send_to_zayn' }) : undefined}
                      >
                        {!needsDigitizing ? '—' : sentToZayn ? '✓' : '📧'}
                      </PipeNode>
                      <Con done={digitized || !needsDigitizing} />
                      <PipeNode done={digitized || !needsDigitizing} active={(sentToZayn || !needsDigitizing) && !(digitized || !needsDigitizing)} label={'Digitized'} onClick={() => setModal({ type: 'digitized' })}>
                        {digitized || !needsDigitizing ? '✓' : '💾'}
                      </PipeNode>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Transfers</div>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <PipeNode done={allTransfersPrinted || allTransfersCutSorted || allTransfersAlreadyDone} active={!allTransfersPrinted && !allTransfersAlreadyDone} label={'Design\nApproved'}>
                        {allTransfersPrinted || allTransfersCutSorted || allTransfersAlreadyDone ? '✓' : '🎨'}
                      </PipeNode>
                      <Con done={allTransfersPrinted || allTransfersAlreadyDone} />
                      <PipeNode done={allTransfersCutSorted || allTransfersAlreadyDone} active={(allTransfersPrinted && !allTransfersCutSorted) && !allTransfersAlreadyDone} label={'Transfers\nPrinted'} onClick={() => setModal({ type: 'transfers_printed' })}>
                        {allTransfersCutSorted || allTransfersAlreadyDone ? '✓' : allTransfersPrinted ? '✓' : '🖨'}
                      </PipeNode>
                      <Con done={allTransfersCutSorted || allTransfersAlreadyDone} />
                      <PipeNode done={allTransfersCutSorted || allTransfersAlreadyDone} active={(allTransfersPrinted && !allTransfersCutSorted) && !allTransfersAlreadyDone} label={'Cut &\nSorted'} onClick={() => setModal({ type: 'transfers_cut_sorted' })}>
                        {allTransfersCutSorted || allTransfersAlreadyDone ? '✓' : '✂️'}
                      </PipeNode>
                    </div>
                  </div>
                )}

              </div>

              {/* DIAGONAL SVG connector */}
              <div style={{ position: 'relative', width: DIAG_W, flexShrink: 0 }}>
                <svg width={DIAG_W} height="100%" style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="none">
                  {/* Top track diagonal */}
                  <line x1="0" y1="52" x2={DIAG_W} y2="50%" stroke={allGarmentsSorted ? '#22c55e' : 'rgba(148,163,184,0.15)'} strokeWidth="2"/>
                  {/* Bottom track diagonal */}
                  <line x1="0" y1="calc(100% - 52px)" x2={DIAG_W} y2="50%" stroke={(mode === 'embroidery' ? (digitized || !needsDigitizing) : (allTransfersCutSorted || allTransfersAlreadyDone)) ? '#22c55e' : 'rgba(148,163,184,0.15)'} strokeWidth="2"/>
                </svg>
              </div>

              {/* RIGHT: Shared track — vertically centered */}
              {(() => {
                const SN = ({ done, active, icon, label, onClick }: { done: boolean; active: boolean; icon: string; label: string; onClick?: () => void }) => (
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: 52 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
                      background: done ? 'rgba(52,211,153,0.15)' : active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${done ? '#22c55e' : active ? '#22d3ee' : 'rgba(148,163,184,0.15)'}`,
                      color: done ? '#22c55e' : active ? '#22d3ee' : '#475569',
                      boxShadow: active ? '0 0 0 3px rgba(34,211,238,0.12)' : 'none',
                      cursor: onClick ? 'pointer' : 'default',
                    }} onClick={onClick}>
                      {done ? '✓' : icon}
                    </div>
                    <div style={{ position: 'absolute', top: '100%', marginTop: 4, fontSize: 8, textAlign: 'center', lineHeight: 1.3, fontWeight: 500, color: done ? '#22c55e' : active ? '#22d3ee' : '#475569', whiteSpace: 'nowrap' }}>{label.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br/>}{l}</React.Fragment>)}</div>
                  </div>
                )

                // Determine final node state
                const finalDone = isShipping ? shipped : (packaged && !isShipping)
                const finalLabel = isShipping ? 'Shipping\nLabel' : 'Ready for\nPickup'
                const finalIcon = isShipping ? '🏷' : '📍'
                const finalModal = isShipping ? 'shipping_label' as const : 'ready_for_pickup' as const

                return (
                  <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center', flex: 1 }}>
                    {/* Ready for Production */}
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: 52 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                        background: inProduction ? 'rgba(52,211,153,0.15)' : readyForProduction ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `2px solid ${inProduction ? '#22c55e' : readyForProduction ? '#22d3ee' : 'rgba(148,163,184,0.15)'}`,
                        color: inProduction ? '#22c55e' : readyForProduction ? '#22d3ee' : '#475569',
                        boxShadow: readyForProduction && !inProduction ? '0 0 0 4px rgba(34,211,238,0.12)' : 'none',
                        cursor: 'pointer',
                      }} onClick={() => setModal({ type: 'in_production' })}>
                        {inProduction ? '✓' : '⚡'}
                      </div>
                      <div style={{ position: 'absolute', top: '100%', marginTop: 4, fontSize: 8, textAlign: 'center', lineHeight: 1.3, fontWeight: 500, color: inProduction ? '#22c55e' : readyForProduction ? '#22d3ee' : '#475569', whiteSpace: 'nowrap' }}>Ready for<br/>Production</div>
                    </div>
                    <SharedCon done={inProduction} />
                    <SN done={readyForQC} active={inProduction && !readyForQC} icon="👕" label={'In\nProduction'} onClick={() => setModal({ type: 'in_production' })} />
                    <SharedCon done={readyForQC} />
                    <SN done={qcPassed} active={readyForQC && !qcPassed} icon="🔍" label={'Ready\nfor QC'} onClick={() => setModal({ type: 'ready_for_qc' })} />
                    <SharedCon done={qcPassed} />
                    <SN done={packaged} active={qcPassed && !packaged} icon="✅" label={'QC\nPassed'} onClick={() => setModal({ type: 'qc_passed' })} />
                    <SharedCon done={packaged} />
                    <SN done={finalDone} active={packaged && !finalDone} icon="📦" label={'Packaged'} onClick={() => setModal({ type: 'packaged' })} />
                    <SharedCon done={finalDone} />
                    <SN done={finalDone} active={packaged && !finalDone} icon={finalIcon} label={finalLabel} onClick={() => setModal({ type: finalModal })} />
                  </div>
                )
              })()}

            </div>
          </div>
        )
      })()}

      {/* Ready for Production Banner */}
      {readyForProduction && (
        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div>
            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>{mode === 'embroidery' ? 'All garments received · Artwork digitized' : 'All garments received · All transfers ready'}</div>
            <div style={{ color: '#4a7a5a', fontSize: 11 }}>{mode === 'embroidery' ? 'This order is ready for embroidery.' : 'This order is ready to press.'}</div>
          </div>
        </div>
      )}

      {/* Apparel Line Items */}
      {apparelItems.map((li) => {
        const state = lineItemStates[li.id]
        if (!state) return null
        const rawSizes: Record<string, any> = li.custom_fields?.sizes || {}
        const sizes: Record<string, number> = Object.fromEntries(
          Object.entries(rawSizes).map(([size, val]) => [
            size,
            typeof val === 'object' && val !== null ? Number(val.qty ?? val) : Number(val)
          ])
        )
        const SIZE_ORDER = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL']
        const sizeEntries = Object.entries(sizes)
          .filter(([, qty]) => Number(qty) > 0)
          .sort(([a], [b]) => {
            const ai = SIZE_ORDER.indexOf(a.toUpperCase())
            const bi = SIZE_ORDER.indexOf(b.toUpperCase())
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })
        const totalOrdered = sizeEntries.reduce((a, [, v]) => a + Number(v), 0)
        const totalReceived = Object.values(state.received_quantities).reduce((a: number, b: any) => a + Number(b), 0)
        const isFullyReceived = totalOrdered > 0 && totalReceived >= totalOrdered
        const isPartial = totalReceived > 0 && !isFullyReceived

        const mockups = (li.attachments || []).filter((a: any) =>
          a.label?.toLowerCase().includes('mock') || a.contentType?.startsWith('image/')
        )

        const isSorted = !!lineItemStates[li.id]?.garments_sorted
        const sourceLabel = state.garment_source === 'customer_supplied' ? 'Customer Provided' : state.garment_source === 'stock' ? 'In-House' : state.garment_source === 'sanmar' ? 'SanMar' : state.garment_source === 'external' ? 'Already Ordered' : ''

        // Collapsed view when fully received
        if (isFullyReceived) {
          return (
            <div key={li.id} style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)', borderRadius: 8, marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{li.custom_fields?.item_number || li.description}</span>
                {li.custom_fields?.color && <span style={{ color: '#64748b', fontSize: 12 }}>· {li.custom_fields.color}</span>}
                <span style={{ fontSize: 11, color: '#94a3b8' }}>· {totalOrdered} pcs</span>
                {sourceLabel && <span style={{ fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>{sourceLabel}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ Received</span>
                {isSorted && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ Sorted</span>}
              </div>
            </div>
          )
        }

        return (
          <div key={li.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, marginBottom: 14, overflow: 'hidden' }}>
            {/* Line item header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{li.custom_fields?.item_number || li.description}</span>
                {li.custom_fields?.color && <span style={{ color: '#64748b', fontSize: 12 }}>· {li.custom_fields.color}</span>}
                <span style={{ fontSize: 11, color: '#94a3b8' }}>· {totalOrdered} pcs</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isPartial && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠ {totalReceived}/{totalOrdered} Received</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {/* Left: Garment sourcing + receiving */}
              <div style={{ padding: '12px 14px', borderRight: '1px solid rgba(148,163,184,0.08)' }}>
                {/* Source selector */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Garment Source</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { val: 'sanmar', label: 'Order SanMar', color: '#22d3ee' },
                      { val: 'stock', label: 'Pull from Stock', color: '#84cc16' },
                      { val: 'customer_supplied', label: 'Customer Provided', color: '#a78bfa' },
                      { val: 'external', label: 'Already Ordered', color: '#f97316' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => updateLineItem(li.id, { garment_source: opt.val })}
                        style={{
                          padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${state.garment_source === opt.val ? opt.color : 'rgba(148,163,184,0.15)'}`,
                          background: state.garment_source === opt.val ? `${opt.color}15` : 'transparent',
                          color: state.garment_source === opt.val ? opt.color : '#475569',
                          transition: 'all 0.15s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {state.garment_source === 'stock' && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.15)', borderRadius: 5, fontSize: 11, color: '#84cc16' }}>
                      Go to inventory and pull these pieces. Check off each size as you grab them.
                    </div>
                  )}
                </div>

                {/* Size receiving grid */}
                {sizeEntries.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mark Received</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {sizeEntries.map(([size, qty]) => {
                        const recvd = state.received_quantities[size] ?? 0
                        const checked = recvd >= Number(qty)
                        return (
                          <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 48 }}>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{size}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{qty} pcs</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const newQty = e.target.checked ? Number(qty) : 0
                                  updateLineItem(li.id, { received_quantities: { ...state.received_quantities, [size]: newQty } })
                                }}
                                style={{ width: 13, height: 13, accentColor: '#22c55e', cursor: 'pointer' }}
                              />
                              <input
                                type="number"
                                value={state.received_quantities[size] ?? ''}
                                min={0}
                                max={Number(qty)}
                                placeholder="0"
                                onChange={e => updateLineItem(li.id, { received_quantities: { ...state.received_quantities, [size]: Number(e.target.value) } })}
                                style={{ width: 34, padding: '2px 4px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 3, color: '#c8cdd8', fontSize: 11, textAlign: 'center' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Receiving notes */}
                <textarea
                  value={state.receiving_notes}
                  onChange={e => updateLineItem(li.id, { receiving_notes: e.target.value })}
                  placeholder="Note (e.g. 2XL backordered, ETA next week)…"
                  rows={2}
                  style={{ width: '100%', marginTop: 10, padding: '6px 10px', background: '#0d1220', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 5, color: '#c8cdd8', fontSize: 11, resize: 'none', fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              {/* Right: Transfers + Mockups */}
              <div style={{ padding: '12px 14px' }}>
                {/* Transfer status */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>DTF Transfers</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {state.transfer_status === 'ready' ? (
                      <button
                        onClick={() => updateLineItem(li.id, { transfer_status: 'pending' })}
                        style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#22c55e' }}
                      >
                        ✓ Transfers Ready
                      </button>
                    ) : (
                      <button
                        onClick={() => updateLineItem(li.id, { transfer_status: 'ready' })}
                        style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }}
                      >
                        Mark Transfers Ready
                      </button>
                    )}
                  </div>
                </div>

                {/* Mockups */}
                {mockups.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mockups</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {mockups.map((m: any, idx: number) => (
                        <div
                          key={idx}
                          title={m.label || `Mockup ${idx + 1}`}
                          onClick={() => setLightbox({ images: mockups.map((mk: any, i: number) => ({ url: mk.url, label: mk.label || `Mockup ${i + 1}` })), index: idx })}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 72, padding: 6, background: '#0d1220', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 6, cursor: 'pointer', textDecoration: 'none', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#22d3ee')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)')}
                        >
                          <img src={m.url} alt={m.label} style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 3 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          <span style={{ fontSize: 9, color: '#475569', textAlign: 'center', lineHeight: 1.2 }}>{m.label || `Mockup ${idx + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save button */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(148,163,184,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => saveLineItem(li)}
                disabled={state.saving}
                style={{ padding: '6px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: state.saving ? 'not-allowed' : 'pointer', background: state.saving ? 'rgba(148,163,184,0.1)' : '#22d3ee', color: state.saving ? '#64748b' : '#000', border: 'none', opacity: state.saving ? 0.6 : 1, transition: 'all 0.15s' }}
              >
                {state.saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )
      })}

      {/* Non-apparel line items fallback */}
      {nonApparelItems.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Other Line Items</div>
          <div style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Item', 'Category', 'Qty', 'Unit Price', 'Total'].map(col => (
                    <th key={col} style={thStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nonApparelItems.map(li => (
                  <tr key={li.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#f1f5f9', fontSize: 13 }}>{li.description || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>{li.category?.replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>{typeof li.quantity === 'object' ? JSON.stringify(li.quantity) : (li.quantity || 1)}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>{li.unit_price != null && !isNaN(Number(li.unit_price)) ? `${Number(li.unit_price).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>{li.line_total != null && !isNaN(Number(li.line_total)) ? `${Number(li.line_total).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox overlay */}
      {lightbox && <LightboxOverlay lightbox={lightbox} setLightbox={setLightbox} />}
    </div>
  )
}
