'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  send_options_json?: { includeLineAttachments?: boolean; includeProjectAttachments?: boolean; [key: string]: any }
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

type Payment = {
  id: string
  amount: number
  processing_fee: number
  payment_method: string
  processor: string
  status: string
  created_at: string
}

type Props = {
  document: Document
  lineItems: LineItem[]
  payments?: Payment[]
}

// ============================================================================
// HELPER: Get image attachments from an option
// ============================================================================
function getOptionImages(opt: QuoteOption): { url: string; name: string }[] {
  if (!opt.attachments || opt.attachments.length === 0) return []
  return opt.attachments
    .filter(att => {
      const url = att.url || att.file_url || ''
      const name = att.name || att.filename || att.file_name || ''
      return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
    })
    .map(att => ({
      url: att.url || att.file_url || '',
      name: att.name || att.filename || att.file_name || 'Design'
    }))
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CustomerDocumentView({ document: doc, lineItems, payments = [] }: Props) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [revisionMessage, setRevisionMessage] = useState('')
  const [contactPreference, setContactPreference] = useState<'sms' | 'email'>('sms')
  const [submittingRevision, setSubmittingRevision] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [status, setStatus] = useState(doc.status)
  const [submittingOption, setSubmittingOption] = useState(false)
  const [optionRevisionText, setOptionRevisionText] = useState('')
  const [optionContactPref, setOptionContactPref] = useState<'sms' | 'email'>('sms')

  // Option hero image indexes (per option)
  const [optionHeroIndexes, setOptionHeroIndexes] = useState<Record<string, number>>({})
  // Line item hero image indexes
  const [itemHeroIndexes, setItemHeroIndexes] = useState<Record<string, number>>({})
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Ref for PDF capture
  const documentRef = useRef<HTMLDivElement>(null)

  // Option lightbox state
  const [optLightbox, setOptLightbox] = useState<{ optionId: string; index: number } | null>(null)
  const [optLightboxZoom, setOptLightboxZoom] = useState(1)
  const [optLightboxPan, setOptLightboxPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })

  // Standard lightbox zoom/pan state
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 })
  const [isLightboxDragging, setIsLightboxDragging] = useState(false)
  const lightboxDragStart = useRef({ x: 0, y: 0 })
  const lightboxPanStart = useRef({ x: 0, y: 0 })

  // Mark as viewed on mount
  useEffect(() => {
    if (doc.status === 'sent') {
      supabase.from('documents').update({ 
        status: 'viewed', 
        viewed_at: new Date().toISOString() 
      }).eq('id', doc.id).then(() => {
        setStatus('viewed')
      })
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

  const isOptionsMode = doc.options_mode && options.length > 0

  // Parse send options to determine what attachments to show
  const sendOptions = (() => {
    try {
      if (typeof doc.send_options_json === 'string') return JSON.parse(doc.send_options_json)
      return doc.send_options_json || {}
    } catch { return {} }
  })()
  const showLineAttachments = sendOptions.includeLineAttachments !== false // default true
  const showProjectAttachments = sendOptions.includeProjectAttachments === true // default false

  // Get all line item images for gallery (non-options mode)
  const lineItemImages = showLineAttachments ? lineItems.flatMap(item => 
    (item.attachments || []).filter(att => {
      const url = att.url || att.file_url || ''
      const name = att.name || att.filename || att.file_name || ''
      return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
    }).map(att => ({
      url: att.url || att.file_url || '',
      name: att.name || att.filename || att.file_name || 'Design',
      description: item.description
    }))
  ) : []

  // Get project-level attachment images
  const projectImages = showProjectAttachments ? (doc.attachments || []).filter(att => {
    const url = att.url || att.file_url || ''
    const name = att.name || att.filename || att.file_name || ''
    return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
  }).map(att => ({
    url: att.url || att.file_url || '',
    name: att.name || att.filename || att.file_name || 'Project File',
    description: 'Project Attachment'
  })) : []

  // Combine both sets of images
  const galleryImages = [...projectImages, ...lineItemImages]

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
  const feesTotal = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  const discountAmount = doc.discount_percent ? (subtotal * doc.discount_percent / 100) : (parseFloat(String(doc.discount_amount)) || 0)
  const taxableSubtotal = lineItems.filter(item => item.taxable).reduce((sum, item) => sum + (item.line_total || 0), 0)
  const taxAmount = taxableSubtotal * 0.06
  const total = subtotal + feesTotal - discountAmount + taxAmount
  // Calculate actual amount paid from payments table (doc.amount_paid may not be updated)
  const actualAmountPaid = (() => {
    const fromPayments = payments.filter(p => p.status === 'completed').reduce((sum, p) => {
      const amt = parseFloat(String(p.amount)) || 0
      const fee = parseFloat(String(p.processing_fee)) || 0
      // If processing_fee is valid (> 0 and less than amount), subtract it
      if (fee > 0 && fee < amt) return sum + (amt - fee)
      // If processing_fee equals amount (known bug), reverse-calculate net from card fee formula
      if (fee >= amt && p.payment_method === 'card') return sum + Math.round(((amt - 0.30) / 1.029) * 100) / 100
      // Bank transfer or no fee — full amount goes toward balance
      return sum + amt
    }, 0)
    // Use whichever is higher: calculated from payments or doc.amount_paid
    return Math.max(fromPayments, parseFloat(String(doc.amount_paid)) || 0)
  })()
  const balanceDue = total - actualAmountPaid
  const depositRequired = doc.deposit_required || 0
  const amountDue = depositRequired > 0 && depositRequired < total && actualAmountPaid < depositRequired
    ? depositRequired - actualAmountPaid
    : balanceDue

  // Format helpers
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const formatCurrency = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatCategory = (cat: string) => {
    if (!cat) return ''
    return cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }

  // Status badge
  const getStatusLabel = () => {
    const s = status?.toLowerCase()
    if (s === 'draft') return 'Draft'
    if (s === 'sent') return 'Awaiting Review'
    if (s === 'viewed') return 'Under Review'
    if (s === 'approved') return 'Approved'
    if (s === 'paid') return 'Paid'
    if (s === 'partial') return 'Partial Payment'
    if (s === 'revision_requested') return 'Revision Requested'
    if (s === 'option_selected') return 'Option Selected'
    return status || 'Draft'
  }

  const isQuote = doc.doc_type === 'quote'
  const isInvoice = doc.doc_type === 'invoice'
  const canApprove = isQuote && ['sent', 'viewed'].includes(status?.toLowerCase()) && !isOptionsMode
  const canPay = (isInvoice || ['approved', 'partial'].includes(status?.toLowerCase())) && balanceDue > 0.01

  // Card fee calculation (2.9% + $0.30)
  const cardFee = amountDue * 0.029 + 0.30
  const cardTotal = amountDue + cardFee

  // ============================================================================
  // OPTION LIGHTBOX HANDLERS
  // ============================================================================
  const handleOptLightboxClose = useCallback(() => {
    setOptLightbox(null)
    setOptLightboxZoom(1)
    setOptLightboxPan({ x: 0, y: 0 })
  }, [])

  const handleOptLightboxNav = useCallback((dir: 'prev' | 'next') => {
    if (!optLightbox) return
    const images = getOptionImages(options.find(o => o.id === optLightbox.optionId)!)
    if (!images.length) return
    const newIndex = dir === 'next'
      ? (optLightbox.index + 1) % images.length
      : (optLightbox.index - 1 + images.length) % images.length
    setOptLightbox({ ...optLightbox, index: newIndex })
    setOptLightboxZoom(1)
    setOptLightboxPan({ x: 0, y: 0 })
  }, [optLightbox, options])

  const handleOptLightboxDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (optLightboxZoom > 1) {
      setOptLightboxZoom(1)
      setOptLightboxPan({ x: 0, y: 0 })
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      setOptLightboxZoom(2.5)
      setOptLightboxPan({ x: -x * 1.5, y: -y * 1.5 })
    }
  }, [optLightboxZoom])

  const handleOptMouseDown = useCallback((e: React.MouseEvent) => {
    if (optLightboxZoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...optLightboxPan }
  }, [optLightboxZoom, optLightboxPan])

  const handleOptMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || optLightboxZoom <= 1) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setOptLightboxPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy
    })
  }, [isDragging, optLightboxZoom])

  const handleOptMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Keyboard nav for lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!optLightbox) return
      if (e.key === 'Escape') handleOptLightboxClose()
      if (e.key === 'ArrowLeft') handleOptLightboxNav('prev')
      if (e.key === 'ArrowRight') handleOptLightboxNav('next')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [optLightbox, handleOptLightboxClose, handleOptLightboxNav])

  // ============================================================================
  // STANDARD LIGHTBOX HANDLERS (zoom/pan)
  // ============================================================================
  const handleLightboxDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (lightboxZoom > 1) {
      setLightboxZoom(1)
      setLightboxPan({ x: 0, y: 0 })
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      setLightboxZoom(2.5)
      setLightboxPan({ x: -x * 1.5, y: -y * 1.5 })
    }
  }, [lightboxZoom])

  const handleLightboxMouseDown = useCallback((e: React.MouseEvent) => {
    if (lightboxZoom <= 1) return
    e.preventDefault()
    setIsLightboxDragging(true)
    lightboxDragStart.current = { x: e.clientX, y: e.clientY }
    lightboxPanStart.current = { ...lightboxPan }
  }, [lightboxZoom, lightboxPan])

  const handleLightboxMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isLightboxDragging || lightboxZoom <= 1) return
    const dx = e.clientX - lightboxDragStart.current.x
    const dy = e.clientY - lightboxDragStart.current.y
    setLightboxPan({
      x: lightboxPanStart.current.x + dx,
      y: lightboxPanStart.current.y + dy
    })
  }, [isLightboxDragging, lightboxZoom])

  const handleLightboxMouseUp = useCallback(() => {
    setIsLightboxDragging(false)
  }, [])

  const handleLightboxNav = useCallback((dir: 'prev' | 'next') => {
    setLightboxIndex(i => {
      if (i === null) return null
      const newIndex = dir === 'next'
        ? (i + 1) % galleryImages.length
        : (i - 1 + galleryImages.length) % galleryImages.length
      // Reset zoom when navigating
      setLightboxZoom(1)
      setLightboxPan({ x: 0, y: 0 })
      return newIndex
    })
  }, [])

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null)
    setLightboxZoom(1)
    setLightboxPan({ x: 0, y: 0 })
  }, [])

  // Keyboard nav for standard lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return
      if (e.key === 'Escape') handleLightboxClose()
      if (e.key === 'ArrowLeft') handleLightboxNav('prev')
      if (e.key === 'ArrowRight') handleLightboxNav('next')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, handleLightboxClose, handleLightboxNav])

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleApprove = async () => {
    setApproving(true)
    try {
      const res = await fetch('/api/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, convertToInvoice: true })
      })
      if (res.ok) {
        setStatus('approved')
        window.location.reload()
      } else {
        alert('Failed to approve. Please try again.')
      }
    } catch (err) {
      console.error('Approval error:', err)
      alert('Failed to approve. Please try again.')
    }
    setApproving(false)
  }

  const handleSubmitOption = async () => {
    if (!selectedOption) return
    const opt = options.find(o => o.id === selectedOption)
    if (!opt) return

    setSubmittingOption(true)
    try {
      const res = await fetch('/api/documents/option-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          optionId: selectedOption,
          optionTitle: opt.title,
          question: optionRevisionText.trim() || null,
          customerName: doc.customer_name,
          contactPreference: optionContactPref
        })
      })

      if (res.ok) {
        setStatus('option_selected')
      } else {
        alert('Failed to submit selection. Please try again.')
      }
    } catch (err) {
      console.error('Option selection error:', err)
      alert('Error submitting selection. Please try again.')
    }
    setSubmittingOption(false)
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
      setStatus('revision_requested')
      window.location.reload()
    } catch (err) {
      console.error('Revision error:', err)
      alert('Failed to submit revision request.')
    }
    setSubmittingRevision(false)
  }

  const handlePayment = async (method: 'bank' | 'card') => {
    try {
      const endpoint = method === 'bank' ? '/api/payment/bank' : '/api/payment'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          amount: method === 'card' ? cardTotal : amountDue,
          netAmount: amountDue,
          processingFee: method === 'card' ? cardFee : 0,
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

  // PDF Download handler
  const handleDownloadPdf = async () => {
    if (!documentRef.current || generatingPdf) return
    setGeneratingPdf(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      // Hide no-print elements during capture
      const noPrintEls = documentRef.current.querySelectorAll('.no-print')
      noPrintEls.forEach(el => (el as HTMLElement).style.display = 'none')

      // Convert cross-origin images to base64 before capture
      const images = documentRef.current.querySelectorAll('img')
      const originalSrcs: { el: HTMLImageElement; src: string }[] = []
      await Promise.all(Array.from(images).map(async (img) => {
        try {
          if (img.src && !img.src.startsWith('data:')) {
            originalSrcs.push({ el: img, src: img.src })
            const response = await fetch(img.src)
            const blob = await response.blob()
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.readAsDataURL(blob)
            })
            img.src = dataUrl
          }
        } catch (e) {
          console.warn('Could not convert image to base64:', img.src, e)
        }
      }))

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8f9fa',
        logging: false
      })

      // Restore original image srcs
      originalSrcs.forEach(({ el, src }) => { el.src = src })

      // Restore no-print elements
      noPrintEls.forEach(el => (el as HTMLElement).style.display = '')

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const imgWidth = canvas.width
      const imgHeight = canvas.height

      // A4 proportions
      const pdfWidth = 595.28
      const pdfPageHeight = 841.89
      const ratio = pdfWidth / imgWidth
      const scaledHeight = imgHeight * ratio

      const pdf = new jsPDF('p', 'pt', 'a4')
      let position = 0
      let remainingHeight = scaledHeight

      // First page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight)
      remainingHeight -= pdfPageHeight

      // Additional pages if needed
      while (remainingHeight > 0) {
        position -= pdfPageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight)
        remainingHeight -= pdfPageHeight
      }

      const docLabel = isQuote ? 'Quote' : 'Invoice'
      pdf.save(`${docLabel}_${doc.doc_number}_${doc.customer_name.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      window.print()
    }
    setGeneratingPdf(false)
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div style={{ 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#f8f9fa',
      minHeight: '100vh',
      color: '#1a1a1a'
    }}>
      {/* Print + Mobile Responsive Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          div[style*="box-shadow"] { box-shadow: none !important; }
        }
        @media (max-width: 768px) {
          .header-inner { padding: 20px 16px !important; }
          .header-logo svg { width: 160px !important; }
          .header-top-row { flex-direction: column !important; gap: 16px !important; }
          .header-badge-group { align-self: flex-start !important; }
          .header-accent { display: none !important; }
          .header-info-grid { 
            grid-template-columns: 1fr !important; 
            max-width: 100% !important; 
            gap: 20px !important; 
          }
          .header-status-pill {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            transform: none !important;
            text-align: left !important;
            margin-top: 4px !important;
          }
          .header-status-pill > div:first-child {
            color: #6b7280 !important;
            font-size: 11px !important;
            letter-spacing: 0.5px !important;
            margin-bottom: 8px !important;
          }
          .header-status-badge {
            padding: 8px 20px !important;
            font-size: 16px !important;
          }
          .main-container { padding: 12px !important; }
        }
      `}} />
      {/* Main Container */}
      <div ref={documentRef} className="main-container" style={{ maxWidth: '1125px', margin: '0 auto', padding: '24px' }}>
        
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
          <div className="header-accent" style={{
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '60%',
            height: '200%',
            background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
            borderRadius: '50%',
            zIndex: 0
          }} />
          
          <div className="header-inner" style={{ position: 'relative', zIndex: 1, padding: '32px 40px' }}>
            {/* Top row: Logo + Badge */}
            <div className="header-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div className="header-logo" style={{ display: 'flex', alignItems: 'center' }}>
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
              
              <div className="header-badge-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="no-print"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '20px',
                    color: '#6b7280',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: generatingPdf ? 'wait' : 'pointer',
                    opacity: generatingPdf ? 0.6 : 1,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!generatingPdf) { e.currentTarget.style.borderColor = '#be1e2d'; e.currentTarget.style.color = '#be1e2d'; }}}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {generatingPdf ? 'Generating...' : 'Save PDF'}
                </button>
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
            </div>
            
            {/* Info Grid */}
            <div className="header-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', maxWidth: '55%' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Bill To</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>{doc.customer_name}</div>
                {doc.company_name && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.company_name}</div>}
                {doc.customer_email && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.customer_email}</div>}
                {doc.customer_phone && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.customer_phone}</div>}
              </div>
              
              <div style={{ maxWidth: '300px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Project</div>
                {doc.vehicle_description && <div style={{ fontSize: '14px', color: '#1a1a1a', marginBottom: '4px' }}>{doc.vehicle_description}</div>}
                {doc.project_description && <div style={{ fontSize: '14px', color: '#6b7280' }}>{doc.project_description}</div>}
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>Created: {formatDate(doc.created_at)}</div>
              </div>
              
              {/* Status pill */}
              <div className="header-status-pill" style={{ 
                position: 'absolute',
                top: '60%',
                right: '12%',
                transform: 'translateY(-50%)',
                textAlign: 'center',
                zIndex: 2
              }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Status</div>
                <div className="header-status-badge" style={{
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

        {/* ================================================================ */}
        {/* OPTIONS MODE VIEW */}
        {/* ================================================================ */}
        {isOptionsMode && status !== 'option_selected' && (
          <>
            {/* Options Selection */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '28px 32px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px 0' }}>
                Choose Your Option
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0' }}>
                Review the options below and select the one that works best for you.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {options.map((opt) => {
                  const images = getOptionImages(opt)
                  const heroIdx = optionHeroIndexes[opt.id] || 0
                  const isSelected = selectedOption === opt.id

                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedOption(opt.id)}
                      style={{
                        borderRadius: '14px',
                        border: isSelected ? '3px solid #be1e2d' : '2px solid #e5e7eb',
                        background: isSelected ? 'rgba(190,30,45,0.02)' : '#ffffff',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 4px 20px rgba(190,30,45,0.12)' : '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                      {/* Image Gallery */}
                      {images.length > 0 && (
                        <div style={{ position: 'relative', background: '#f1f5f9' }}>
                          {/* Hero Image */}
                          <div 
                            style={{ 
                              width: '100%', 
                              paddingBottom: '56.25%', 
                              position: 'relative',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setOptLightbox({ optionId: opt.id, index: heroIdx })
                            }}
                          >
                            <img
                              src={images[heroIdx]?.url}
                              alt={images[heroIdx]?.name || opt.title}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                            {/* Click to enlarge hint */}
                            <div style={{
                              position: 'absolute',
                              bottom: '12px',
                              right: '12px',
                              background: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              pointerEvents: 'none'
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                              </svg>
                              Click to enlarge
                            </div>
                            {/* Image count badge */}
                            {images.length > 1 && (
                              <div style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}>
                                {heroIdx + 1} / {images.length}
                              </div>
                            )}
                          </div>

                          {/* Thumbnail Strip */}
                          {images.length > 1 && (
                            <div style={{ 
                              display: 'flex', 
                              gap: '6px', 
                              padding: '10px 16px',
                              overflowX: 'auto',
                              background: '#ffffff'
                            }}>
                              {images.map((img, idx) => (
                                <div
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOptionHeroIndexes(prev => ({ ...prev, [opt.id]: idx }))
                                  }}
                                  style={{
                                    width: '64px',
                                    height: '48px',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                    border: heroIdx === idx ? '2px solid #be1e2d' : '2px solid transparent',
                                    opacity: heroIdx === idx ? 1 : 0.6,
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <img
                                    src={img.url}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Option Details */}
                      <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                              {/* Selection indicator */}
                              <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                border: isSelected ? 'none' : '2px solid #d1d5db',
                                background: isSelected ? 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all 0.2s ease'
                              }}>
                                {isSelected && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                )}
                              </div>
                              <div style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>{opt.title}</div>
                            </div>
                            {opt.description && (
                              <div style={{ fontSize: '14px', color: '#6b7280', marginLeft: '34px', lineHeight: '1.5' }}>{opt.description}</div>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '22px', 
                            fontWeight: 700, 
                            color: '#be1e2d',
                            whiteSpace: 'nowrap',
                            paddingTop: '2px'
                          }}>
                            {opt.price_max 
                              ? `${formatCurrency(opt.price_min)} - ${formatCurrency(opt.price_max)}`
                              : formatCurrency(opt.price_min)
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Selection Submit Section */}
            {selectedOption && (
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '28px 32px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                marginBottom: '24px'
              }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px 0' }}>
                  Anything You'd Like to Change?
                </h2>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px 0' }}>
                  Optional - describe any revisions you'd like made to your selected option.
                </p>

                <textarea
                  value={optionRevisionText}
                  onChange={(e) => setOptionRevisionText(e.target.value)}
                  placeholder="e.g. Could we change the color from blue to black? Or adjust the logo placement..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    marginBottom: '20px',
                    fontFamily: 'inherit'
                  }}
                />

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1a1a1a', marginBottom: '10px' }}>
                    Preferred way to discuss any further revisions
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
                          borderRadius: '10px',
                          border: optionContactPref === pref ? '2px solid #be1e2d' : '1px solid #e5e7eb',
                          background: optionContactPref === pref ? 'rgba(190,30,45,0.05)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="optionContactPref"
                          value={pref}
                          checked={optionContactPref === pref}
                          onChange={() => setOptionContactPref(pref)}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                          {pref === 'sms' ? 'Text / SMS' : 'Email'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSubmitOption}
                  disabled={submittingOption}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(190,30,45,0.3)'; }}}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: submittingOption ? 'not-allowed' : 'pointer',
                    opacity: submittingOption ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {submittingOption ? 'Submitting...' : `Submit Selection - ${options.find(o => o.id === selectedOption)?.title}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* OPTIONS MODE - POST SELECTION CONFIRMATION */}
        {/* ================================================================ */}
        {isOptionsMode && status === 'option_selected' && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '40px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              marginBottom: '20px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px 0' }}>
              Selection Submitted
            </h2>
            <p style={{ color: '#6b7280', fontSize: '15px', margin: '0 0 24px 0', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.6' }}>
              Thank you for choosing your option! We'll review your selection and be in touch shortly to finalize the details.
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/documents/undo-approval', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ documentId: doc.id })
                  })
                  const data = await res.json()
                  if (data.success) {
                    window.location.reload()
                  } else {
                    alert('Failed to undo selection. Please try again.')
                  }
                } catch (err) {
                  console.error('Undo error:', err)
                  alert('Failed to undo selection. Please try again.')
                }
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#be1e2d'; e.currentTarget.style.borderColor = '#be1e2d'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
              style={{
                padding: '10px 20px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Changed my mind? Undo Selection
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* STANDARD (NON-OPTIONS) SECTIONS BELOW */}
        {/* ================================================================ */}

        {/* ================================================================ */}
        {/* PROJECT ATTACHMENTS (when included via send options) */}
        {/* ================================================================ */}
        {showProjectAttachments && !isOptionsMode && (() => {
          const projAtts = doc.attachments || []
          if (projAtts.length === 0) return null
          const projImages = projAtts.filter(att => {
            const url = att.url || att.file_url || ''
            const name = att.name || att.filename || att.file_name || ''
            return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
          })
          const projFiles = projAtts.filter(att => {
            const url = att.url || att.file_url || ''
            const name = att.name || att.filename || att.file_name || ''
            return !/\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
          })
          return (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px 32px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Project Files
              </h2>
              {/* Project images */}
              {projImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: projFiles.length > 0 ? '20px' : '0' }}>
                  {projImages.map((att, idx) => {
                    const url = att.url || att.file_url || ''
                    const name = att.name || att.filename || att.file_name || 'Project File'
                    return (
                      <div
                        key={idx}
                        onClick={() => setLightboxIndex(idx)}
                        style={{
                          position: 'relative',
                          paddingBottom: '75%',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          background: '#f1f5f9'
                        }}
                      >
                        <img
                          src={url}
                          alt={name}
                          style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            objectFit: 'cover', transition: 'transform 0.3s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        />
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                          color: 'white', fontSize: '12px', fontWeight: 500
                        }}>
                          {name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Project non-image files */}
              {projFiles.map((att, idx) => {
                const fileName = att.name || att.filename || att.file_name || 'File'
                const fileUrl = att.url || att.file_url || ''
                return (
                  <a
                    key={idx}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '10px', border: '1px solid #e5e7eb',
                      textDecoration: 'none', color: '#1a1a1a',
                      marginBottom: idx < projFiles.length - 1 ? '8px' : '0',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{fileName}</span>
                  </a>
                )
              })}
            </div>
          )
        })()}

        {/* ================================================================ */}
        {/* GROUPED LINE ITEMS WITH INLINE ATTACHMENTS (non-options mode) */}
        {/* ================================================================ */}
        {!isOptionsMode && lineItems.length > 0 && (() => {
          // Build groups from line items
          const groupOrder: string[] = []
          const groupMap: Record<string, LineItem[]> = {}
          lineItems.forEach(item => {
            const gid = item.group_id || '_ungrouped'
            if (!groupMap[gid]) {
              groupMap[gid] = []
              groupOrder.push(gid)
            }
            groupMap[gid].push(item)
          })

          return (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px 32px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
                {isQuote ? 'Quote Details' : 'Invoice Details'}
              </h2>

              {groupOrder.map((gid, groupIdx) => {
                const items = groupMap[gid]
                // Use category from first item for group header
                const groupCategory = items[0]?.category
                const showGroupHeader = groupOrder.length > 1 && groupCategory

                return (
                  <div key={gid} style={{ marginBottom: groupIdx < groupOrder.length - 1 ? '24px' : '0' }}>
                    {/* Group Header */}
                    {showGroupHeader && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', marginBottom: '12px',
                        background: '#f8f9fa', borderRadius: '10px', borderLeft: '4px solid #be1e2d'
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {formatCategory(groupCategory)}
                        </span>
                      </div>
                    )}

                    {/* Items in this group */}
                    {items.map((item, itemIdx) => {
                      // Get image attachments for this line item
                      const itemImages = showLineAttachments ? (item.attachments || []).filter(att => {
                        const url = att.url || att.file_url || ''
                        const name = att.name || att.filename || att.file_name || ''
                        return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
                      }).map(att => ({
                        url: att.url || att.file_url || '',
                        name: att.name || att.filename || att.file_name || 'Design'
                      })) : []

                      // Get non-image files for this line item
                      const itemFiles = showLineAttachments ? (item.attachments || []).filter(att => {
                        const url = att.url || att.file_url || ''
                        const name = att.name || att.filename || att.file_name || ''
                        return !/\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
                      }) : []

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '16px 0',
                            borderBottom: itemIdx < items.length - 1 ? '1px solid #f1f5f9' : 'none'
                          }}
                        >
                          {/* Line item row */}
                          {(() => {
                            const cf = item.custom_fields || {}
                            const isApparelItem = cf.apparel_mode === true
                            const enabledSizes = (cf.enabled_sizes || []) as string[]
                            const sizes = (cf.sizes || {}) as Record<string, { qty: number; price: number }>

                            if (isApparelItem && enabledSizes.length > 0) {
                              return (
                                <div>
                                  {/* Apparel item header */}
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                      width: '8px', height: '8px', borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                                      marginTop: '6px', flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                                        {item.description || 'Line Item'}
                                        {cf.color && <span style={{ color: '#6b7280', fontWeight: 400 }}> — {cf.color}</span>}
                                      </div>
                                      {cf.item_number && (
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Item #{cf.item_number}</div>
                                      )}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{formatCurrency(item.line_total)}</div>
                                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.quantity} pcs total</div>
                                    </div>
                                  </div>

                                  {/* Size breakdown grid */}
                                  <div style={{ marginTop: '10px', marginLeft: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {enabledSizes.map(size => {
                                      const s = sizes[size] || { qty: 0, price: 0 }
                                      if (s.qty <= 0) return null
                                      return (
                                        <div key={size} style={{
                                          display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                          padding: '8px 15px', background: '#f8f9fa', borderRadius: '8px',
                                          border: '1px solid #e5e7eb', minWidth: '75px'
                                        }}>
                                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#be1e2d', textTransform: 'uppercase' }}>{size}</div>
                                          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginTop: '3px' }}>{s.qty}</div>
                                          <div style={{ fontSize: '14px', color: '#6b7280' }}>{formatCurrency(s.price)} ea</div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            }

                            // Standard line item display
                            return (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{
                                  width: '8px', height: '8px', borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                                  marginTop: '6px', flexShrink: 0
                                }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{item.description || 'Line Item'}</div>
                                  {!showGroupHeader && item.category && (
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{formatCategory(item.category)}</div>
                                  )}
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{formatCurrency(item.line_total)}</div>
                                  {item.quantity > 1 && (
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.quantity} x {formatCurrency(item.rate || item.unit_price)}</div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}

                          {/* Inline image gallery for this line item */}
                          {itemImages.length > 0 && (() => {
                            const cf = item.custom_fields || {}
                            const isEmbroideryOrApparel = item.category === 'EMBROIDERY' || cf.apparel_mode === true

                            // For Embroidery & Apparel: show all images side-by-side in grid
                            if (isEmbroideryOrApparel) {
                              return (
                                <div style={{
                                  marginTop: '24px',
                                  display: 'grid',
                                  gridTemplateColumns: itemImages.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                                  gap: '12px'
                                }}>
                                  {itemImages.map((img, imgIdx) => {
                                    // Extract location from filename (format: mockup_Location_...)
                                    let location = ''
                                    const filenameParts = img.name.split('_')
                                    if (filenameParts[0] === 'mockup' && filenameParts.length > 1) {
                                      location = filenameParts[1] // "Front", "Back", "Sleeves"
                                    }

                                    return (
                                      <div key={imgIdx}>
                                        {/* Location Label */}
                                        {location && (
                                          <div style={{
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: '#1a1a1a',
                                            marginBottom: '8px',
                                            textTransform: 'capitalize'
                                          }}>
                                            {location}
                                          </div>
                                        )}

                                        {/* Image */}
                                        <div
                                          onClick={() => {
                                            const flatIndex = galleryImages.findIndex(g => g.url === img.url)
                                            if (flatIndex >= 0) setLightboxIndex(flatIndex)
                                          }}
                                          style={{
                                            position: 'relative',
                                            width: '100%',
                                            paddingBottom: '75%',
                                            borderRadius: '10px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            background: '#f1f5f9'
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
                                              objectFit: 'contain',
                                              transition: 'transform 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                          />
                                          {/* Enlarge hint */}
                                          <div style={{
                                            position: 'absolute', bottom: '10px', right: '10px',
                                            background: 'rgba(0,0,0,0.6)', color: 'white',
                                            padding: '5px 10px', borderRadius: '6px',
                                            fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
                                            pointerEvents: 'none'
                                          }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                            </svg>
                                            Click to enlarge
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            }

                            // For other items: show hero image carousel
                            const heroIdx = itemHeroIndexes[item.id] || 0
                            return (
                              <div style={{ marginTop: '12px' }}>
                                {/* Hero Image - full width */}
                                <div
                                  onClick={() => {
                                    const flatIndex = galleryImages.findIndex(g => g.url === itemImages[heroIdx]?.url)
                                    if (flatIndex >= 0) setLightboxIndex(flatIndex)
                                  }}
                                  style={{
                                    position: 'relative',
                                    width: '100%',
                                    paddingBottom: '56.25%',
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    background: '#f1f5f9'
                                  }}
                                >
                                  <img
                                    src={itemImages[heroIdx]?.url}
                                    alt={itemImages[heroIdx]?.name}
                                    style={{
                                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                      objectFit: 'contain', transition: 'transform 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  />
                                  {/* Enlarge hint */}
                                  <div style={{
                                    position: 'absolute', bottom: '10px', right: '10px',
                                    background: 'rgba(0,0,0,0.6)', color: 'white',
                                    padding: '5px 10px', borderRadius: '6px',
                                    fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
                                    pointerEvents: 'none'
                                  }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                    </svg>
                                    Click to enlarge
                                  </div>
                                  {/* Image count badge */}
                                  {itemImages.length > 1 && (
                                    <div style={{
                                      position: 'absolute', top: '10px', right: '10px',
                                      background: 'rgba(0,0,0,0.6)', color: 'white',
                                      padding: '4px 10px', borderRadius: '12px',
                                      fontSize: '12px', fontWeight: 500
                                    }}>
                                      {heroIdx + 1} / {itemImages.length}
                                    </div>
                                  )}
                                </div>

                                {/* Thumbnail strip */}
                                {itemImages.length > 1 && (
                                  <div style={{
                                    display: 'flex',
                                    gap: '6px',
                                    marginTop: '8px',
                                    overflowX: 'auto'
                                  }}>
                                    {itemImages.map((img, imgIdx) => (
                                      <div
                                        key={imgIdx}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setItemHeroIndexes(prev => ({ ...prev, [item.id]: imgIdx }))
                                        }}
                                        style={{
                                          width: '64px',
                                          height: '48px',
                                          borderRadius: '6px',
                                          overflow: 'hidden',
                                          flexShrink: 0,
                                          cursor: 'pointer',
                                          border: heroIdx === imgIdx ? '2px solid #be1e2d' : '2px solid transparent',
                                          opacity: heroIdx === imgIdx ? 1 : 0.6,
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        <img
                                          src={img.url}
                                          alt=""
                                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Non-image file downloads for this line item */}
                          {itemFiles.length > 0 && (
                            <div style={{ marginTop: '10px', marginLeft: '20px' }}>
                              {itemFiles.map((att, fIdx) => {
                                const fileName = att.name || att.filename || att.file_name || 'File'
                                const fileUrl = att.url || att.file_url || ''
                                return (
                                  <a
                                    key={fIdx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                                      padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb',
                                      textDecoration: 'none', color: '#6b7280', fontSize: '12px',
                                      marginRight: '6px', marginBottom: '4px', transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                      <polyline points="7 10 12 15 17 10"/>
                                      <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    {fileName}
                                  </a>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Group subtotal when multiple groups */}
                    {showGroupHeader && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '8px 14px', marginTop: '8px',
                        background: '#f8f9fa', borderRadius: '8px'
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Section Subtotal</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                          {formatCurrency(items.reduce((sum, i) => sum + (i.line_total || 0), 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Totals */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ color: '#1a1a1a' }}>{formatCurrency(subtotal)}</span>
                </div>
                
                {fees.length > 0 && fees.map((fee, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280' }}>{fee.description}</span>
                    <span style={{ color: '#1a1a1a' }}>{formatCurrency(fee.amount)}</span>
                  </div>
                ))}
                
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
                
                {actualAmountPaid > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ color: '#22c55e' }}>Amount Paid</span>
                      <span style={{ color: '#22c55e' }}>-{formatCurrency(actualAmountPaid)}</span>
                    </div>
                    {payments.filter(p => (parseFloat(String(p.processing_fee)) || 0) > 0 && p.payment_method === 'card').map(p => {
                      const amt = parseFloat(String(p.amount)) || 0
                      const rawFee = parseFloat(String(p.processing_fee)) || 0
                      // If fee is bugged (equals or exceeds amount), calculate the actual fee
                      const actualFee = (rawFee >= amt) ? Math.round((amt - (amt - 0.30) / 1.029) * 100) / 100 : rawFee
                      return (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ color: '#6b7280', fontSize: '12px' }}>+ {formatCurrency(actualFee)} credit card processing fee applied at checkout</span>
                        </div>
                      )
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>Balance Due</span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(balanceDue)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })()}

        {/* Quote Approval Section (non-options mode only) */}
        {canApprove && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
              Review & Approve
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
              Please review the details above. If everything looks good, approve the quote to proceed. Need changes? Let us know!
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleApprove}
                disabled={approving}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(190,30,45,0.3)'; }}}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  flex: 1,
                  padding: '16px 24px',
                  background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: approving ? 'not-allowed' : 'pointer',
                  opacity: approving ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {approving ? 'Approving...' : 'Approve Quote'}
              </button>
              <button
                onClick={() => setShowRevisionModal(true)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#be1e2d'; e.currentTarget.style.color = '#be1e2d'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.transform = 'translateY(0)'; }}
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
          </div>
        )}

        {/* Undo Approval Section (non-options mode) */}
        {isQuote && !isOptionsMode && status === 'approved' && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 16px', 
              background: 'rgba(34, 197, 94, 0.1)', 
              borderRadius: '20px',
              marginBottom: '16px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>Quote Approved</span>
            </div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              Thank you for approving! We'll be in touch shortly to schedule your project.
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/documents/undo-approval', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ documentId: doc.id })
                  })
                  const data = await res.json()
                  if (data.success) {
                    window.location.reload()
                  } else {
                    alert('Failed to undo approval. Please try again.')
                  }
                } catch (err) {
                  console.error('Undo error:', err)
                  alert('Failed to undo approval. Please try again.')
                }
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#be1e2d'; e.currentTarget.style.borderColor = '#be1e2d'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
              style={{
                padding: '10px 20px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Changed my mind? Undo Approval
            </button>
          </div>
        )}

        {/* Payment Options */}
        {canPay && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 20px 0' }}>
              Payment Options
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bank Transfer */}
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
                  background: 'linear-gradient(135deg, #be1e2d 0%, #b60718 100%)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
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
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>{formatCurrency(amountDue)}</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{depositRequired > 0 && depositRequired < total && actualAmountPaid < depositRequired ? '50% deposit · No processing fee' : 'No processing fee'}</div>
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
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{depositRequired > 0 && depositRequired < total && actualAmountPaid < depositRequired ? '50% deposit · Includes 2.9% + $0.30 processing fee' : 'Includes 2.9% + $0.30 processing fee'}</div>
              </div>
            </div>
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
              (240) 693-3715
            </a>
            <a 
              href="mailto:info@frederickwraps.com"
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
              info@frederickwraps.com
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
            Frederick Wraps & Graphics | 4509 Metropolitan Ct Ste A, Frederick, MD 21704
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
            <a href="https://frederickwraps.com" style={{ color: '#be1e2d', fontSize: '13px', textDecoration: 'none' }}>Website</a>
            <a href="tel:+12407705424" style={{ color: '#be1e2d', fontSize: '13px', textDecoration: 'none' }}>Call Us</a>
            <a href="mailto:info@frederickwraps.com" style={{ color: '#be1e2d', fontSize: '13px', textDecoration: 'none' }}>Email</a>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* REVISION MODAL (non-options mode) */}
      {/* ================================================================ */}
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
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
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

      {/* ================================================================ */}
      {/* STANDARD LIGHTBOX (with zoom, pan, nav) */}
      {/* ================================================================ */}
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
        }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleLightboxClose()
          }}
        >
          {/* Top bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            flexShrink: 0
          }}>
            <span style={{ color: 'white', fontSize: '14px' }}>
              {lightboxIndex + 1} / {galleryImages.length}
              {lightboxZoom > 1 && ` • ${lightboxZoom}x zoom`}
            </span>
            <button
              onClick={handleLightboxClose}
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

          {/* Image area */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleLightboxClose()
            }}
          >
            {/* Nav prev */}
            {galleryImages.length > 1 && (
              <button
                onClick={() => handleLightboxNav('prev')}
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
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}

            {/* Image with zoom/pan */}
            <div
              onDoubleClick={handleLightboxDoubleClick}
              onMouseDown={handleLightboxMouseDown}
              onMouseMove={handleLightboxMouseMove}
              onMouseUp={handleLightboxMouseUp}
              onMouseLeave={handleLightboxMouseUp}
              onClick={(e) => e.stopPropagation()}
              style={{
                cursor: lightboxZoom > 1 ? (isLightboxDragging ? 'grabbing' : 'grab') : 'zoom-in',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={galleryImages[lightboxIndex].url}
                alt=""
                draggable={false}
                style={{
                  maxWidth: lightboxZoom === 1 ? '90vw' : 'none',
                  maxHeight: lightboxZoom === 1 ? '80vh' : 'none',
                  transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                  transition: isLightboxDragging ? 'none' : 'transform 0.2s ease-out',
                  borderRadius: '4px'
                }}
              />
            </div>

            {/* Nav next */}
            {galleryImages.length > 1 && (
              <button
                onClick={() => handleLightboxNav('next')}
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
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )}
          </div>

          {/* Hint text at bottom */}
          <div style={{
            textAlign: 'center',
            padding: '12px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            flexShrink: 0
          }}>
            Double-click to zoom
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* OPTIONS LIGHTBOX (with zoom, pan, nav, click-outside-to-close) */}
      {/* ================================================================ */}
      {optLightbox && (() => {
        const opt = options.find(o => o.id === optLightbox.optionId)
        if (!opt) return null
        const images = getOptionImages(opt)
        if (!images.length) return null
        const currentUrl = images[optLightbox.index]?.url

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 3000,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Top bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              flexShrink: 0
            }}>
              <span style={{ color: 'white', fontSize: '14px' }}>
                {optLightbox.index + 1} / {images.length} &mdash; {opt.title}
              </span>
              <button
                onClick={handleOptLightboxClose}
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

            {/* Image area - click backdrop to close */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) handleOptLightboxClose()
              }}
            >
              {/* Nav prev */}
              {images.length > 1 && (
                <button
                  onClick={() => handleOptLightboxNav('prev')}
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
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
              )}

              {/* Image with zoom/pan */}
              <div
                onDoubleClick={handleOptLightboxDoubleClick}
                onMouseDown={handleOptMouseDown}
                onMouseMove={handleOptMouseMove}
                onMouseUp={handleOptMouseUp}
                onMouseLeave={handleOptMouseUp}
                onClick={(e) => e.stopPropagation()}
                style={{
                  cursor: optLightboxZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={currentUrl}
                  alt=""
                  draggable={false}
                  style={{
                    maxWidth: optLightboxZoom === 1 ? '90vw' : 'none',
                    maxHeight: optLightboxZoom === 1 ? '80vh' : 'none',
                    transform: `translate(${optLightboxPan.x}px, ${optLightboxPan.y}px) scale(${optLightboxZoom})`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                    borderRadius: '4px'
                  }}
                />
              </div>

              {/* Nav next */}
              {images.length > 1 && (
                <button
                  onClick={() => handleOptLightboxNav('next')}
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
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Thumbnail strip + actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '16px 24px',
              gap: '20px',
              flexShrink: 0
            }}>
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setOptLightbox({ ...optLightbox, index: idx })
                        setOptLightboxZoom(1)
                        setOptLightboxPan({ x: 0, y: 0 })
                      }}
                      style={{
                        width: '48px',
                        height: '36px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: optLightbox.index === idx ? '2px solid #be1e2d' : '2px solid rgba(255,255,255,0.2)',
                        opacity: optLightbox.index === idx ? 1 : 0.5,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#be1e2d', textDecoration: 'none', fontSize: '13px' }}>Open in New Tab</a>
            </div>
          </div>
        )
      })()}
    </div>
  )
}