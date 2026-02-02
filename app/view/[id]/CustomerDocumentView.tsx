'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ============================================================================
// TYPES
// ============================================================================
type Attachment = { 
  url: string; key: string; filename: string; contentType: string; size: number; uploadedAt: string; 
  file_id?: string; file_url?: string; file_name?: string; name?: string; type?: string; mime_type?: string; uploaded_at?: string 
}

type Document = {
  id: string; doc_number: number; doc_type: string; status: string; bucket: string; customer_id: string
  customer_name: string; customer_email: string; customer_phone: string; company_name: string
  vehicle_description: string; project_description: string; category: string
  subtotal: number; discount_amount: number; discount_percent: number; tax_amount: number; total: number
  deposit_required: number; deposit_paid: number; amount_paid: number; balance_due: number
  notes: string; created_at: string; sent_at: string; viewed_at: string; approved_at: string; paid_at: string
  valid_until: string | null; attachments?: Attachment[]; in_production: boolean; fees?: Fee[] | string
  followup_count?: number; last_followup_at?: string; revision_history_json?: any; discount_note?: string
  options_mode?: boolean; options_json?: QuoteOption[]
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

type LineItem = {
  id: string; document_id: string; group_id: string; category: string; line_type: string; package_key: string
  description: string; quantity: number; sqft: number; unit_price: number; rate: number; line_total: number
  sort_order: number; attachments?: Attachment[]; custom_fields?: Record<string, any>; taxable?: boolean
}

type Fee = { fee_type: string; description: string; amount: number }

type Props = {
  document: Document
  lineItems: LineItem[]
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CustomerDocumentView({ document: doc, lineItems }: Props) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [revisionMessage, setRevisionMessage] = useState('')
  const [contactPreference, setContactPreference] = useState<'sms' | 'email'>('sms')
  const [submittingRevision, setSubmittingRevision] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)

  // Mark as viewed on mount
  useEffect(() => {
    if (doc.status === 'sent') {
      supabase.from('documents').update({ 
        status: 'viewed', 
        viewed_at: new Date().toISOString() 
      }).eq('id', doc.id).then(() => {})
    }
  }, [doc.id, doc.status])

  // Parse fees
  const fees: Fee[] = (() => {
    try {
      return Array.isArray(doc.fees) ? doc.fees : JSON.parse(doc.fees || '[]')
    } catch { return [] }
  })()

  // Parse options
  const options: QuoteOption[] = (() => {
    try {
      if (Array.isArray(doc.options_json)) return doc.options_json
      if (typeof doc.options_json === 'string') return JSON.parse(doc.options_json)
      return []
    } catch { return [] }
  })()

  // Get all line item images for gallery
  const galleryImages = lineItems.flatMap(item => 
    (item.attachments || []).filter(att => {
      const url = att.url || att.file_url || ''
      const name = att.name || att.filename || att.file_name || ''
      return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
    }).map(att => ({
      url: att.url || att.file_url || '',
      name: att.name || att.filename || att.file_name || 'Design',
      description: item.description
    }))
  )

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
  const feesTotal = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  const discountAmount = doc.discount_percent ? (subtotal * doc.discount_percent / 100) : (parseFloat(String(doc.discount_amount)) || 0)
  const taxableSubtotal = lineItems.filter(item => item.taxable).reduce((sum, item) => sum + (item.line_total || 0), 0)
  const taxAmount = taxableSubtotal * 0.06
  const total = subtotal + feesTotal - discountAmount + taxAmount
  const balanceDue = total - (doc.amount_paid || 0)

  // Format helpers
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const formatCurrency = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Status badge
  const getStatusLabel = () => {
    const s = doc.status?.toLowerCase()
    if (s === 'draft') return 'Draft'
    if (s === 'sent') return 'Awaiting Review'
    if (s === 'viewed') return 'Under Review'
    if (s === 'approved') return 'Approved'
    if (s === 'paid') return 'Paid'
    if (s === 'partial') return 'Partial Payment'
    if (s === 'revision_requested') return 'Revision Requested'
    if (s === 'option_selected') return 'Option Selected'
    return doc.status || 'Draft'
  }

  const isQuote = doc.doc_type === 'quote'
  const isInvoice = doc.doc_type === 'invoice'
  const canApprove = isQuote && ['sent', 'viewed'].includes(doc.status?.toLowerCase())
  const canPay = (isInvoice || doc.status === 'approved') && balanceDue > 0

  // Handlers
  const handleApprove = async () => {
    if (doc.options_mode && !selectedOption) {
      alert('Please select an option before approving.')
      return
    }
    
    setApproving(true)
    try {
      const updates: any = {
        status: 'approved',
        approved_at: new Date().toISOString()
      }
      
      if (selectedOption) {
        updates.selected_option_id = selectedOption
        updates.status = 'option_selected'
      }
      
      await supabase.from('documents').update(updates).eq('id', doc.id)
      window.location.reload()
    } catch (err) {
      console.error('Approval error:', err)
      alert('Failed to approve. Please try again.')
    }
    setApproving(false)
  }

  const handleRequestRevision = async () => {
    if (!revisionMessage.trim()) return
    
    setSubmittingRevision(true)
    try {
      const existingRevisions = Array.isArray(doc.revision_history_json) 
        ? doc.revision_history_json 
        : JSON.parse(doc.revision_history_json || '[]')
      
      const newRevision = {
        timestamp: new Date().toISOString(),
        from: 'customer',
        name: doc.customer_name,
        message: revisionMessage.trim(),
        contactPreference
      }
      
      await supabase.from('documents').update({
        status: 'revision_requested',
        revision_history_json: [...existingRevisions, newRevision]
      }).eq('id', doc.id)
      
      setShowRevisionModal(false)
      setRevisionMessage('')
      window.location.reload()
    } catch (err) {
      console.error('Revision error:', err)
      alert('Failed to submit revision request.')
    }
    setSubmittingRevision(false)
  }

  const handlePayment = async (method: 'bank' | 'card') => {
    // For now, create a Stripe payment link
    try {
      const res = await fetch('/api/stripe/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          amount: balanceDue,
          method
        })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Payment error:', err)
    }
  }

  // Card fee calculation (3%)
  const cardFee = balanceDue * 0.03
  const cardTotal = balanceDue + cardFee

  return (
    <div style={{ 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#f8f9fa',
      minHeight: '100vh',
      color: '#1a1a1a'
    }}>
      {/* Main Container */}
      <div style={{ maxWidth: '1125px', margin: '0 auto', padding: '24px' }}>
        
        {/* Header Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          marginBottom: '24px',
          position: 'relative'
        }}>
          {/* Maroon accent shape */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '60%',
            height: '200%',
            background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
            borderRadius: '50%',
            zIndex: 0
          }} />
          
          <div style={{ position: 'relative', zIndex: 1, padding: '32px 40px' }}>
            {/* Top row: Logo + Invoice Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg viewBox="0 0 435.3 143.72" xmlns="http://www.w3.org/2000/svg" style={{ width: '240px', height: 'auto' }}>
                  <path d="M306.4,31.4c.8.9,1.5,2,2.1,3.1l.8-1.8v-1.6c-1.2,0-2.3-.1-3.5-.3.2.2.4.4.6.6h0Z"/>
                  <path d="M434.9,31.2V0h-150.7l-23.5,54.7L237.2,0h-31.2l-23.5,54.7L159,0H0v117.3l39.1-7.8v-36.9h78.6l7.8-31.3H39.1v-10.1h93.9c0,.1,33.8,78.2,33.8,78.2l31.8-.2,22.9-62.3,23.5,62.5h31.3l31.1-72.5h0s-.1-.2-.2-.3h0v-.4c-.2-.2-.2-.3-.3-.5-.3-.6-.7-1.2-1-1.7-.1-.2-.2-.3-.3-.4h0s-.1-.1-.2-.2c-.2-.3-.5-.5-.7-.8-.3-.3-.5-.5-.8-.8-.2-.1-.3-.2-.5-.4h-.1s-.2-.1-.2-.2c-.7-.5-1.4-.9-2.2-1.3-.5-.2-.6-.9-.3-1.3.2-.5.8-.5,1.2-.4,0,0-.1,0,0,0h.3c.3,0,.6.2.9.2.8.2,1.7.3,2.6.5h1.5c.7,0,1.3.1,2,.1h.2v-2.4c0-.9-.1-1.8-.2-2.7v-1c0,.3,0,0,0,0,0-.4-.1-.7-.2-1.1-.1-.5.2-1,.7-1.2s1.1.2,1.2.7c.4,1.9.5,3.9.6,5.9v1.9c.8,0,1.6,0,2.5-.1.4,0,.8,0,1.3-.1h1.2c.9-.1,1.8-.3,2.7-.5.5-.1,1,.2,1.2.7s-.2,1.1-.7,1.2c-2,.4-4.1.7-6.2.8h-1.9c0,2.5,0,5-.2,7.6,0,1.4-.1,2.8-.2,4.1v3c0,.4-.4.9-.8,1h-.1v62.6h85.9l39.1,7.9V41.3h-76.4l6.7,26.7h30.3v10h-48.8V31.2h88.3-.4Z"/>
                  <path fill="#be1e2d" d="M292.7,126.2c-.2-.5-.7-.8-1.2-.7-.9.2-1.8.3-2.7.5-.2,0,0,0,0,0h-1.2c-.4,0-.8,0-1.3.1h-2.4v-1.9c0-2-.2-3.9-.6-5.9,0-.5-.7-.8-1.2-.7-.5.2-.8.7-.7,1.2h0c0,.4.1.7.2,1.1,0,0,0,.4,0,0v1c0,.9.2,1.8.2,2.7v2.5h-.2c-.7,0-1.3,0-2-.1h-1.5c-.9-.1-1.7-.3-2.6-.5-.3,0-.6-.2-.9-.2h-.3c-.4-.1-.9,0-1.2.4-.2.4-.1,1.1.3,1.3.7.4,1.5.8,2.2,1.3,0,0,.2.1.2.2h0c.2.1.3.2.5.4.3.2.6.5.8.8.3.3.5.5.7.8,0,0,.1.1.2.2h0c.1.1.2.3.3.4.4.5.7,1.1,1,1.7,0,.2.2.3.2.5v.2s.1,0,.1.1h0c0,.1.1.3.2.3,0,.2.1.3.2.5.2.6.4,1.2.5,1.8.2.6.3,1.2.3,1.8v1.5c0,.5,0,1.1.1,1.6,0,.6-.1,1.4,0,1.9.2.5.6.8,1.1.7.5,0,.9-.5.8-1v-1.4h0v-1.5c0-1.4.2-2.8.2-4.1.1-2.5.2-5,.2-7.5h1.9c2.1-.1,4.2-.4,6.2-.8.5-.1.8-.7.7-1.2h.7ZM279.1,128.6c-.2-.2-.4-.4-.6-.6,1.1.1,2.3.2,3.5.3v4.9c-.7-1.7-1.6-3.2-2.8-4.6h-.1Z"/>
                  <path d="M.2,136.1v-13.2h13.5v2.3H3.3v3.5h5.6v2.4H3.3v5H.2Z"/>
                  <path d="M17.6,136.1v-13.2h11.4c1,0,1.8.2,2.3.6.5.4.7,1.1.7,2v3.1c0,.9-.2,1.5-.7,1.9s-1.3.6-2.3.6h-1.7l6.2,5h-4.4l-5.4-5h-2.9v5h-3.2ZM27.6,125.3h-7v3.7h7c.5,0,.9,0,1.1-.2.2-.2.3-.4.3-.8v-1.6c0-.4,0-.7-.3-.8-.2-.2-.6-.2-1.1-.2h0v-.1Z"/>
                  <path d="M37.1,136.1v-13.2h13.7v2.2h-10.6v2.9h6.2v2.2h-6.2v3.3h10.7v2.5h-13.8v.1Z"/>
                  <path d="M55.9,136.1v-13.2h8.6c2.5,0,4.3.6,5.7,1.7,1.3,1.1,2,2.7,2,4.8s-.3,2.3-.8,3.3-1.2,1.8-2.2,2.3c-.6.3-1.3.6-2.2.8-.8.2-1.9.3-3.3.3h-7.8ZM59,133.7h4c2.1,0,3.6-.3,4.5-1,.9-.6,1.3-1.7,1.3-3.2s-.4-2.4-1.1-3.1c-.8-.7-1.8-1-3.3-1h-5.5v8.4h0l.1-.1Z"/>
                  <path d="M76.1,136.1v-13.2h13.7v2.2h-10.6v2.9h6.2v2.2h-6.2v3.3h10.7v2.5h-13.8v.1Z"/>
                  <path d="M94.6,136.1v-13.2h11.4c1,0,1.8.2,2.3.6.5.4.7,1.1.7,2v3.1c0,.9-.2,1.5-.7,1.9s-1.3.6-2.3.6h-1.7l6.2,5h-4.5l-5.4-5h-2.9v5h-3.1ZM104.7,125.3h-7v3.7h7c.5,0,.9,0,1.1-.2.2-.2.3-.4.3-.8v-1.6c0-.4,0-.7-.3-.8-.2-.2-.6-.2-1.1-.2h0v-.1Z"/>
                  <path d="M114.1,136.1v-13.2h3.1v13.2h-3.1Z"/>
                  <path d="M133.6,125.3h-8.4v8.4h8.4v-2.8l3.1.6v1.6c0,1.2-.2,2-.7,2.5-.5.4-1.3.7-2.6.7h-8c-1.3,0-2.2-.2-2.6-.7-.4-.5-.7-1.3-.7-2.5v-6.9c0-1.2.2-2,.7-2.5.5-.4,1.3-.7,2.6-.7h8c1.3,0,2.2.2,2.6.7.5.4.7,1.3.7,2.5v1.3l-3.1.5v-2.5h0v-.2Z"/>
                  <path d="M141.6,136.1v-13.2h3.1v5.5l7.4-5.5h4.5l-8.8,6.2,9.9,7h-5l-8-5.8v5.8h-3.2.1Z"/>
                  <path d="M174,136.1l-5.1-13.2h3.2l3.4,8.8,3.5-8.8h2.2l3.6,8.8,3.2-8.8h2.8l-5.1,13.2h-2.1l-3.7-9.1-3.7,9.1h-2.2,0Z"/>
                  <path d="M193.5,136.1v-13.2h11.4c1,0,1.8.2,2.3.6.5.4.7,1.1.7,2v3.1c0,.9-.2,1.5-.7,1.9s-1.3.6-2.3.6h-1.7l6.2,5h-4.5l-5.4-5h-2.9v5h-3.1ZM203.6,125.3h-7v3.7h7c.5,0,.9,0,1.1-.2s.3-.4.3-.8v-1.6c0-.4,0-.7-.3-.8-.2-.2-.6-.2-1.1-.2h0v-.1Z"/>
                  <path d="M211.1,136.1l7.5-13.2h3l7.6,13.2h-3.5l-1.6-2.9h-8.4l-1.5,2.9h-3.1ZM217,130.9h5.8l-2.9-5.4-2.9,5.4h0Z"/>
                  <path d="M232.1,136.1v-13.2h11.4c1,0,1.8.2,2.3.6.5.4.7,1.1.7,2v2.9c0,.9-.2,1.5-.7,1.9s-1.3.6-2.3.6h-8.4v5.1h-3v.1ZM242.1,125.3h-7v3.5h7c.5,0,.9,0,1.1-.2s.3-.4.3-.8v-1.4c0-.4,0-.7-.3-.8-.2-.2-.6-.2-1.1-.2h0v-.1Z"/>
                  <path d="M260.7,125.3h-8.7v2.8h8.3c1.3,0,2.2.2,2.7.7s.7,1.3.7,2.5v1.8c0,1.2-.2,2-.7,2.5-.5.4-1.4.7-2.7.7h-8.2c-1.3,0-2.2-.2-2.6-.7s-.7-1.3-.7-2.5v-.3l2.7-.6v1.6h9.4v-3h-8.3c-1.3,0-2.2-.2-2.6-.7s-.7-1.3-.7-2.5v-1.5c0-1.2.2-2,.7-2.5s1.3-.7,2.6-.7h7.6c1.3,0,2.1.2,2.6.7.5.4.7,1.2.7,2.2v.3l-2.7.7v-1.5h-.1Z"/>
                  <path d="M313.5,125.3h-9.7v8.4h9.7v-2.9h-5.1v-2.2h8.1v4.5c0,1.2-.2,2-.7,2.5-.5.4-1.3.7-2.6.7h-9.2c-1.3,0-2.2-.2-2.6-.7-.5-.5-.7-1.3-.7-2.5v-6.9c0-1.2.2-2,.7-2.5.5-.4,1.3-.7,2.6-.7h9.2c1.3,0,2.2.2,2.6.7.5.4.7,1.2.7,2.3v.3l-3,.5v-1.5h0Z"/>
                  <path d="M320.3,136.1v-13.2h11.4c1,0,1.8.2,2.3.6.5.4.7,1.1.7,2v3.1c0,.9-.2,1.5-.7,1.9s-1.3.6-2.3.6h-1.7l6.2,5h-4.4l-5.4-5h-2.9v5h-3.2ZM330.4,125.3h-7v3.7h7c.5,0,.9,0,1.1-.2s.3-.4.3-.8v-1.6c0-.4,0-.7-.3-.8-.2-.2-.6-.2-1.1-.2h0v-.1Z"/>
                  <path d="M337.9,136.1l7.5-13.2h3l7.7,13.2h-3.5l-1.6-2.9h-8.4l-1.5,2.9h-3.2ZM343.9,130.9h5.8l-2.9-5.4-2.9,5.4h0Z"/>
                  <path d="M358.9,136.1v-13.2h11.4c1,0,1.8.2,2.3.6.5.4.7,1.1.7,2v2.9c0,.9-.2,1.5-.7,1.9s-1.3.6-2.3.6h-8.4v5.1h-3v.1ZM368.9,125.3h-7v3.5h7c.5,0,.9,0,1.1-.2s.3-.4.3-.8v-1.4c0-.4,0-.7-.3-.8-.2-.2-.6-.2-1.1-.2h0v-.1Z"/>
                  <path d="M376.1,136.1v-13.2h3.1v5.1h9.7v-5.1h3.1v13.2h-3.1v-5.7h-9.7v5.7h-3.1Z"/>
                  <path d="M396.3,136.1v-13.2h3.1v13.2h-3.1Z"/>
                  <path d="M414.2,125.3h-8.4v8.4h8.4v-2.8l3.1.6v1.6c0,1.2-.2,2-.7,2.5-.5.4-1.3.7-2.6.7h-8c-1.3,0-2.2-.2-2.6-.7-.5-.5-.7-1.3-.7-2.5v-6.9c0-1.2.2-2,.7-2.5.5-.4,1.3-.7,2.6-.7h8c1.3,0,2.2.2,2.6.7.5.4.7,1.3.7,2.5v1.3l-3.1.5v-2.5h0v-.2Z"/>
                  <path d="M432,125.3h-8.7v2.8h8.3c1.3,0,2.2.2,2.7.7s.7,1.3.7,2.5v1.8c0,1.2-.2,2-.7,2.5-.5.4-1.4.7-2.7.7h-8.2c-1.3,0-2.2-.2-2.6-.7s-.7-1.3-.7-2.5v-.3l2.7-.6v1.6h9.4v-3h-8.3c-1.3,0-2.2-.2-2.6-.7s-.7-1.3-.7-2.5v-1.5c0-1.2.2-2,.7-2.5s1.3-.7,2.6-.7h7.6c1.3,0,2.1.2,2.6.7.5.4.7,1.2.7,2.2v.3l-2.7.7v-1.5h-.1Z"/>
                </svg>
              </div>
              
              {/* Invoice Badge */}
              <div style={{
                background: '#be1e2d',
                color: 'white',
                padding: '8px 20px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {isQuote ? 'Quote' : 'Invoice'} #{doc.doc_number}
              </div>
            </div>
            
            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', maxWidth: '55%' }}>
              {/* Bill To */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Bill To</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>{doc.customer_name}</div>
                {doc.company_name && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.company_name}</div>}
                {doc.customer_email && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.customer_email}</div>}
                {doc.customer_phone && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.customer_phone}</div>}
              </div>
              
              {/* Project */}
              <div style={{ maxWidth: '300px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Project</div>
                {doc.vehicle_description && <div style={{ fontSize: '14px', color: '#1a1a1a', marginBottom: '4px' }}>{doc.vehicle_description}</div>}
                {doc.project_description && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.project_description}</div>}
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>Created: {formatDate(doc.created_at)}</div>
              </div>
              
              {/* Status - positioned in center of red area */}
              <div style={{ 
                position: 'absolute',
                top: '60%',
                right: '12%',
                transform: 'translateY(-50%)',
                textAlign: 'center',
                zIndex: 2
              }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Status</div>
                <div style={{
                  display: 'inline-block',
                  padding: '12px 30px',
                  borderRadius: '30px',
                  background: 'linear-gradient(179deg, #ffffff 0%, #969696 40%)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#1a1a1a'
                }}>
                  {getStatusLabel()}
                </div>
                {doc.valid_until && (
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '12px' }}>Valid until: {formatDate(doc.valid_until)}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Design Gallery */}
        {galleryImages.length > 0 && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Design Preview
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {galleryImages.slice(0, 6).map((img, idx) => (
                <div 
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  style={{
                    position: 'relative',
                    paddingBottom: '75%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)'
                  }}
                >
                  <img 
                    src={img.url} 
                    alt={img.name}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '12px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {img.description || img.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options Mode */}
        {doc.options_mode && options.length > 0 && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
              Select Your Option
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedOption(opt.id)}
                  style={{
                    padding: '20px 24px',
                    borderRadius: '12px',
                    border: selectedOption === opt.id ? '2px solid #be1e2d' : '2px solid #e5e7eb',
                    background: selectedOption === opt.id ? 'rgba(190,30,45,0.05)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>{opt.title}</div>
                      {opt.description && <div style={{ fontSize: '14px', color: '#6b7280' }}>{opt.description}</div>}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#be1e2d' }}>
                      {opt.price_max 
                        ? `${formatCurrency(opt.price_min)} - ${formatCurrency(opt.price_max)}`
                        : formatCurrency(opt.price_min)
                      }
                    </div>
                  </div>
                  {opt.attachments && opt.attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {opt.attachments.slice(0, 4).map((att, idx) => (
                        <img 
                          key={idx}
                          src={att.url || att.file_url || ''}
                          alt=""
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line Items (non-options mode) */}
        {!doc.options_mode && lineItems.length > 0 && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
              {isQuote ? 'Quote Details' : 'Invoice Details'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lineItems.map((item, idx) => (
                <div 
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px 0',
                    borderBottom: idx < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                    marginTop: '6px',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{item.description || 'Line Item'}</div>
                    {item.category && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{item.category}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{formatCurrency(item.line_total)}</div>
                    {item.quantity > 1 && (
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.quantity} × {formatCurrency(item.rate || item.unit_price)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Totals */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>Subtotal</span>
                <span style={{ color: '#1a1a1a' }}>{formatCurrency(subtotal)}</span>
              </div>
              
              {feesTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280' }}>Fees</span>
                  <span style={{ color: '#1a1a1a' }}>{formatCurrency(feesTotal)}</span>
                </div>
              )}
              
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#22c55e' }}>Discount {doc.discount_percent ? `(${doc.discount_percent}%)` : ''}</span>
                  <span style={{ color: '#22c55e' }}>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              
              {taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280' }}>Tax (6%)</span>
                  <span style={{ color: '#1a1a1a' }}>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #e5e7eb', marginTop: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Total</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#be1e2d' }}>{formatCurrency(total)}</span>
              </div>
              
              {(doc.amount_paid || 0) > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ color: '#22c55e' }}>Amount Paid</span>
                    <span style={{ color: '#22c55e' }}>-{formatCurrency(doc.amount_paid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>Balance Due</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Payment Options */}
        {(canApprove || canPay) && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
              {canApprove ? 'Approve & Pay' : 'Payment Options'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bank Transfer - Featured */}
              <div 
                onClick={() => canPay && handlePayment('bank')}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#be1e2d'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(190,30,45,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  background: 'linear-gradient(135deg, #e8e9eb 0%, #f5f5f5 100%)',
                  cursor: canPay ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  padding: '4px 12px',
                  background: 'linear-gradient(179deg, #ffffff 0%, #969696 40%)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  SAVE {formatCurrency(cardFee)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>Bank Transfer</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>{formatCurrency(balanceDue)}</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>No processing fee</div>
              </div>
              
              {/* Credit Card */}
              <div 
                onClick={() => canPay && handlePayment('card')}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#be1e2d'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(190,30,45,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  cursor: canPay ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>Credit Card</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>{formatCurrency(cardTotal)}</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Includes 3% processing fee</div>
              </div>
            </div>
            
            {/* Approve Button (for quotes) */}
            {canApprove && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleApprove}
                  disabled={approving || (doc.options_mode && !selectedOption)}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: (approving || (doc.options_mode && !selectedOption)) ? 'not-allowed' : 'pointer',
                    opacity: (approving || (doc.options_mode && !selectedOption)) ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {approving ? 'Approving...' : 'Approve Quote'}
                </button>
                <button
                  onClick={() => setShowRevisionModal(true)}
                  style={{
                    padding: '16px 24px',
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    color: '#6b7280',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Request Changes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Contact Section */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px 32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
            Questions? Get in Touch
          </h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a 
              href="tel:+12407705424"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                color: '#1a1a1a',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              (240) 770-5424
            </a>
            <a 
              href="mailto:joe@frederickwraps.com"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                color: '#1a1a1a',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              joe@frederickwraps.com
            </a>
          </div>
        </div>

        {/* Trust Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '48px',
          padding: '24px 0',
          marginBottom: '24px'
        }}>
          {[
            { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, label: 'Secure Payment' },
            { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>, label: 'Licensed & Insured' },
            { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, label: '5-Star Rated' }
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280', fontSize: '13px', fontWeight: 500 }}>
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ color: '#be1e2d', fontSize: '14px', fontWeight: 500, fontStyle: 'italic', margin: '0 0 12px 0' }}>
  Simple, Honest & Convenient
</p>
<p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>
  Frederick Wraps & Graphics | 5728 Industry Lane, Frederick, MD 21704
</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
            <a href="https://frederickwraps.com" style={{ color: '#be1e2d', fontSize: '13px', textDecoration: 'none' }}>Website</a>
            <a href="tel:+12407705424" style={{ color: '#be1e2d', fontSize: '13px', textDecoration: 'none' }}>Call Us</a>
            <a href="mailto:joe@frederickwraps.com" style={{ color: '#be1e2d', fontSize: '13px', textDecoration: 'none' }}>Email</a>
          </div>
        </div>
      </div>

      {/* Revision Modal */}
      {showRevisionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowRevisionModal(false)}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            padding: '32px'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px 0' }}>Request Changes</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>Let us know what changes you'd like to make to this quote.</p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>
                Your Message
              </label>
              <textarea
                value={revisionMessage}
                onChange={(e) => setRevisionMessage(e.target.value)}
                placeholder="Describe the changes you'd like..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>
                Preferred Contact Method
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['sms', 'email'] as const).map(pref => (
                  <label 
                    key={pref}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: contactPreference === pref ? '2px solid #be1e2d' : '1px solid #e5e7eb',
                      background: contactPreference === pref ? 'rgba(190,30,45,0.05)' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="contactPref"
                      value={pref}
                      checked={contactPreference === pref}
                      onChange={() => setContactPreference(pref)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', textTransform: 'capitalize' }}>{pref === 'sms' ? 'Text/SMS' : 'Email'}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowRevisionModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={submittingRevision || !revisionMessage.trim()}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: (submittingRevision || !revisionMessage.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (submittingRevision || !revisionMessage.trim()) ? 0.6 : 1
                }}
              >
                {submittingRevision ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && galleryImages[lightboxIndex] && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2000
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 24px' 
          }}>
            <span style={{ color: 'white', fontSize: '14px' }}>
              {lightboxIndex + 1} / {galleryImages.length}
            </span>
            <button 
              onClick={() => setLightboxIndex(null)}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: 'none', 
                color: 'white', 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative'
          }}>
            {galleryImages.length > 1 && (
              <button 
                onClick={() => setLightboxIndex(i => i !== null ? (i > 0 ? i - 1 : galleryImages.length - 1) : null)}
                style={{ 
                  position: 'absolute', 
                  left: '20px', 
                  background: 'rgba(255,255,255,0.1)', 
                  border: 'none', 
                  color: 'white', 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}
            <img 
              src={galleryImages[lightboxIndex].url} 
              alt=""
              style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '8px' }}
            />
            {galleryImages.length > 1 && (
              <button 
                onClick={() => setLightboxIndex(i => i !== null ? (i < galleryImages.length - 1 ? i + 1 : 0) : null)}
                style={{ 
                  position: 'absolute', 
                  right: '20px', 
                  background: 'rgba(255,255,255,0.1)', 
                  border: 'none', 
                  color: 'white', 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}