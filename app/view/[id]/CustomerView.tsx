'use client'

import { useState } from 'react'

type Document = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name?: string
  vehicle_description?: string
  project_description?: string
  subtotal: number
  discount_amount?: number
  discount_percent?: number
  tax_amount?: number
  total: number
  deposit_required?: number
  deposit_paid?: number
  amount_paid?: number
  balance_due?: number
  notes?: string
  created_at: string
  valid_until?: string
}

type LineItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export default function CustomerView({ document: doc, lineItems }: { document: Document, lineItems: LineItem[] }) {
  const [status, setStatus] = useState(doc.status)
  const [submitting, setSubmitting] = useState(false)
  
  const isQuote = doc.doc_type === 'quote'
  const isInvoice = doc.doc_type === 'invoice'
  const docLabel = isQuote ? 'Quote' : 'Invoice'
  
  const canApprove = isQuote && (status === 'sent' || status === 'viewed' || status === 'Sent' || status === 'Viewed')
  const canPay = isInvoice && status !== 'paid' && status !== 'Paid'
  
  const handleApprove = async () => {
    if (!confirm('Approve this quote? This confirms you want to proceed with the project.')) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id })
      })
      
      if (res.ok) {
        setStatus('approved')
        alert('Quote approved! We will be in touch shortly.')
      } else {
        alert('Failed to approve quote')
      }
    } catch (e) {
      alert('Error approving quote')
    }
    setSubmitting(false)
  }
  
  const handlePay = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: doc.id,
          amount: doc.balance_due || doc.total
        })
      })
      
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to create payment link')
      }
    } catch (e) {
      alert('Error creating payment')
    }
    setSubmitting(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
  }

  const getStatusBadge = () => {
    const s = status?.toLowerCase()
    if (s === 'approved') return { text: 'Approved', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' }
    if (s === 'paid') return { text: 'Paid', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' }
    if (s === 'viewed') return { text: 'Awaiting Response', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    if (s === 'sent') return { text: 'Awaiting Response', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }
    return { text: status, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  }

  const badge = getStatusBadge()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #d71cd1 0%, #8b5cf6 100%)', 
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Frederick Wraps Group</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: '14px' }}>Vehicle Wraps & Graphics</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Document Header */}
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: '12px', 
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px' }}>{docLabel} #{doc.doc_number}</h2>
              <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
                For: {doc.customer_name}{doc.company_name ? ` - ${doc.company_name}` : ''}
              </p>
              {doc.vehicle_description && (
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{doc.vehicle_description}</p>
              )}
            </div>
            <div style={{ 
              padding: '8px 16px', 
              borderRadius: '20px', 
              background: badge.bg,
              color: badge.color,
              fontSize: '14px',
              fontWeight: 600
            }}>
              {badge.text}
            </div>
          </div>
          
          {doc.project_description && (
            <div style={{ marginTop: '20px', padding: '16px', background: '#111', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Project</p>
              <p style={{ margin: 0, fontSize: '15px' }}>{doc.project_description}</p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: '12px', 
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #2a2a2a'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: '#94a3b8', textTransform: 'uppercase' }}>Items</h3>
          
          {lineItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lineItems.map((item, i) => (
                <div key={item.id || i} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '16px',
                  background: '#111',
                  borderRadius: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>{item.description}</p>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                      {item.quantity} x {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '16px' }}>
                    {formatCurrency(item.line_total)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No items</p>
          )}
        </div>

        {/* Totals */}
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: '12px', 
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Subtotal</span>
              <span>{formatCurrency(doc.subtotal)}</span>
            </div>
            
            {(doc.discount_amount && doc.discount_amount > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#22c55e' }}>Discount</span>
                <span style={{ color: '#22c55e' }}>-{formatCurrency(doc.discount_amount)}</span>
              </div>
            )}
            
            {(doc.tax_amount && doc.tax_amount > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Tax</span>
                <span>{formatCurrency(doc.tax_amount)}</span>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid #2a2a2a',
              fontSize: '20px',
              fontWeight: 700
            }}>
              <span>Total</span>
              <span style={{ color: '#d71cd1' }}>{formatCurrency(doc.total)}</span>
            </div>

            {isInvoice && doc.amount_paid && doc.amount_paid > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e' }}>
                  <span>Amount Paid</span>
                  <span>{formatCurrency(doc.amount_paid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Balance Due</span>
                  <span style={{ color: '#f59e0b' }}>{formatCurrency(doc.balance_due || 0)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {(canApprove || canPay) && (
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #2a2a2a'
          }}>
            {canApprove && (
              <button
                onClick={handleApprove}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Processing...' : 'Approve Quote'}
              </button>
            )}
            
            {canPay && (
              <button
                onClick={handlePay}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: 'linear-gradient(135deg, #d71cd1 0%, #8b5cf6 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Processing...' : `Pay ${formatCurrency(doc.balance_due || doc.total)}`}
              </button>
            )}
          </div>
        )}

        {/* Notes */}
        {doc.notes && (
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #2a2a2a'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase' }}>Notes</h3>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>{doc.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '14px' }}>
          <p style={{ margin: '0 0 8px' }}>Frederick Wraps Group</p>
          <p style={{ margin: '0 0 4px' }}>5728 Industry Lane, Frederick, MD 21704</p>
          <p style={{ margin: 0 }}>(240) 693-3715 | info@frederickwraps.com</p>
        </div>
      </div>
    </div>
  )
}
