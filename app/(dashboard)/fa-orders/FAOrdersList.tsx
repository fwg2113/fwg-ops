'use client'

import { useState, useMemo, Fragment, useCallback } from 'react'

type FAOrder = {
  id: string
  order_number: string
  customer_name: string
  email: string
  customer_phone?: string
  status: string
  staff_notes?: string
  items: any[]
  metadata: Record<string, any>
  created_at: string
}

type Tab = 'dtf' | 'embroidery' | 'apparel'

const TABS: { key: Tab; label: string }[] = [
  { key: 'dtf', label: 'DTF Transfers' },
  { key: 'embroidery', label: 'Embroidery' },
  { key: 'apparel', label: 'Apparel' },
]

const STATUS_FLOW: Record<string, { next: string; label: string }[]> = {
  paid: [{ next: 'in_production', label: 'Mark In Production' }],
  new: [{ next: 'in_production', label: 'Mark In Production' }],
  in_production: [{ next: 'printed', label: 'Mark Printed' }],
  printed: [
    { next: 'ready_for_pickup', label: 'Mark Ready for Pickup' },
    { next: 'shipped', label: 'Mark Shipped' },
  ],
}

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

export default function FAOrdersList({ initialOrders }: { initialOrders: FAOrder[] }) {
  const [orders, setOrders] = useState<FAOrder[]>(initialOrders)
  const [activeTab, setActiveTab] = useState<Tab>('dtf')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const handleOrderUpdate = useCallback((updated: FAOrder) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }, [])

  const filteredOrders = useMemo(() => {
    let list = orders

    const hasOrderType = orders.some(o => o.metadata?.order_type)
    if (hasOrderType) {
      list = list.filter(o => o.metadata?.order_type === activeTab)
    } else if (activeTab !== 'dtf') {
      return []
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q)
      )
    }

    return list
  }, [orders, activeTab, search])

  const hasOrderType = orders.some(o => o.metadata?.order_type)

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
      {!hasOrderType && activeTab !== 'dtf' ? (
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>Coming soon</p>
        </div>
      ) : filteredOrders.length === 0 ? (
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
                  {['Order #', 'Customer Name', 'Customer Email', 'Date', 'Items', 'Status', 'Actions'].map(col => (
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
                {filteredOrders.map(order => {
                  const status = getStatusStyle(order.status)
                  const isExpanded = expandedOrder === order.id
                  return (
                    <Fragment key={order.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid rgba(148,163,184,0.05)',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '14px 16px', color: '#22d3ee', fontSize: '14px', fontWeight: 600 }}>
                          {order.order_number || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#f1f5f9', fontSize: '14px' }}>
                          {order.customer_name || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '14px' }}>
                          {order.email || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '14px', whiteSpace: 'nowrap' }}>
                          {order.created_at ? formatDate(order.created_at) : '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '14px' }}>
                          {getItemsSummary(order.items)}
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
                            onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
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
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <OrderDetail order={order} onUpdate={handleOrderUpdate} />
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

  const items = order.items || []
  const artworkToken = order.metadata?.artwork_session_token
  const nextActions = STATUS_FLOW[order.status] || []

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
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '999px',
            background: getStatusStyle(order.status).bg,
            color: getStatusStyle(order.status).color,
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {getStatusStyle(order.status).label}
          </span>
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
          <a
            href={`https://assets.frederickapparel.com/fa/artwork/${artworkToken}/print-ready/`}
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
        </div>
      )}

      {/* Status Workflow */}
      {nextActions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ ...labelStyle, marginBottom: '10px' }}>Workflow</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {nextActions.map(action => {
              if (action.next === 'shipped') {
                return showShipForm ? (
                  <div key={action.next} style={{
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
                ) : (
                  <button
                    key={action.next}
                    onClick={() => setShowShipForm(true)}
                    disabled={updatingStatus}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: `1px solid ${getStatusStyle(action.next).color}40`,
                      background: getStatusStyle(action.next).bg,
                      color: getStatusStyle(action.next).color,
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: updatingStatus ? 'not-allowed' : 'pointer',
                      opacity: updatingStatus ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {action.label}
                  </button>
                )
              }
              const nextStyle = getStatusStyle(action.next)
              return (
                <button
                  key={action.next}
                  onClick={() => handleStatusChange(action.next)}
                  disabled={updatingStatus}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: `1px solid ${nextStyle.color}40`,
                    background: nextStyle.bg,
                    color: nextStyle.color,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: updatingStatus ? 'not-allowed' : 'pointer',
                    opacity: updatingStatus ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {updatingStatus ? 'Updating...' : action.label}
                </button>
              )
            })}
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
