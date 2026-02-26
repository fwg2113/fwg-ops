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
  imageUrl?: string
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
  source_document_id?: string
  source_line_item_id?: string
  style: string
  color: string
  catalog_color: string
  size: string
  quantity: number
  inventory_key?: number
  size_index?: number
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

// Inventory lookup: "STYLE:Color:Size" -> { total, warehouses, recommended }
type InventoryMap = Record<string, { total: number; warehouses: { name: string; qty: number }[]; recommended?: string | null }>

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
  const [inventoryMap, setInventoryMap] = useState<InventoryMap>({})
  const [checkingInventory, setCheckingInventory] = useState(false)
  const [inventoryChecked, setInventoryChecked] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  // Manual product add state
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualStyle, setManualStyle] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualProduct, setManualProduct] = useState<any>(null)
  const [manualColor, setManualColor] = useState<string>('')
  const [manualError, setManualError] = useState('')

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

  // Check inventory for all unique styles in the current groups
  const checkInventory = useCallback(async () => {
    if (groups.length === 0) return

    // Extract unique style numbers
    const styles = [...new Set(groups.flatMap(g => g.items.map(i => i.style)))]
    if (styles.length === 0) return

    setCheckingInventory(true)
    try {
      const res = await fetch('/api/purchase-orders/check-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styles }),
      })
      const data = await res.json()
      if (data.inventory) {
        setInventoryMap(data.inventory)
        setInventoryChecked(true)
        showToast(`Stock checked for ${styles.length} style${styles.length !== 1 ? 's' : ''}`, 'success')
      } else {
        showToast(data.error || 'Failed to check inventory', 'error')
      }
    } catch (error) {
      console.error('Inventory check failed:', error)
      showToast('Failed to check inventory', 'error')
    } finally {
      setCheckingInventory(false)
    }
  }, [groups])

  // Look up inventory for a specific style/color/size
  const getStockLevel = (style: string, color: string, size: string): { total: number; warehouses: { name: string; qty: number }[]; recommended?: string | null } | null => {
    if (!inventoryChecked) return null
    const key = `${style.toUpperCase()}:${color.trim().toLowerCase()}:${size.trim()}`
    return inventoryMap[key] || null
  }

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

  // Select all items (skips fully-ordered items)
  const selectAll = () => {
    const newSelection: SelectionState = {}
    for (const group of groups) {
      for (const item of group.items) {
        if (isFullyOrdered(item)) continue
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

  // Update PO status
  const updatePOStatus = async (poId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poId, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`PO updated to ${newStatus}`, 'success')
        fetchHistory()
      } else {
        showToast(data.error || 'Failed to update', 'error')
      }
    } catch (error) {
      console.error('PO status update error:', error)
      showToast('Failed to update PO status', 'error')
    }
  }

  // Resubmit a failed PO by rebuilding the payload from its items
  const handleResubmit = async (po: POHistory) => {
    if (po.items.length === 0) {
      showToast('No items found on this PO', 'error')
      return
    }

    setSubmitting(true)
    try {
      const submitItems = po.items.map(item => ({
        lineItemId: item.source_line_item_id || item.id,
        documentId: item.source_document_id || '',
        documentNumber: item.source_document_number || '',
        customerName: item.customer_name || '',
        style: item.style,
        color: item.catalog_color || item.color,
        catalogColor: item.catalog_color || item.color,
        size: item.size,
        quantity: item.quantity,
        inventoryKey: item.inventory_key,
        sizeIndex: item.size_index,
        wholesalePrice: Number(item.wholesale_price) || 0,
      }))

      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: submitItems }),
      })
      const data = await res.json()

      if (data.success) {
        showToast(`New PO ${data.poNumber} submitted successfully!`, 'success')
        // Only cancel old PO if it was in error state (reorders keep the original)
        if (po.status === 'error') {
          await updatePOStatus(po.id, 'cancelled')
        }
        fetchHistory()
      } else {
        showToast(data.message || data.error || 'Resubmission failed', 'error')
      }
    } catch (error) {
      console.error('Resubmit error:', error)
      showToast('Failed to resubmit PO', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Look up a SanMar product by style number
  const lookupManualProduct = async () => {
    if (!manualStyle.trim()) return
    setManualLoading(true)
    setManualError('')
    setManualProduct(null)
    setManualColor('')
    try {
      const res = await fetch(`/api/suppliers/sanmar/product/${encodeURIComponent(manualStyle.trim())}`)
      const data = await res.json()
      if (data.success && data.data) {
        setManualProduct(data.data)
      } else {
        setManualError(data.error || 'Product not found')
      }
    } catch (error) {
      setManualError('Failed to look up product')
    } finally {
      setManualLoading(false)
    }
  }

  // Add manual product to the groups as a "Manual" document group
  const addManualProduct = () => {
    if (!manualProduct || !manualColor) return
    const colorData = manualProduct.colors?.find((c: any) => c.colorName === manualColor)
    if (!colorData || !colorData.sizes) return

    const manualId = `manual-${Date.now()}`
    const sizes: Record<string, SizeData> = {}
    for (const s of colorData.sizes) {
      sizes[s.sizeName] = {
        qty: 0,
        price: 0,
        wholesale: s.wholesalePrice || 0,
        inventoryKey: s.inventoryKey || undefined,
        sizeIndex: s.sizeIndex || undefined,
      }
    }

    const newItem: AggregateItem = {
      lineItemId: manualId,
      style: manualProduct.styleName || manualStyle,
      color: manualColor,
      catalogColor: colorData.catalogColor || manualColor,
      description: `${manualProduct.brandName || ''} ${manualProduct.styleName || manualStyle} - Manual Add`.trim(),
      category: 'APPAREL',
      imageUrl: colorData.frontImage || colorData.colorImages?.[0] || undefined,
      sizes,
      totalQty: 0,
      totalWholesale: 0,
      previousOrders: [],
    }

    // Check if a "Manual Items" group already exists
    const manualGroupIdx = groups.findIndex(g => g.document.id === 'manual')
    if (manualGroupIdx >= 0) {
      const updated = [...groups]
      updated[manualGroupIdx] = {
        ...updated[manualGroupIdx],
        items: [...updated[manualGroupIdx].items, newItem],
      }
      setGroups(updated)
    } else {
      setGroups(prev => [{
        document: { id: 'manual', doc_number: 'Manual Items', doc_type: 'manual', customer_name: 'Ad-hoc / Team', status: 'manual', created_at: new Date().toISOString() },
        items: [newItem],
      }, ...prev])
    }

    // Auto-select the new item (with 0 qtys so user fills them in)
    setSelection(prev => ({ ...prev, [manualId]: {} }))

    showToast(`${manualProduct.styleName} - ${manualColor} added. Set quantities below.`, 'info')
    setManualProduct(null)
    setManualStyle('')
    setManualColor('')
    setShowManualAdd(false)
  }

  // Check if a line item has been fully ordered (all sizes covered by a submitted/confirmed/shipped/delivered PO)
  const isFullyOrdered = (item: AggregateItem): boolean => {
    if (item.previousOrders.length === 0) return false
    const successStatuses = ['submitted', 'confirmed', 'shipped', 'delivered']
    const orderedQty = item.previousOrders
      .filter(po => successStatuses.includes(po.status))
      .reduce((sum, po) => sum + po.quantity, 0)
    return orderedQty >= item.totalQty
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

  // Check for split-warehouse sourcing across selected items
  const getWarehouseWarning = (): { isSplit: boolean; warehouses: string[] } => {
    if (!inventoryChecked || Object.keys(selection).length === 0) return { isSplit: false, warehouses: [] }
    const warehouseSet = new Set<string>()
    for (const [lineItemId, sizes] of Object.entries(selection)) {
      const item = findItem(lineItemId)
      if (!item) continue
      for (const sizeName of Object.keys(sizes)) {
        const stock = getStockLevel(item.style, item.color, sizeName)
        if (stock?.recommended) warehouseSet.add(stock.recommended)
      }
    }
    const warehouses = Array.from(warehouseSet)
    return { isSplit: warehouses.length > 1, warehouses }
  }
  const warehouseWarning = getWarehouseWarning()

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
                {warehouseWarning.isSplit && (
                  <div style={{
                    padding: '6px 12px', borderRadius: '8px',
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#fcd34d' }}>Split Warehouse</div>
                    <div style={{ fontSize: '10px', color: '#fbbf24' }}>
                      {warehouseWarning.warehouses.join(', ')}
                    </div>
                  </div>
                )}
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
              {inventoryChecked && (
                <span style={{ marginLeft: '8px', color: '#22c55e', fontSize: '12px' }}>
                  Stock checked
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={checkInventory}
                disabled={checkingInventory || loading || groups.length === 0}
                style={{
                  padding: '6px 12px', borderRadius: '6px',
                  border: inventoryChecked ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,211,238,0.3)',
                  background: inventoryChecked ? 'rgba(34,197,94,0.1)' : 'rgba(34,211,238,0.1)',
                  color: checkingInventory ? '#64748b' : inventoryChecked ? '#86efac' : '#22d3ee',
                  fontSize: '12px', fontWeight: 600, cursor: checkingInventory ? 'not-allowed' : 'pointer',
                }}
              >
                {checkingInventory ? 'Checking...' : inventoryChecked ? 'Re-check Stock' : 'Check Stock'}
              </button>
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
                onClick={() => setShowManualAdd(v => !v)}
                style={{
                  padding: '6px 12px', borderRadius: '6px',
                  border: showManualAdd ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(168,85,247,0.2)',
                  background: showManualAdd ? 'rgba(168,85,247,0.15)' : 'transparent',
                  color: '#c4b5fd', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Add Product
              </button>
              <button
                onClick={() => { fetchAggregateItems(); setLoading(true); setInventoryChecked(false); setInventoryMap({}) }}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.2)',
                  background: 'transparent', color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Manual product add panel */}
          {showManualAdd && (
            <div style={{
              background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: '10px', padding: '16px', marginBottom: '16px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#c4b5fd', marginBottom: '10px' }}>
                Add product by style number
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Style # (e.g. PC61, ST350)"
                  value={manualStyle}
                  onChange={e => setManualStyle(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && lookupManualProduct()}
                  style={{
                    flex: 1, maxWidth: '200px', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(0,0,0,0.3)',
                    color: '#f1f5f9', fontSize: '13px', outline: 'none',
                  }}
                />
                <button
                  onClick={lookupManualProduct}
                  disabled={manualLoading || !manualStyle.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: 'rgba(168,85,247,0.3)', color: '#e9d5ff', fontSize: '13px',
                    fontWeight: 600, cursor: manualLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {manualLoading ? 'Looking up...' : 'Look Up'}
                </button>
              </div>
              {manualError && (
                <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '8px' }}>{manualError}</div>
              )}
              {manualProduct && (
                <div>
                  <div style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '8px' }}>
                    <strong>{manualProduct.brandName}</strong> {manualProduct.styleName}
                    {manualProduct.baseCategory && <span style={{ color: '#94a3b8' }}> — {manualProduct.baseCategory}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Color:</span>
                    <select
                      value={manualColor}
                      onChange={e => setManualColor(e.target.value)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px',
                        border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(0,0,0,0.3)',
                        color: '#f1f5f9', fontSize: '12px',
                      }}
                    >
                      <option value="">Select color...</option>
                      {manualProduct.colors?.map((c: any) => (
                        <option key={c.colorName} value={c.colorName}>{c.colorName}</option>
                      ))}
                    </select>
                    {manualColor && (
                      <button
                        onClick={addManualProduct}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', border: 'none',
                          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                          color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Add to PO
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
                    {group.document.id === 'manual' ? (
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#c4b5fd' }}>
                        {group.document.doc_number}
                      </span>
                    ) : (
                      <a
                        href={`/documents/${group.document.id}`}
                        style={{ fontSize: '14px', fontWeight: 600, color: '#22d3ee', textDecoration: 'none' }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline' }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none' }}
                      >
                        {group.document.doc_number || 'Invoice'}
                      </a>
                    )}
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
                  const fullyOrdered = isFullyOrdered(item)

                  return (
                    <div
                      key={item.lineItemId}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(148,163,184,0.05)',
                        background: fullyOrdered ? 'rgba(34,197,94,0.03)' : isSelected ? 'rgba(34,211,238,0.04)' : 'transparent',
                        opacity: fullyOrdered ? 0.5 : 1,
                        transition: 'background 0.15s ease, opacity 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        {/* Checkbox */}
                        <div
                          onClick={() => !fullyOrdered && toggleItem(item)}
                          style={{
                            width: '20px', height: '20px', borderRadius: '4px',
                            cursor: fullyOrdered ? 'default' : 'pointer',
                            border: fullyOrdered ? '2px solid rgba(34,197,94,0.3)' : isSelected ? '2px solid #22d3ee' : '2px solid rgba(148,163,184,0.3)',
                            background: fullyOrdered ? 'rgba(34,197,94,0.2)' : isSelected ? '#22d3ee' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >
                          {fullyOrdered ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" style={{ width: 14, height: 14 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : isSelected && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="3" style={{ width: 14, height: 14 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        {/* Product thumbnail */}
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={`${item.style} ${item.color}`}
                            style={{
                              width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover',
                              border: '1px solid rgba(148,163,184,0.15)', flexShrink: 0,
                              background: '#fff',
                            }}
                          />
                        )}

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

                        {/* Total qty / cost + stock indicator */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                            {item.totalQty} units
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            ${item.totalWholesale.toFixed(2)}
                          </div>
                          {inventoryChecked && (() => {
                            const activeSizes = Object.keys(item.sizes).filter(s => item.sizes[s].qty > 0)
                            let allGood = true
                            let anyIssue = false
                            for (const s of activeSizes) {
                              const stock = getStockLevel(item.style, item.color, s)
                              if (stock === null) { allGood = false; break }
                              if (stock.total < item.sizes[s].qty) { allGood = false; anyIssue = true }
                            }
                            return (
                              <div style={{
                                fontSize: '10px', fontWeight: 600, marginTop: '2px',
                                color: anyIssue ? '#fcd34d' : allGood ? '#86efac' : '#94a3b8',
                              }}>
                                {anyIssue ? 'Low stock' : allGood ? 'In stock' : 'Partial data'}
                              </div>
                            )
                          })()}
                        </div>

                        {/* Previous order badges */}
                        {item.previousOrders.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {fullyOrdered && (
                              <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                                background: 'rgba(34,197,94,0.2)', color: '#4ade80',
                              }}>
                                Ordered
                              </span>
                            )}
                            {item.previousOrders.map((po, i) => (
                              <span key={i} style={{
                                fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                                background: po.status === 'submitted' ? 'rgba(34,197,94,0.15)' : po.status === 'error' ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.15)',
                                color: po.status === 'submitted' ? '#86efac' : po.status === 'error' ? '#fca5a5' : '#fcd34d',
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
                          const stock = getStockLevel(item.style, item.color, sizeName)
                          const requestedQty = selectedQty || sizeData.qty
                          const isLowStock = stock !== null && stock.total < requestedQty
                          const isOutOfStock = stock !== null && stock.total === 0

                          return (
                            <div key={sizeName} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                              padding: '4px 8px', borderRadius: '6px', minWidth: '50px',
                              background: isOutOfStock ? 'rgba(220,38,38,0.08)' : isLowStock ? 'rgba(245,158,11,0.08)' : selectedQty ? 'rgba(34,211,238,0.1)' : 'rgba(30,30,30,0.5)',
                              border: isOutOfStock ? '1px solid rgba(220,38,38,0.2)' : isLowStock ? '1px solid rgba(245,158,11,0.2)' : selectedQty ? '1px solid rgba(34,211,238,0.2)' : '1px solid rgba(148,163,184,0.08)',
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
                              {stock !== null && (
                                <span
                                  title={stock.warehouses.length > 0 ? stock.warehouses.map(w => `${w.name}: ${w.qty}`).join('\n') : 'No stock'}
                                  style={{
                                    fontSize: '9px', fontWeight: 700, marginTop: '1px',
                                    color: isOutOfStock ? '#fca5a5' : isLowStock ? '#fcd34d' : '#86efac',
                                  }}
                                >
                                  {stock.total.toLocaleString()} avail
                                </span>
                              )}
                              {stock?.recommended && !isOutOfStock && (
                                <span style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>
                                  {stock.recommended === 'Robbinsville' ? 'NJ' : stock.recommended}
                                </span>
                              )}
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
          {/* Status filter chips */}
          {poHistory.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['all', 'submitted', 'confirmed', 'shipped', 'delivered', 'error', 'cancelled'].map(status => {
                const count = status === 'all' ? poHistory.length : poHistory.filter(po => po.status === status).length
                if (count === 0 && status !== 'all') return null
                const isActive = historyFilter === status
                return (
                  <button
                    key={status}
                    onClick={() => setHistoryFilter(status)}
                    style={{
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      border: isActive ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(148,163,184,0.15)',
                      background: isActive ? 'rgba(34,211,238,0.15)' : 'transparent',
                      color: isActive ? '#22d3ee' : '#94a3b8',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {status} ({count})
                  </button>
                )
              })}
            </div>
          )}
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
            poHistory.filter(po => historyFilter === 'all' || po.status === historyFilter).map(po => {
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
                      {/* Status update buttons */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {po.status === 'error' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResubmit(po) }}
                            disabled={submitting}
                            style={{
                              padding: '4px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                              border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.15)', color: '#22d3ee',
                              cursor: submitting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {submitting ? 'Resubmitting...' : 'Retry Submission'}
                          </button>
                        )}
                        {po.status !== 'error' && po.status !== 'draft' && po.items.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResubmit(po) }}
                            disabled={submitting}
                            style={{
                              padding: '4px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                              border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.1)', color: '#c4b5fd',
                              cursor: submitting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {submitting ? 'Creating...' : 'Reorder'}
                          </button>
                        )}
                        {po.status !== 'cancelled' && po.status !== 'delivered' && (
                          <>
                            {(['confirmed', 'shipped', 'delivered', 'cancelled'] as const)
                              .filter(s => s !== po.status)
                              .map(newStatus => {
                                const btnColors: Record<string, { border: string; color: string; bg: string }> = {
                                  confirmed: { border: 'rgba(59,130,246,0.3)', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)' },
                                  shipped: { border: 'rgba(168,85,247,0.3)', color: '#c4b5fd', bg: 'rgba(168,85,247,0.1)' },
                                  delivered: { border: 'rgba(34,197,94,0.3)', color: '#86efac', bg: 'rgba(34,197,94,0.1)' },
                                  cancelled: { border: 'rgba(220,38,38,0.3)', color: '#fca5a5', bg: 'rgba(220,38,38,0.1)' },
                                }
                                const bc = btnColors[newStatus] || btnColors.confirmed
                                return (
                                  <button
                                    key={newStatus}
                                    onClick={(e) => { e.stopPropagation(); updatePOStatus(po.id, newStatus) }}
                                    style={{
                                      padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                      border: `1px solid ${bc.border}`, background: bc.bg, color: bc.color,
                                      cursor: 'pointer', textTransform: 'capitalize',
                                    }}
                                  >
                                    Mark {newStatus}
                                  </button>
                                )
                              })}
                          </>
                        )}
                      </div>
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
                                {item.source_document_id ? (
                                  <a
                                    href={`/documents/${item.source_document_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: '#22d3ee', textDecoration: 'none' }}
                                    onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline' }}
                                    onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none' }}
                                  >
                                    {item.source_document_number || 'View'}
                                  </a>
                                ) : (
                                  item.source_document_number
                                )}
                                {item.customer_name && ` (${item.customer_name})`}
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
