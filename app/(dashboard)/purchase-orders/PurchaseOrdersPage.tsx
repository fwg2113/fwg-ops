'use client'

import { useState, useEffect, useCallback } from 'react'

// Types
interface SizeData {
  qty: number
  price: number
  wholesale: number
  inventoryKey?: number
  sizeIndex?: number
}

interface AggregateItem {
  lineItemId: string
  style: string
  color: string
  catalogColor?: string
  description: string
  category: string
  sizes: Record<string, SizeData>
  totalQty: number
  totalWholesale: number
  previousOrders: Array<{ po_number: string; status: string; quantity: number }>
}

interface DocumentGroup {
  document: {
    id: string
    doc_number: string
    doc_type: string
    customer_name: string
    status: string
    created_at: string
  }
  items: AggregateItem[]
}

interface POHistoryItem {
  id: string
  purchase_order_id: string
  style: string
  color: string
  catalog_color: string
  size: string
  quantity: number
  wholesale_price: number
  line_cost: number
  warehouse_name: string
  status: string
  source_document_number: string
  customer_name: string
}

interface POHistory {
  id: string
  po_number: string
  supplier: string
  status: string
  total_items: number
  total_units: number
  total_cost: number
  submitted_at: string
  created_at: string
  supplier_confirmation: string
  notes: string
  items: POHistoryItem[]
}

// Selection state: { lineItemId -> { size -> quantity } }
type SelectionState = Record<string, Record<string, number>>

export default function PurchaseOrdersPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')
  const [groups, setGroups] = useState<DocumentGroup[]>([])
  const [poHistory, setPoHistory] = useState<POHistory[]>([])
  const [selection, setSelection] = useState<SelectionState>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [expandedPO, setExpandedPO] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<any>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch aggregate items
  const fetchAggregateItems = useCallback(async () => {
    try {
      const res = await fetch('/api/purchase-orders/aggregate')
      const data = await res.json()
      setGroups(data.groups || [])
    } catch (error) {
      console.error('Failed to fetch aggregate items:', error)
      showToast('Failed to load items', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch PO history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/purchase-orders')
      const data = await res.json()
      setPoHistory(data.orders || [])
    } catch (error) {
      console.error('Failed to fetch PO history:', error)
    }
  }, [])

  useEffect(() => {
    fetchAggregateItems()
    fetchHistory()
  }, [fetchAggregateItems, fetchHistory])

  // Toggle all sizes for a line item
  const toggleItem = (item: AggregateItem) => {
    setSelection(prev => {
      const next = { ...prev }
      if (next[item.lineItemId]) {
        delete next[item.lineItemId]
      } else {
        const sizes: Record<string, number> = {}
        for (const [sizeName, sizeData] of Object.entries(item.sizes)) {
          if (sizeData.qty > 0) {
            sizes[sizeName] = sizeData.qty
          }
        }
        next[item.lineItemId] = sizes
      }
      return next
    })
  }

  // Update quantity for a specific size within a line item
  const updateSizeQty = (lineItemId: string, sizeName: string, qty: number) => {
    setSelection(prev => {
      const next = { ...prev }
      if (!next[lineItemId]) {
        next[lineItemId] = {}
      }
      if (qty <= 0) {
        delete next[lineItemId][sizeName]
        if (Object.keys(next[lineItemId]).length === 0) {
          delete next[lineItemId]
        }
      } else {
        next[lineItemId][sizeName] = qty
      }
      return next
    })
  }

  // Select all items
  const selectAll = () => {
    const newSelection: SelectionState = {}
    for (const group of groups) {
      for (const item of group.items) {
        const sizes: Record<string, number> = {}
        for (const [sizeName, sizeData] of Object.entries(item.sizes)) {
          if (sizeData.qty > 0) {
            sizes[sizeName] = sizeData.qty
          }
        }
        if (Object.keys(sizes).length > 0) {
          newSelection[item.lineItemId] = sizes
        }
      }
    }
    setSelection(newSelection)
  }

  // Clear all selections
  const clearSelection = () => setSelection({})

  // Calculate totals from selection
  const getSelectionTotals = () => {
    let totalUnits = 0
    let totalCost = 0
    let lineCount = 0

    for (const [lineItemId, sizes] of Object.entries(selection)) {
      for (const [sizeName, qty] of Object.entries(sizes)) {
        // Find the item to get wholesale price
        const item = findItem(lineItemId)
        if (item && item.sizes[sizeName]) {
          totalUnits += qty
          totalCost += qty * (item.sizes[sizeName].wholesale || 0)
          lineCount++
        }
      }
    }

    return { totalUnits, totalCost, lineCount }
  }

  // Find an item by lineItemId across all groups
  const findItem = (lineItemId: string): AggregateItem | undefined => {
    for (const group of groups) {
      const item = group.items.find(i => i.lineItemId === lineItemId)
      if (item) return item
    }
    return undefined
  }

  // Find the document group for a line item
  const findDocGroup = (lineItemId: string): DocumentGroup | undefined => {
    return groups.find(g => g.items.some(i => i.lineItemId === lineItemId))
  }

  // Build the submission payload
  const buildSubmissionItems = () => {
    const submitItems: any[] = []

    for (const [lineItemId, sizes] of Object.entries(selection)) {
      const item = findItem(lineItemId)
      const group = findDocGroup(lineItemId)
      if (!item || !group) continue

      for (const [sizeName, qty] of Object.entries(sizes)) {
        const sizeData = item.sizes[sizeName]
        if (!sizeData || qty <= 0) continue

        submitItems.push({
          lineItemId: item.lineItemId,
          documentId: group.document.id,
          documentNumber: group.document.doc_number,
          customerName: group.document.customer_name,
          style: item.style,
          color: item.catalogColor || item.color,
          catalogColor: item.catalogColor || item.color,
          size: sizeName,
          quantity: qty,
          inventoryKey: sizeData.inventoryKey,
          sizeIndex: sizeData.sizeIndex,
          wholesalePrice: sizeData.wholesale || 0,
        })
      }
    }

    return submitItems
  }

  // Submit the PO
  const handleSubmit = async () => {
    const submitItems = buildSubmissionItems()
    if (submitItems.length === 0) {
      showToast('No items selected', 'error')
      return
    }

    setSubmitting(true)
    setShowConfirmModal(false)
    setValidationResult(null)

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: submitItems }),
      })

      const data = await res.json()

      if (data.success) {
        showToast(`PO ${data.poNumber} submitted successfully!`, 'success')
        setSelection({})
        fetchAggregateItems()
        fetchHistory()
      } else if (data.validation) {
        setValidationResult(data)
        showToast(`Inventory issue: ${data.message}`, 'error')
      } else {
        showToast(data.error || data.message || 'Failed to submit PO', 'error')
      }
    } catch (error) {
      console.error('PO submission error:', error)
      showToast('Failed to submit purchase order', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const { totalUnits, totalCost, lineCount } = getSelectionTotals()
  const freeShipping = totalCost >= 200

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'OSFA', 'OSFM']
  const sortSizes = (sizes: string[]) => {
    return sizes.sort((a, b) => {
      const ai = sizeOrder.indexOf(a)
      const bi = sizeOrder.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b)
    })
  }

  return (
    <div style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            background: 'linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Purchase Orders</span>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', background: 'rgba(100,116,139,0.15)', padding: '4px 10px', borderRadius: '6px' }}>SanMar</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Aggregate apparel items from invoices and submit purchase orders to SanMar
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(30,30,30,0.5)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {(['create', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? 'rgba(34,211,238,0.15)' : 'transparent',
              color: activeTab === tab ? '#22d3ee' : '#64748b',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab === 'create' ? 'Create PO' : 'PO History'}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '10px',
          background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#2563eb',
          color: '#fff', fontSize: '14px', fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.3s ease',
        }}>
          {toast.message}
        </div>
      )}

      {activeTab === 'create' ? (
        <>
          {/* Selection summary bar */}
          {Object.keys(selection).length > 0 && (
            <div style={{
              position: 'sticky', top: '0', zIndex: 100,
              background: 'linear-gradient(135deg, rgba(34,211,238,0.1), rgba(168,85,247,0.1))',
              border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: '12px', padding: '16px 20px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Line Items</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>{lineCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Units</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>{totalUnits}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Wholesale Cost</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee' }}>${totalCost.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Shipping</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: freeShipping ? '#22c55e' : '#f59e0b' }}>
                    {freeShipping ? 'FREE (UPS Ground)' : `$${(200 - totalCost).toFixed(2)} to free`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={clearSelection}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)',
                    background: 'transparent', color: '#94a3b8', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={submitting || totalUnits === 0}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: submitting ? '#374151' : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                    color: '#fff', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Submitting...' : `Submit PO (${totalUnits} units)`}
                </button>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {loading ? 'Loading...' : `${groups.reduce((s, g) => s + g.items.length, 0)} SanMar items across ${groups.length} invoices`}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={selectAll}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.2)',
                  background: 'transparent', color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
                }}
              >
                Select All
              </button>
              <button
                onClick={() => { fetchAggregateItems(); setLoading(true) }}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.2)',
                  background: 'transparent', color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Validation result */}
          {validationResult && (
            <div style={{
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: '10px', padding: '16px', marginBottom: '16px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fca5a5', marginBottom: '8px' }}>
                Inventory Validation Failed
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>{validationResult.message}</div>
              {validationResult.validation?.items?.map((vi: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', gap: '12px', padding: '4px 0', fontSize: '12px',
                  color: vi.available ? '#86efac' : '#fca5a5',
                }}>
                  <span>{vi.style} - {vi.color} - {vi.size} x{vi.quantity}</span>
                  <span>{vi.available ? `Available (WH ${vi.whseNo})` : 'Not in stock'}</span>
                  <span style={{ color: '#64748b' }}>{vi.message}</span>
                </div>
              ))}
              <button
                onClick={() => setValidationResult(null)}
                style={{
                  marginTop: '8px', padding: '6px 12px', borderRadius: '6px',
                  border: '1px solid rgba(148,163,184,0.2)', background: 'transparent',
                  color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Item groups */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Loading apparel items...</div>
          ) : groups.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px',
              background: 'rgba(30,30,30,0.5)', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)',
            }}>
              <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '8px' }}>No SanMar items found</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                SanMar apparel items from sent/approved invoices will appear here
              </div>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.document.id} style={{
                background: 'rgba(30,30,30,0.5)', border: '1px solid rgba(148,163,184,0.1)',
                borderRadius: '12px', marginBottom: '12px', overflow: 'hidden',
              }}>
                {/* Document header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                      {group.document.doc_number || 'Invoice'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {group.document.customer_name}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px',
                      background: group.document.status === 'paid' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                      color: group.document.status === 'paid' ? '#86efac' : '#93c5fd',
                    }}>
                      {group.document.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Items */}
                {group.items.map(item => {
                  const isSelected = !!selection[item.lineItemId]
                  const selectedSizes = selection[item.lineItemId] || {}
                  const sizeNames = sortSizes(Object.keys(item.sizes).filter(s => item.sizes[s].qty > 0))

                  return (
                    <div
                      key={item.lineItemId}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(148,163,184,0.05)',
                        background: isSelected ? 'rgba(34,211,238,0.04)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        {/* Checkbox */}
                        <div
                          onClick={() => toggleItem(item)}
                          style={{
                            width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer',
                            border: isSelected ? '2px solid #22d3ee' : '2px solid rgba(148,163,184,0.3)',
                            background: isSelected ? '#22d3ee' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="3" style={{ width: 14, height: 14 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        {/* Item info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                              {item.style}
                            </span>
                            <span style={{ fontSize: '13px', color: '#94a3b8' }}>{item.color}</span>
                            {item.catalogColor && item.catalogColor !== item.color && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>({item.catalogColor})</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        </div>

                        {/* Total qty / cost */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                            {item.totalQty} units
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            ${item.totalWholesale.toFixed(2)}
                          </div>
                        </div>

                        {/* Previous order badges */}
                        {item.previousOrders.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {item.previousOrders.map((po, i) => (
                              <span key={i} style={{
                                fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                                background: po.status === 'submitted' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                                color: po.status === 'submitted' ? '#86efac' : '#fcd34d',
                              }}>
                                {po.po_number} ({po.quantity})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Size breakdown (always visible, editable when selected) */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginLeft: '32px' }}>
                        {sizeNames.map(sizeName => {
                          const sizeData = item.sizes[sizeName]
                          const selectedQty = selectedSizes[sizeName]
                          const isEditing = isSelected

                          return (
                            <div key={sizeName} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                              padding: '4px 8px', borderRadius: '6px', minWidth: '50px',
                              background: selectedQty ? 'rgba(34,211,238,0.1)' : 'rgba(30,30,30,0.5)',
                              border: selectedQty ? '1px solid rgba(34,211,238,0.2)' : '1px solid rgba(148,163,184,0.08)',
                            }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                                {sizeName}
                              </span>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={sizeData.qty * 2}
                                  value={selectedQty || 0}
                                  onChange={e => updateSizeQty(item.lineItemId, sizeName, parseInt(e.target.value, 10) || 0)}
                                  style={{
                                    width: '40px', textAlign: 'center', fontSize: '13px', fontWeight: 600,
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(148,163,184,0.2)',
                                    borderRadius: '4px', color: '#f1f5f9', padding: '2px',
                                    outline: 'none',
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                                  {sizeData.qty}
                                </span>
                              )}
                              <span style={{ fontSize: '10px', color: '#64748b' }}>
                                ${sizeData.wholesale?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </>
      ) : (
        /* History Tab */
        <div>
          {poHistory.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px',
              background: 'rgba(30,30,30,0.5)', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)',
            }}>
              <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '8px' }}>No purchase orders yet</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Submitted POs will appear here with full tracking
              </div>
            </div>
          ) : (
            poHistory.map(po => {
              const isExpanded = expandedPO === po.id
              const statusColors: Record<string, { bg: string; text: string }> = {
                submitted: { bg: 'rgba(34,197,94,0.15)', text: '#86efac' },
                confirmed: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd' },
                shipped: { bg: 'rgba(168,85,247,0.15)', text: '#c4b5fd' },
                delivered: { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
                error: { bg: 'rgba(220,38,38,0.15)', text: '#fca5a5' },
                cancelled: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
                draft: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
              }
              const sc = statusColors[po.status] || statusColors.draft

              return (
                <div key={po.id} style={{
                  background: 'rgba(30,30,30,0.5)', border: '1px solid rgba(148,163,184,0.1)',
                  borderRadius: '12px', marginBottom: '8px', overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{po.po_number}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                        background: sc.bg, color: sc.text,
                      }}>
                        {po.status}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {po.submitted_at ? new Date(po.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not submitted'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>{po.total_units} units</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#22d3ee' }}>${Number(po.total_cost || 0).toFixed(2)}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{
                        width: 16, height: 16, transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)', padding: '12px 16px' }}>
                      {po.notes && (
                        <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '8px', padding: '8px', background: 'rgba(220,38,38,0.1)', borderRadius: '6px' }}>
                          {po.notes}
                        </div>
                      )}
                      {po.supplier_confirmation && (
                        <div style={{ fontSize: '12px', color: '#86efac', marginBottom: '8px' }}>
                          Confirmation: {po.supplier_confirmation}
                        </div>
                      )}
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Style</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Color</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Size</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Cost</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Warehouse</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {po.items.map((item: POHistoryItem) => (
                            <tr key={item.id} style={{ borderTop: '1px solid rgba(148,163,184,0.05)' }}>
                              <td style={{ padding: '6px 8px', color: '#e2e8f0', fontWeight: 500 }}>{item.style}</td>
                              <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{item.color}</td>
                              <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{item.size}</td>
                              <td style={{ padding: '6px 8px', color: '#e2e8f0', textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                              <td style={{ padding: '6px 8px', color: '#22d3ee', textAlign: 'right' }}>${Number(item.line_cost || 0).toFixed(2)}</td>
                              <td style={{ padding: '6px 8px', color: '#64748b' }}>{item.warehouse_name || '-'}</td>
                              <td style={{ padding: '6px 8px', color: '#64748b' }}>
                                {item.source_document_number} {item.customer_name && `(${item.customer_name})`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowConfirmModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1a1a', border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
              Confirm Purchase Order
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 20px' }}>
              This will submit a purchase order to SanMar. This action cannot be undone.
            </p>

            <div style={{
              background: 'rgba(30,30,30,0.8)', borderRadius: '10px', padding: '16px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Line Items</span>
                <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{lineCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Total Units</span>
                <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{totalUnits}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Wholesale Cost</span>
                <span style={{ color: '#22d3ee', fontSize: '14px', fontWeight: 700 }}>${totalCost.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Shipping</span>
                <span style={{ color: freeShipping ? '#22c55e' : '#f59e0b', fontSize: '13px', fontWeight: 600 }}>
                  {freeShipping ? 'FREE (UPS Ground)' : 'UPS Ground'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  border: '1px solid rgba(148,163,184,0.2)', background: 'transparent',
                  color: '#94a3b8', fontSize: '14px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '10px 24px', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                  color: '#fff', fontSize: '14px', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit to SanMar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  )
}
