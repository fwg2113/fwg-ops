'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Document = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name: string
  project_description: string
  category: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  notes: string
  created_at: string
}

type LineItem = {
  id: string
  line_type_key: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
}

const LINE_TYPES: Record<string, { key: string; label: string }[]> = {
  FULL_WRAP: [
    { key: 'FULL_WRAP', label: 'Full Vehicle Wrap' },
    { key: 'DESIGN_FEE', label: 'Design Fee' },
    { key: 'REMOVAL', label: 'Old Wrap Removal' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  PARTIAL_WRAP: [
    { key: 'PARTIAL_WRAP', label: 'Partial Wrap' },
    { key: 'HOOD_WRAP', label: 'Hood Wrap' },
    { key: 'ROOF_WRAP', label: 'Roof Wrap' },
    { key: 'CHROME_DELETE', label: 'Chrome Delete' },
    { key: 'DESIGN_FEE', label: 'Design Fee' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  COMMERCIAL_WRAP: [
    { key: 'FULL_WRAP', label: 'Full Vehicle Wrap' },
    { key: 'PARTIAL_WRAP', label: 'Partial Wrap' },
    { key: 'LETTERING', label: 'Lettering' },
    { key: 'DESIGN_FEE', label: 'Design Fee' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  COLOR_CHANGE: [
    { key: 'COLOR_CHANGE', label: 'Color Change Wrap' },
    { key: 'REMOVAL', label: 'Old Wrap Removal' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  PPF: [
    { key: 'PPF_FULL', label: 'Full Front PPF' },
    { key: 'PPF_PARTIAL', label: 'Partial PPF' },
    { key: 'PPF_TRACK_PACK', label: 'Track Pack' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  TINT: [
    { key: 'TINT_FULL', label: 'Full Vehicle Tint' },
    { key: 'TINT_FRONT', label: 'Front Two Windows' },
    { key: 'TINT_WINDSHIELD', label: 'Windshield Strip' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  SIGNAGE: [
    { key: 'BANNER', label: 'Banner' },
    { key: 'YARD_SIGN', label: 'Yard Sign' },
    { key: 'WINDOW_PERF', label: 'Window Perf' },
    { key: 'WALL_GRAPHIC', label: 'Wall Graphic' },
    { key: 'DESIGN_FEE', label: 'Design Fee' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ],
  APPAREL: [
    { key: 'SCREEN_PRINT', label: 'Screen Print' },
    { key: 'HEAT_TRANSFER', label: 'Heat Transfer' },
    { key: 'EMBROIDERY', label: 'Embroidery' },
    { key: 'CUSTOM', label: 'Custom Item' }
  ]
}

const DEFAULT_LINE_TYPES = [
  { key: 'CUSTOM', label: 'Custom Item' }
]

export default function DocumentDetail({ document: doc, initialLineItems }: { document: Document, initialLineItems: LineItem[] }) {
  const router = useRouter()
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [saving, setSaving] = useState(false)
  const [docStatus, setDocStatus] = useState(doc.status)
  const [docType, setDocType] = useState(doc.doc_type)
  const [newItem, setNewItem] = useState({ 
    line_type_key: '', 
    description: '', 
    quantity: 1, 
    unit_price: 0
  })

  const calculateTotals = (items: LineItem[]) => {
    return items.reduce((sum, item) => sum + (item.line_total || 0), 0)
  }

  const subtotal = calculateTotals(lineItems)
  const total = subtotal - (doc.discount_amount || 0) + (doc.tax_amount || 0)

  const lineTypeOptions = LINE_TYPES[doc.category] || DEFAULT_LINE_TYPES

  const getLineTypeLabel = (key: string) => {
    for (const category of Object.values(LINE_TYPES)) {
      const found = category.find(t => t.key === key)
      if (found) return found.label
    }
    return key
  }

  const handleAddLineItem = async () => {
    if (!newItem.line_type_key && !newItem.description) return
    setSaving(true)

    const quantity = newItem.quantity || 1
    const line_total = quantity * newItem.unit_price

    const { data, error } = await supabase
      .from('line_items')
      .insert([{
        document_id: doc.id,
        line_type_key: newItem.line_type_key,
        description: newItem.description || getLineTypeLabel(newItem.line_type_key),
        quantity: quantity,
        unit_price: newItem.unit_price,
        line_total: line_total,
        sort_order: lineItems.length
      }])
      .select()
      .single()

    if (!error && data) {
      setLineItems([...lineItems, data])
      setNewItem({ line_type_key: '', description: '', quantity: 1, unit_price: 0 })
      
      const newSubtotal = subtotal + line_total
      await supabase
        .from('documents')
        .update({ subtotal: newSubtotal, total: newSubtotal })
        .eq('id', doc.id)
    }

    setSaving(false)
  }

  const handleDeleteLineItem = async (itemId: string) => {
    const item = lineItems.find(i => i.id === itemId)
    if (!item) return

    await supabase
      .from('line_items')
      .delete()
      .eq('id', itemId)

    const newItems = lineItems.filter(i => i.id !== itemId)
    setLineItems(newItems)

    const newSubtotal = calculateTotals(newItems)
    await supabase
      .from('documents')
      .update({ subtotal: newSubtotal, total: newSubtotal })
      .eq('id', doc.id)
  }

  const handleStatusChange = async (newStatus: string) => {
    await supabase
      .from('documents')
      .update({ status: newStatus })
      .eq('id', doc.id)
    setDocStatus(newStatus)
  }

  const handleConvertToInvoice = async () => {
    setSaving(true)
    await supabase
      .from('documents')
      .update({ 
        doc_type: 'invoice',
        status: 'pending'
      })
      .eq('id', doc.id)
    setDocType('invoice')
    setDocStatus('pending')
    setSaving(false)
  }

  const handleMarkPaid = async () => {
    setSaving(true)
    await supabase
      .from('documents')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString(),
        amount_paid: total,
        balance_due: 0
      })
      .eq('id', doc.id)
    setDocStatus('paid')
    setSaving(false)
  }
  const handleCreatePaymentLink = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          amount: total
        })
      })
      
      const data = await response.json()
      
      if (data.url) {
        // Copy to clipboard and open
        await navigator.clipboard.writeText(data.url)
        alert('Payment link copied to clipboard!')
        window.open(data.url, '_blank')
      } else {
        alert('Error creating payment link: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error creating payment link')
    }
    setSaving(false)
  }

  const handleSendToProduction = async () => {
    setSaving(true)
    await supabase
      .from('documents')
      .update({ in_production: true })
      .eq('id', doc.id)
    setSaving(false)
    router.push('/production')
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <button 
            onClick={() => router.push('/documents')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginBottom: '8px', padding: 0, fontSize: '14px' }}
          >
            ← Back to Documents
          </button>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>
            {docType === 'quote' ? 'Quote' : 'Invoice'} #{doc.doc_number}
          </h1>
          <p style={{ color: '#94a3b8' }}>{doc.customer_name || 'No customer'}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {doc.category && (
            <span style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              background: 'rgba(215, 28, 209, 0.1)',
              color: '#d71cd1'
            }}>
              {doc.category.replace(/_/g, ' ')}
            </span>
          )}
          <select
            value={docStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              background: '#282a30',
              border: '1px solid #3f4451',
              color: '#f1f5f9',
              cursor: 'pointer'
            }}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="approved">Approved</option>
            {docType === 'invoice' && <option value="pending">Pending</option>}
            {docType === 'invoice' && <option value="paid">Paid</option>}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        {/* Main Content */}
        <div>
          {/* Customer Info */}
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Customer Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Name</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{doc.customer_name || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Company</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{doc.company_name || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Email</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{doc.customer_email || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Phone</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{doc.customer_phone || '-'}</p>
              </div>
            </div>
            {doc.project_description && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Project</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{doc.project_description}</p>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Line Items</h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', width: '80px' }}>Qty</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', width: '100px' }}>Price</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', width: '100px' }}>Total</th>
                  <th style={{ padding: '12px', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                    <td style={{ padding: '12px', color: '#d71cd1', fontSize: '13px' }}>
                      {getLineTypeLabel(item.line_type_key)}
                    </td>
                    <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px' }}>{item.description}</td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '14px', textAlign: 'right' }}>{item.quantity}</td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '14px', textAlign: 'right' }}>${item.unit_price?.toFixed(2)}</td>
                    <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>${item.line_total?.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteLineItem(item.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Add New Item Row */}
                <tr style={{ background: 'rgba(148, 163, 184, 0.03)' }}>
                  <td style={{ padding: '12px' }}>
                    <select
                      value={newItem.line_type_key}
                      onChange={(e) => setNewItem({ ...newItem, line_type_key: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#282a30',
                        border: '1px solid #3f4451',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select type...</option>
                      {lineTypeOptions.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#282a30',
                        border: '1px solid #3f4451',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#282a30',
                        border: '1px solid #3f4451',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '14px',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({ ...newItem, unit_price: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#282a30',
                        border: '1px solid #3f4451',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        fontSize: '14px',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '14px', textAlign: 'right' }}>
                    ${(newItem.quantity * newItem.unit_price).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={handleAddLineItem}
                      disabled={saving || (!newItem.line_type_key && !newItem.description)}
                      style={{
                        background: '#d71cd1',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '18px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        opacity: saving || (!newItem.line_type_key && !newItem.description) ? 0.5 : 1
                      }}
                    >
                      +
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', position: 'sticky', top: '24px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '20px' }}>Summary</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Subtotal</span>
              <span style={{ color: '#f1f5f9', fontSize: '14px' }}>${subtotal.toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Discount</span>
              <span style={{ color: '#f1f5f9', fontSize: '14px' }}>-${(doc.discount_amount || 0).toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Tax</span>
              <span style={{ color: '#f1f5f9', fontSize: '14px' }}>${(doc.tax_amount || 0).toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <span style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600' }}>Total</span>
              <span style={{ color: '#d71cd1', fontSize: '24px', fontWeight: '700' }}>${total.toFixed(2)}</span>
            </div>

            {docType === 'quote' && (
              <>
                <button
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  Send to Customer
                </button>
                
                {(docStatus === 'approved' || docStatus === 'sent' || docStatus === 'viewed') && (
                  <button
                    onClick={handleConvertToInvoice}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#22c55e',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    Convert to Invoice
                  </button>
                )}
              </>
            )}

            {docType === 'invoice' && (
              <>
                {docStatus !== 'paid' && (
                  <>
                  <button
                    onClick={handleMarkPaid}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#22c55e',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    Mark as Paid
                  </button>
                  
                  <button
                    onClick={handleCreatePaymentLink}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#6366f1',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    Create Payment Link
                  </button>
                  </>
                )}
                
                {docStatus === 'paid' && (
                  <button
                    onClick={handleSendToProduction}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#8b5cf6',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    Send to Production
                  </button>
                )}
              </>
            )}
            
            <button
              onClick={() => window.open(`/api/pdf?id=${doc.id}`, '_blank')}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                border: '1px solid #3f4451',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
