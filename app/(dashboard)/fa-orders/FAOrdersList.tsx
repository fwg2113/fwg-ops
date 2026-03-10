'use client'

import { useState, useMemo, Fragment, useCallback, useEffect } from 'react'

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
}

type FADocument = {
  id: string
  doc_number: string
  doc_type: string
  status: string
  customer_name: string
  total: number
  category?: string
  in_production: boolean
  paid_at?: string
  created_at: string
  line_items: LineItem[]
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
    default:
      return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: status || 'Unknown' }
  }
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
        status: d.in_production ? 'in_production' : d.status,
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

    // Sort by date descending
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return list
  }, [orders, documents, activeTab, search, getOrderTab, getDocumentTab])

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
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Source', 'Order #', 'Customer Name', 'Date', 'Items', 'Status', 'Actions'].map(col => (
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
                {filteredRows.map(row => {
                  const status = getStatusStyle(row.status)
                  const isExpanded = expandedOrder === row.id
                  return (
                    <Fragment key={`${row.source}-${row.id}`}>
                      <tr
                        style={{
                          borderBottom: '1px solid rgba(148,163,184,0.05)',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            background: row.source === 'fa_order' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
                            color: row.source === 'fa_order' ? '#a855f7' : '#3b82f6',
                          }}>
                            {row.source === 'fa_order' ? 'FA' : 'FWG'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#22d3ee', fontSize: '14px', fontWeight: 600 }}>
                          {row.orderNumber}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#f1f5f9', fontSize: '14px' }}>
                          {row.customerName}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '14px', whiteSpace: 'nowrap' }}>
                          {row.date ? formatDate(row.date) : '—'}
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
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : row.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(34,211,238,0.3)',
                              background: isExpanded ? 'rgba(34,211,238,0.15)' : 'transparent',
                              color: '#22d3ee',
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && row.source === 'fa_order' && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <OrderDetail order={row.raw as FAOrder} onUpdate={handleOrderUpdate} />
                          </td>
                        </tr>
                      )}
                      {isExpanded && row.source === 'document' && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <DocumentDetail doc={row.raw as FADocument} />
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

function DocumentDetail({ doc }: { doc: FADocument }) {
  return (
    <div style={{
      padding: '24px 20px 24px 48px',
      background: 'rgba(59,130,246,0.03)',
      borderBottom: '1px solid rgba(148,163,184,0.1)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div>
          <div style={labelStyle}>Customer</div>
          <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>{doc.customer_name || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Document</div>
          <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 600 }}>{doc.doc_number || '—'}</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
            {doc.doc_type === 'invoice' ? 'Invoice' : doc.doc_type === 'quote' ? 'Quote' : doc.doc_type || '—'}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Total</div>
          <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>
            {doc.total != null ? `$${Number(doc.total).toFixed(2)}` : '—'}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
            {doc.created_at ? formatDate(doc.created_at) : '—'}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div style={{ ...labelStyle, marginBottom: '10px' }}>Line Items</div>
        {doc.line_items.length > 0 ? (
          <div style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Item', 'Category', 'Qty', 'Unit Price', 'Total'].map(col => (
                    <th key={col} style={thStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.line_items.map((li) => (
                  <tr key={li.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#f1f5f9', fontSize: '13px' }}>
                      {li.description || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '13px' }}>
                      {li.category?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '13px' }}>
                      {li.quantity || 1}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '13px' }}>
                      {li.unit_price != null ? `$${Number(li.unit_price).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#f1f5f9', fontSize: '13px', fontWeight: 500 }}>
                      {li.line_total != null ? `$${Number(li.line_total).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No line items</p>
        )}
      </div>
    </div>
  )
}
