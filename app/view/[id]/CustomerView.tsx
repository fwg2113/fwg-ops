'use client'

import { useState } from 'react'

type Attachment = {
  url?: string
  file_url?: string
  filename?: string
  file_name?: string
  name?: string
  contentType?: string
  type?: string
}

type QuoteOption = {
  id: string
  title: string
  description: string
  price_min: number
  price_max?: number
  attachments?: Attachment[]
  sort_order: number
}

type CustomerDocument = {
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
  category?: string
  subtotal: number
  discount_amount?: number
  discount_percent?: number
  discount_note?: string
  tax_amount?: number
  total: number
  deposit_required?: number
  deposit_paid?: number
  amount_paid?: number
  balance_due?: number
  notes?: string
  created_at: string
  valid_until?: string
  revision_history_json?: any
  options_mode?: boolean
  options_json?: QuoteOption[]
}

type LineItem = {
  id: string
  description: string
  quantity: number
  sqft?: number
  unit_price: number
  rate?: number
  line_total: number
  attachments?: Attachment[]
}

export default function CustomerView({ document: doc, lineItems }: { document: CustomerDocument, lineItems: LineItem[] }) {
  const [status, setStatus] = useState(doc.status)
  const [submitting, setSubmitting] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionMessage, setRevisionMessage] = useState('')
  const [revisionName, setRevisionName] = useState('')
  const [contactPreference, setContactPreference] = useState<'sms' | 'email'>('sms')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [mainImageIndex, setMainImageIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [optionQuestion, setOptionQuestion] = useState('')
  const [showQuestionField, setShowQuestionField] = useState(false)
  
  // Parse options
  const options: QuoteOption[] = (() => {
    try {
      if (Array.isArray(doc.options_json)) return doc.options_json
      if (typeof doc.options_json === 'string') return JSON.parse(doc.options_json)
      return []
    } catch { return [] }
  })()
  const isOptionsMode = doc.options_mode && options.length > 0
  
  const isQuote = doc.doc_type === 'quote'
  const isInvoice = doc.doc_type === 'invoice'
  const docLabel = isQuote ? 'Quote' : 'Invoice'
  
  const canRespond = isQuote && ['sent', 'viewed', 'Sent', 'Viewed'].includes(status)
  const canPay = isInvoice && !['paid', 'Paid'].includes(status)
  const isApproved = ['approved', 'Approved'].includes(status)
  const isPaid = ['paid', 'Paid'].includes(status)
  
  // Calculate amounts
  const balanceDue = doc.balance_due ?? (doc.total - (doc.amount_paid || 0))
  const depositAmount = doc.deposit_required || (doc.total * 0.5)
  const amountToPay = (doc.amount_paid || 0) > 0 ? balanceDue : depositAmount
  
  // Card processing fee (2.9% + $0.30)
  const processingFee = (amountToPay * 0.029) + 0.30
  const cardTotal = amountToPay + processingFee
  
  // Get all image attachments from line items
  const allAttachments: Attachment[] = []
  lineItems.forEach(item => {
    if (item.attachments) {
      item.attachments.forEach(att => {
        const url = att.url || att.file_url
        if (url) allAttachments.push(att)
      })
    }
  })
  const imageAttachments = allAttachments.filter(att => {
    const url = att.url || att.file_url || ''
    const name = att.filename || att.file_name || att.name || ''
    return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + url)
  })

  const handleChangeMind = async () => {
    if (!confirm('This will reset your approval. You can then request revisions or approve again. Continue?')) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, status: 'sent' })
      })
      
      if (res.ok) {
        setStatus('sent')
      } else {
        alert('Failed to reset approval')
      }
    } catch (e) {
      alert('Error resetting approval')
    }
    setSubmitting(false)
  }

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id })
      })
      
      if (res.ok) {
        setStatus('approved')
      } else {
        alert('Failed to approve quote')
      }
    } catch (e) {
      alert('Error approving quote')
    }
    setSubmitting(false)
  }

  const handlePayByCard = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: doc.id,
          amount: cardTotal
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

  const handlePayByBank = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/payment/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: doc.id,
          amount: amountToPay
        })
      })
      
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to create bank payment link')
      }
    } catch (e) {
      alert('Error creating payment')
    }
    setSubmitting(false)
  }

  const handleSubmitOption = async () => {
    if (!selectedOptionId) return
    
    const selectedOption = options.find(o => o.id === selectedOptionId)
    if (!selectedOption) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/option-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: doc.id,
          optionId: selectedOptionId,
          optionTitle: selectedOption.title,
          question: optionQuestion || null,
          customerName: doc.customer_name
        })
      })
      
      if (res.ok) {
        setStatus('option_selected')
        alert('Thank you! Your selection has been submitted. We will be in touch shortly.')
      } else {
        alert('Failed to submit selection')
      }
    } catch (e) {
      alert('Error submitting selection')
    }
    setSubmitting(false)
  }

  const handleSubmitRevision = async () => {
    if (!revisionMessage.trim()) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: doc.id,
          message: revisionMessage,
          name: revisionName || doc.customer_name,
          contactPreference: contactPreference
        })
      })
      
      if (res.ok) {
        setShowRevisionModal(false)
        setRevisionMessage('')
        alert('Revision request sent! We will be in touch shortly.')
      } else {
        alert('Failed to submit revision request')
      }
    } catch (e) {
      alert('Error submitting revision')
    }
    setSubmitting(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
  }

  const getStatusBadge = () => {
    const s = status?.toLowerCase()
    if (s === 'approved') return { text: 'Approved', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' }
    if (s === 'paid') return { text: 'Paid in Full', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' }
    if (s === 'partial') return { text: 'Partial Payment Received', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    if (s === 'viewed' || s === 'sent') return { text: 'Awaiting Your Response', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    if (s === 'revision_requested') return { text: 'Revision In Progress - We\'ll be in touch soon!', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' }
    if (s === 'option_selected') return { text: 'Option Selected - We\'ll finalize your quote soon!', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' }
    return { text: status, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  }

  const badge = getStatusBadge()

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ 
        background: '#1e293b', 
        borderRadius: '0 0 16px 16px',
        padding: '32px 20px',
        textAlign: 'center',
        margin: '0 auto',
        maxWidth: '900px',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
            <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
            <path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/>
          </svg>
        </div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#d71cd1' }}>Frederick Wraps & Graphics</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Professional Vehicle Wraps & Graphics</p>
        
        <div style={{ marginTop: '24px' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '18px' }}>Your {docLabel}</p>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{docLabel} #{doc.doc_number}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Status Badge */}
        <div style={{ 
          background: badge.bg,
          border: `1px solid ${badge.color}33`,
          borderRadius: '8px',
          padding: '12px 20px',
          textAlign: 'center',
          marginBottom: '24px',
          color: badge.color,
          fontWeight: 500
        }}>
          {badge.text}
        </div>

        {/* OPTIONS MODE VIEW */}
        {isOptionsMode && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #7c3aed, #d71cd1)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ marginBottom: '12px' }}>
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>Please Select an Option</h2>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                Review the options below and select the one that best fits your needs
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {options.sort((a, b) => a.sort_order - b.sort_order).map((opt) => {
                const isSelected = selectedOptionId === opt.id
                const optImages = (opt.attachments || []).filter(att => {
                  const url = att.url || att.file_url || ''
                  const name = att.filename || att.file_name || att.name || ''
                  return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + url)
                })
                
                return (
                  <div 
                    key={opt.id}
                    onClick={() => setSelectedOptionId(opt.id)}
                    style={{ 
                      background: '#1e293b',
                      border: isSelected ? '2px solid #22c55e' : '2px solid #334155',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 20px rgba(34, 197, 94, 0.3)' : 'none'
                    }}
                  >
                    <div style={{ 
                      padding: '16px 20px',
                      background: isSelected ? 'rgba(34, 197, 94, 0.1)' : '#161b26',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      borderBottom: '1px solid #334155'
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: isSelected ? '2px solid #22c55e' : '2px solid #64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isSelected && (
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
                        )}
                      </div>
                      
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, flex: 1, color: isSelected ? '#22c55e' : '#f1f5f9' }}>
                        {opt.title}
                      </h3>
                      
                      {isSelected && (
                        <span style={{ 
                          padding: '4px 12px', 
                          background: '#22c55e', 
                          borderRadius: '20px', 
                          fontSize: '12px', 
                          fontWeight: 600,
                          color: 'white'
                        }}>
                          SELECTED
                        </span>
                      )}
                    </div>

                    <div style={{ padding: '20px' }}>
                      {optImages.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          {optImages.length === 1 ? (
                            <div 
                              style={{ borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); setLightboxUrl(optImages[0].url || optImages[0].file_url || null) }}
                            >
                              <img src={optImages[0].url || optImages[0].file_url} alt={opt.title} style={{ width: '100%', display: 'block' }} />
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                              {optImages.map((att, idx) => (
                                <div 
                                  key={idx}
                                  style={{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '1', cursor: 'pointer' }}
                                  onClick={(e) => { e.stopPropagation(); setLightboxUrl(att.url || att.file_url || null) }}
                                >
                                  <img src={att.url || att.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {opt.description && (
                        <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>
                          {opt.description}
                        </p>
                      )}

                      <div style={{ 
                        padding: '12px 16px', 
                        background: '#0f172a', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{ color: '#64748b', fontSize: '14px' }}>Estimated Price</span>
                        <span style={{ color: '#22c55e', fontSize: '24px', fontWeight: 700 }}>
                          {opt.price_max 
                            ? `$${opt.price_min.toLocaleString()} - $${opt.price_max.toLocaleString()}`
                            : `$${opt.price_min.toLocaleString()}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '24px' }}>
              {!showQuestionField ? (
                <button
                  onClick={() => setShowQuestionField(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'transparent',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Have a question? Click here
                </button>
              ) : (
                <div style={{ 
                  background: '#1e293b', 
                  border: '1px solid #334155', 
                  borderRadius: '8px', 
                  padding: '16px' 
                }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Your Question (optional)
                  </label>
                  <textarea
                    value={optionQuestion}
                    onChange={(e) => setOptionQuestion(e.target.value)}
                    placeholder="Type your question here..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitOption}
              disabled={!selectedOptionId || submitting}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '18px',
                background: !selectedOptionId || submitting 
                  ? '#334155' 
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 700,
                cursor: !selectedOptionId || submitting ? 'not-allowed' : 'pointer',
                opacity: !selectedOptionId || submitting ? 0.6 : 1
              }}
            >
              {submitting ? 'Submitting...' : selectedOptionId ? 'Submit My Selection' : 'Select an Option Above'}
            </button>
          </div>
        )}

        {/* Design/Attachments Section */}
        {imageAttachments.length > 0 && !isOptionsMode && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              borderRadius: '8px 8px 0 0',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style={{ fontWeight: 600 }}>Your Design</span>
            </div>
            <div style={{ 
              background: '#1e293b',
              borderRadius: '0 0 8px 8px',
              padding: '16px',
              border: '1px solid #334155',
              borderTop: 'none'
            }}>
              {imageAttachments[mainImageIndex] && (
                <div 
                  style={{ 
                    width: '100%', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    marginBottom: imageAttachments.length > 1 ? '12px' : 0,
                    cursor: 'pointer'
                  }}
                  onClick={() => setLightboxUrl(imageAttachments[mainImageIndex].url || imageAttachments[mainImageIndex].file_url || null)}
                >
                  <img 
                    src={imageAttachments[mainImageIndex].url || imageAttachments[mainImageIndex].file_url} 
                    alt="Design" 
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              )}
              
              {imageAttachments.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {imageAttachments.map((att, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '6px', 
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: mainImageIndex === idx ? '2px solid #d71cd1' : '2px solid transparent'
                      }}
                      onClick={() => setMainImageIndex(idx)}
                    >
                      <img 
                        src={att.url || att.file_url} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {imageAttachments.length > 0 && (
                <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                  Tap to enlarge
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quote Actions - Request Revision / Love It */}
        {canRespond && !isOptionsMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => setShowRevisionModal(true)}
              style={{
                padding: '16px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Request Revision
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              style={{
                padding: '16px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              Love It!
            </button>
          </div>
        )}

        {/* Design Approved Badge with Changed My Mind */}
        {isQuote && isApproved && !isOptionsMode && (
          <div style={{ 
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '24px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>Design Approved</span>
            <button
              onClick={handleChangeMind}
              disabled={submitting}
              style={{
                marginLeft: '8px',
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid #22c55e',
                borderRadius: '6px',
                color: '#22c55e',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Changed My Mind?
            </button>
          </div>
        )}

        {/* Invoice Payment Options */}
        {canPay && (
          <div style={{ 
            background: '#1e293b',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #334155'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, textAlign: 'center' }}>Payment Options</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handlePayByBank}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                Pay {formatCurrency(amountToPay)} by Bank Transfer
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, opacity: 0.9, marginTop: '4px' }}>No processing fee - Recommended</span>
              </button>
              
              <button
                onClick={handlePayByCard}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                Pay {formatCurrency(cardTotal)} by Card
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginTop: '4px' }}>
                  Includes {formatCurrency(processingFee)} processing fee (2.9% + $0.30)
                </span>
              </button>
            </div>
            
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                or pay by phone: <a href="tel:+12406933715" style={{ color: '#d71cd1' }}>(240) 693-3715</a>
                <span style={{ margin: '0 8px' }}>•</span>
                Zelle: <span style={{ color: '#d71cd1' }}>info@frederickwraps.com</span>
              </p>
            </div>
          </div>
        )}

        {/* Paid Confirmation */}
        {isPaid && (
          <div style={{ 
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            textAlign: 'center'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ marginBottom: '12px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h3 style={{ margin: '0 0 8px', color: '#22c55e', fontSize: '20px' }}>Payment Complete!</h3>
            <p style={{ margin: 0, color: '#94a3b8' }}>Thank you for your payment. We will be in touch soon.</p>
          </div>
        )}

        {/* Questions Footer */}
        <div style={{ 
          background: '#1e293b',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #334155',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Questions?</h3>
          <p style={{ margin: '0 0 4px' }}>
            <a href="tel:+12406933715" style={{ color: '#d71cd1', textDecoration: 'none' }}>(240) 693-3715</a>
          </p>
          <p style={{ margin: 0 }}>
            <a href="mailto:info@frederickwraps.com" style={{ color: '#d71cd1', textDecoration: 'none' }}>info@frederickwraps.com</a>
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px' }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} Frederick Wraps Group. All rights reserved.</p>
        </div>
      </div>

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.8)', 
          zIndex: 1000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setShowRevisionModal(false)}>
          <div style={{ 
            background: '#1e293b', 
            borderRadius: '16px', 
            width: '100%', 
            maxWidth: '450px',
            border: '1px solid #334155'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Request Revision</h2>
              <button onClick={() => setShowRevisionModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px', color: '#94a3b8' }}>
                Let us know what changes you'd like to see. We'll update the design and send you a revised quote.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Your Name</label>
                <input 
                  type="text"
                  value={revisionName}
                  onChange={(e) => setRevisionName(e.target.value)}
                  placeholder={doc.customer_name}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>What changes would you like?</label>
                <textarea 
                  value={revisionMessage}
                  onChange={(e) => setRevisionMessage(e.target.value)}
                  placeholder="Describe the changes you'd like to see..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase' }}>How should we contact you?</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="contactPreference"
                      value="sms"
                      checked={contactPreference === 'sms'}
                      onChange={(e) => setContactPreference(e.target.value as 'sms' | 'email')}
                      style={{ accentColor: '#d71cd1' }}
                    />
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span style={{ color: '#f1f5f9', fontSize: '14px' }}>Text Message</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="contactPreference"
                      value="email"
                      checked={contactPreference === 'email'}
                      onChange={(e) => setContactPreference(e.target.value as 'sms' | 'email')}
                      style={{ accentColor: '#d71cd1' }}
                    />
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <span style={{ color: '#f1f5f9', fontSize: '14px' }}>Email</span>
                  </label>
                </div>
              </div>
              
              <button
                onClick={handleSubmitRevision}
                disabled={submitting || !revisionMessage.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: submitting || !revisionMessage.trim() ? '#334155' : 'linear-gradient(135deg, #d71cd1, #8b5cf6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: submitting || !revisionMessage.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.95)', 
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '20px'
          }} 
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            onClick={() => setLightboxUrl(null)}
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              color: 'white', 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
          <img 
            src={lightboxUrl} 
            alt="Full size" 
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}