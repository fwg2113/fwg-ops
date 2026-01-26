'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Attachment = {
  url: string
  key: string
  filename: string
  contentType: string
  size: number
  uploadedAt: string
}

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
  attachments?: Attachment[]
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [attachments, setAttachments] = useState<Attachment[]>(doc.attachments || [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const newAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentId', doc.id)

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (data.success) {
          newAttachments.push({
            url: data.url,
            key: data.key,
            filename: data.filename,
            contentType: data.contentType,
            size: data.size,
            uploadedAt: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Upload failed:', error)
      }
    }

    if (newAttachments.length > 0) {
      const updatedAttachments = [...attachments, ...newAttachments]
      setAttachments(updatedAttachments)

      await supabase
        .from('documents')
        .update({ attachments: updatedAttachments })
        .eq('id', doc.id)
    }

    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (key: string) => {
    const updatedAttachments = attachments.filter(a => a.key !== key)
    setAttachments(updatedAttachments)

    await supabase
      .from('documents')
      .update({ attachments: updatedAttachments })
      .eq('id', doc.id)
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

  const handleSendToCustomer = async () => {
    if (!doc.customer_email) {
      alert('No email address on file for this customer')
      return
    }
    
    setSaving(true)
    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          to: doc.customer_email,
          subject: `${docType === 'quote' ? 'Quote' : 'Invoice'} #${doc.doc_number} from Frederick Wraps`
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDocStatus('sent')
        alert('Document sent to customer!')
      } else {
        alert('Failed to send: ' + data.error)
      }
    } catch (error) {
      alert('Failed to send document')
    }
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
          amount: total,
          customerEmail: doc.customer_email,
          description: `Invoice #${doc.doc_number} - ${doc.project_description || 'Frederick Wraps'}`
        })
      })
      
      const data = await response.json()
      
      if (data.url) {
        await navigator.clipboard.writeText(data.url)
        alert('Payment link copied to clipboard!')
      } else {
        alert('Failed to create payment link')
      }
    } catch (error) {
      alert('Failed to create payment link')
    }
    setSaving(false)
  }

  const handleScheduleEvent = async () => {
    const dateStr = prompt('Enter appointment date (YYYY-MM-DD):')
    if (!dateStr) return
    
    const timeStr = prompt('Enter start time (HH:MM, 24hr format):')
    if (!timeStr) return

    setSaving(true)
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          date: dateStr,
          time: timeStr,
          duration: 120,
          title: `${doc.customer_name} - ${doc.project_description || doc.category}`,
          description: `Document #${doc.doc_number}\nTotal: $${total.toFixed(2)}`
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('Event scheduled!')
      } else {
        alert('Failed to schedule: ' + data.error)
      }
    } catch (error) {
      alert('Failed to schedule event')
    }
    setSaving(false)
  }

  const handleSendToProduction = async () => {
    setSaving(true)
    await supabase
      .from('documents')
      .update({ in_production: true })
      .eq('id', doc.id)
    alert('Sent to production!')
    setSaving(false)
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#64748b'
      case 'sent': return '#3b82f6'
      case 'viewed': return '#8b5cf6'
      case 'approved': return '#22c55e'
      case 'pending': return '#f59e0b'
      case 'paid': return '#22c55e'
      default: return '#64748b'
    }
  }

  const FileIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  )

  const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
    </svg>
  )

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ color: '#f1f5f9', fontSize: '28px', margin: 0 }}>
              {docType === 'quote' ? 'Quote' : 'Invoice'} #{doc.doc_number}
            </h1>
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500',
              background: `${statusColor(docStatus)}20`,
              color: statusColor(docStatus),
              textTransform: 'capitalize'
            }}>
              {docStatus}
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            {doc.customer_name} {doc.company_name && `- ${doc.company_name}`}
          </p>
        </div>
        <button
          onClick={() => router.push('/documents')}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid #3f4451',
            borderRadius: '8px',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          Back to Documents
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        <div>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Customer Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Name</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{doc.customer_name}</p>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Company</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{doc.company_name || '-'}</p>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Email</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{doc.customer_email || '-'}</p>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Phone</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{doc.customer_phone || '-'}</p>
              </div>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Project Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Category</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{doc.category?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Created</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Description</label>
                <p style={{ color: '#f1f5f9', margin: '4px 0 0' }}>{doc.project_description || '-'}</p>
              </div>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>Attachments</h3>
              <label style={{
                padding: '8px 16px',
                background: '#d71cd1',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: uploading ? 0.7 : 1
              }}>
                {uploading ? 'Uploading...' : 'Upload Files'}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            
            {attachments.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No attachments yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attachments.map((attachment) => (
                  <div
                    key={attachment.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#282a30',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <FileIcon />
                      <div style={{ minWidth: 0 }}>
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#f1f5f9',
                            fontSize: '14px',
                            textDecoration: 'none',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >{attachment.filename}</a>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {formatFileSize(attachment.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAttachment(attachment.key)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Line Items</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: '500', fontSize: '12px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: '500', fontSize: '12px' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontWeight: '500', fontSize: '12px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontWeight: '500', fontSize: '12px' }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontWeight: '500', fontSize: '12px' }}>Total</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '14px' }}>{getLineTypeLabel(item.line_type_key)}</td>
                    <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px' }}>{item.description}</td>
                    <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>{item.quantity}</td>
                    <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td>
                    <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>${item.line_total.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteLineItem(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >x</button>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(215, 28, 209, 0.05)' }}>
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
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select type...</option>
                      {lineTypeOptions.map(type => (
                        <option key={type.key} value={type.key}>{type.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      placeholder="Description"
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
                      min="1"
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
                    >+</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

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
              <div>
                <button
                  onClick={handleSendToCustomer}
                  disabled={saving || !doc.customer_email}
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
                    marginBottom: '12px',
                    opacity: saving || !doc.customer_email ? 0.7 : 1
                  }}
                >{doc.customer_email ? 'Send to Customer' : 'No Email on File'}</button>
                
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
                  >Convert to Invoice</button>
                )}
              </div>
            )}

            {docType === 'invoice' && (
              <div>
                {docStatus !== 'paid' && (
                  <div>
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
                    >Mark as Paid</button>
                    
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
                    >Create Payment Link</button>
                  </div>
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
                  >Send to Production</button>
                )}
              </div>
            )}
            
            <button
              onClick={handleScheduleEvent}
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
            >Schedule Event</button>

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
            >Download PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}