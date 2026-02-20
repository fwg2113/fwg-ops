'use client'

import React from 'react'

type SnapshotData = {
  document: {
    id: string; doc_number: number; doc_type: string
    customer_name: string; company_name: string
    customer_email: string; customer_phone: string
    vehicle_description: string; project_description: string
    subtotal: number; fees: any[]; fees_total: number
    discount_amount: number; discount_percent: number; discount_note: string
    tax_amount: number; total: number; deposit_required: number
    notes: string; valid_until: string; options_mode: boolean
    options_json: any[] | null; attachments: any[]
  }
  line_items: {
    id: string; group_id: string; category: string; description: string
    quantity: number; unit_price: number; line_total: number
    custom_fields?: Record<string, any>; decoration_type?: string
    stitch_count?: string; attachments?: any[]; taxable?: boolean
  }[]
  send_options: {
    sms: boolean; email: boolean; approvalType: string | null
    customApprovalText: string | null; includeLineAttachments: boolean
    includeProjectAttachments: boolean; paymentTerms: string
    depositAmount: number; customerNotificationPref: string
  }
  pricing_matrices: Record<string, any>
}

type Props = {
  snapshot: {
    id: string
    document_id: string
    snapshot_data: SnapshotData
    sent_by: string | null
    created_at: string
  }
}

export default function SnapshotView({ snapshot }: Props) {
  const data = (() => {
    try {
      if (typeof snapshot.snapshot_data === 'string') return JSON.parse(snapshot.snapshot_data)
      return snapshot.snapshot_data
    } catch { return null }
  })() as SnapshotData | null

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Unable to load snapshot data.</div>
  }

  const doc = data.document
  const items = data.line_items || []
  const sendOpts = data.send_options
  const sentDate = new Date(snapshot.created_at)

  // Group line items
  const groups: Record<string, typeof items> = {}
  items.forEach(item => {
    const key = item.group_id || 'ungrouped'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })

  const showLineAttachments = sendOpts?.includeLineAttachments !== false
  const fees = Array.isArray(doc.fees) ? doc.fees : []

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Snapshot Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #334155)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500 }}>
          Send Snapshot — This is what the customer saw when sent on{' '}
          <strong>{sentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          {' at '}
          {sentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#1a1a1a', fontWeight: 700 }}>
                {doc.doc_type === 'quote' ? 'Quote' : 'Invoice'} #{doc.doc_number}
              </h1>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Frederick Wraps & Graphics</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Sent {sentDate.toLocaleDateString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', marginBottom: '2px' }}>Customer</div>
              <div style={{ color: '#1a1a1a', fontWeight: 500 }}>{doc.customer_name}</div>
              {doc.company_name && <div style={{ color: '#6b7280' }}>{doc.company_name}</div>}
            </div>
            {doc.project_description && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', marginBottom: '2px' }}>Project</div>
                <div style={{ color: '#1a1a1a' }}>{doc.project_description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Send Settings Summary */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1a1a1a', fontWeight: 600 }}>Send Settings</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
            {sendOpts?.sms && <span style={{ padding: '4px 10px', background: '#dbeafe', color: '#1e40af', borderRadius: '6px' }}>SMS</span>}
            {sendOpts?.email && <span style={{ padding: '4px 10px', background: '#dbeafe', color: '#1e40af', borderRadius: '6px' }}>Email</span>}
            <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: '6px' }}>
              {sendOpts?.paymentTerms === 'deposit_50' ? '50% Deposit' : sendOpts?.paymentTerms === 'full' ? 'Full Payment' : `Custom: $${(sendOpts?.depositAmount || 0).toFixed(2)}`}
            </span>
            {sendOpts?.approvalType && (
              <span style={{ padding: '4px 10px', background: '#f3e8ff', color: '#6b21a8', borderRadius: '6px' }}>
                Approval: {sendOpts.approvalType === 'both' ? 'Design & Price' : sendOpts.approvalType === 'custom' ? sendOpts.customApprovalText : sendOpts.approvalType}
              </span>
            )}
          </div>
        </div>

        {/* Options Mode */}
        {doc.options_mode && doc.options_json && doc.options_json.length > 0 && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1a1a1a', fontWeight: 600 }}>Options Presented</h3>
            {doc.options_json.map((opt: any, idx: number) => (
              <div key={opt.id || idx} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '14px' }}>{opt.title}</div>
                {opt.description && <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>{opt.description}</div>}
                <div style={{ color: '#059669', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                  ${opt.price_min?.toFixed(2)}{opt.price_max ? ` - $${opt.price_max.toFixed(2)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Line Items */}
        {items.length > 0 && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1a1a1a', fontWeight: 600 }}>Line Items</h3>
            {Object.entries(groups).map(([groupId, groupItems]) => (
              <div key={groupId} style={{ marginBottom: '16px' }}>
                {groupItems[0]?.category && (
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em' }}>
                    {groupItems[0].category}
                  </div>
                )}
                {groupItems.map(item => {
                  const cf = item.custom_fields || {}
                  const sizes = cf.sizes as Record<string, { qty: number; price: number; wholesale?: number }> | undefined
                  const itemImages = showLineAttachments ? (item.attachments || []).filter((a: any) => {
                    const name = (a.name || a.filename || a.file_name || '').toLowerCase()
                    return name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
                  }) : []

                  return (
                    <div key={item.id} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, color: '#1a1a1a', fontSize: '14px' }}>{item.description}</div>
                          {cf.color && <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>Color: {cf.color}</div>}
                          {item.decoration_type && (
                            <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>
                              Decoration: {item.decoration_type}{item.stitch_count ? ` (${item.stitch_count.replace(/_/g, ' ')})` : ''}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '80px' }}>
                          <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '14px' }}>${(item.line_total || 0).toFixed(2)}</div>
                          {item.quantity > 0 && (
                            <div style={{ color: '#6b7280', fontSize: '12px' }}>
                              {item.quantity} x ${(item.unit_price || 0).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Size breakdown for apparel */}
                      {sizes && Object.keys(sizes).length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(sizes).map(([size, info]) => (
                            info.qty > 0 && (
                              <span key={size} style={{ padding: '2px 8px', background: '#e5e7eb', borderRadius: '4px', fontSize: '12px', color: '#374151' }}>
                                {size}: {info.qty}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                      {/* Item images */}
                      {itemImages.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {itemImages.map((att: any, i: number) => (
                            <img
                              key={i}
                              src={att.url || att.file_url}
                              alt={att.name || att.filename || ''}
                              style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1a1a1a', fontWeight: 600 }}>Pricing Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span style={{ color: '#1a1a1a' }}>${(doc.subtotal || 0).toFixed(2)}</span>
            </div>
            {fees.length > 0 && fees.map((fee: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>{fee.description || fee.fee_type}</span>
                <span style={{ color: '#1a1a1a' }}>${(fee.amount || 0).toFixed(2)}</span>
              </div>
            ))}
            {doc.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#059669' }}>Discount{doc.discount_percent > 0 ? ` (${doc.discount_percent}%)` : ''}{doc.discount_note ? ` — ${doc.discount_note}` : ''}</span>
                <span style={{ color: '#059669' }}>-${doc.discount_amount.toFixed(2)}</span>
              </div>
            )}
            {doc.tax_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Tax</span>
                <span style={{ color: '#1a1a1a' }}>${doc.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '8px', fontWeight: 700 }}>
              <span style={{ color: '#1a1a1a' }}>Total</span>
              <span style={{ color: '#1a1a1a', fontSize: '16px' }}>${(doc.total || 0).toFixed(2)}</span>
            </div>
            {doc.deposit_required > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                <span>Deposit Required</span>
                <span style={{ fontWeight: 600 }}>${doc.deposit_required.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {doc.notes && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1a1a1a', fontWeight: 600 }}>Notes</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{doc.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
