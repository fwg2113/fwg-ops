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
  decoration_type?: string; decoration_locations?: any; stitch_count?: string
}

type PricingMatrix = {
  id: string
  name: string
  decoration_type: string
  applies_to: string[]
  quantity_breaks: {
    min: number
    max: number
    markup_pct: number
    decoration_prices: Record<string, number>
  }[]
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
  pricingMatrices?: PricingMatrix[]
}

// ============================================================================
// HELPER: Count design locations from an item's mockup_config or attachments
// ============================================================================
function countItemDesignLocations(item: LineItem): number {
  const cf = item.custom_fields || {}
  const mc = cf.mockup_config
  if (mc) {
    const locs = new Set<string>()
    if (Array.isArray(mc.logos)) mc.logos.forEach((l: any) => { if (l.location) locs.add(l.location) })
    if (Array.isArray(mc.textElements)) mc.textElements.forEach((t: any) => { if (t.location) locs.add(t.location) })
    if (locs.size > 0) return locs.size
  }
  // Fallback: count from mockup attachments
  const atts = item.attachments || []
  const mockupLocs = new Set<string>()
  atts.forEach(att => {
    const name = att.name || att.filename || att.file_name || ''
    if (name.startsWith('mockup_')) {
      const parts = name.split('_')
      if (parts[1]) mockupLocs.add(parts[1])
    }
  })
  return mockupLocs.size || 1
}

// ============================================================================
// HELPER: Build qty tier pricing table for an apparel item
// ============================================================================
function buildTierPricing(
  item: LineItem,
  matrices: PricingMatrix[]
): { label: string; pricePerPiece: number }[] | null {
  const cf = item.custom_fields || {}
  if (!cf.apparel_mode) return null

  // Get the average wholesale cost from sizes
  const sizes = (cf.sizes || {}) as Record<string, { qty: number; price: number; wholesale: number }>
  const sizeEntries = Object.values(sizes)
  if (sizeEntries.length === 0) return null
  const wholesalePrices = sizeEntries.map(s => s.wholesale || 0).filter(w => w > 0)
  if (wholesalePrices.length === 0) return null
  const avgWholesale = wholesalePrices.reduce((a, b) => a + b, 0) / wholesalePrices.length

  // Find applicable pricing matrix
  const isEmbroidery = item.category === 'EMBROIDERY' || item.decoration_type === 'embroidery'
  const decType = isEmbroidery ? 'embroidery' : 'dtf'
  const matrix = matrices.find(m => m.decoration_type === decType)
  if (!matrix || !matrix.quantity_breaks || matrix.quantity_breaks.length === 0) return null

  // Calculate decoration fee per unit
  const designLocations = countItemDesignLocations(item)
  const designFee = cf.design_fee_per_location ?? 5.00
  const pressFee = cf.press_fee_per_location ?? 2.25
  const manualOverride = cf.manual_price_override || false

  const sortedBreaks = [...matrix.quantity_breaks].sort((a, b) => a.min - b.min)

  return sortedBreaks.map(tier => {
    const markupMultiplier = tier.markup_pct / 100
    const garmentPrice = avgWholesale * markupMultiplier

    let decorationFee = 0
    if (!manualOverride) {
      if (isEmbroidery) {
        // Embroidery: use stitch count pricing from tier
        const stitchTier = item.stitch_count || cf.stitch_count || 'up_to_10k'
        const stitchKey = stitchTier === '10k_to_20k' || stitchTier === '20k_plus' ? '10k_to_20k' : 'up_to_10k'
        decorationFee = (tier.decoration_prices[stitchKey] || 0) * designLocations
      } else {
        // DTF: use per-location fees from item
        decorationFee = designLocations * (designFee + pressFee)
      }
    }

    const pricePerPiece = garmentPrice + decorationFee

    // Format label
    const label = tier.max >= 99999
      ? `${tier.min}+`
      : tier.min === tier.max
        ? `${tier.min}`
        : `${tier.min}-${tier.max}`

    return { label, pricePerPiece }
  })
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
export default function CustomerDocumentView({ document: doc, lineItems, payments = [], pricingMatrices = [] }: Props) {
  const [approving, setApproving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 })
  const [revisionMessage, setRevisionMessage] = useState('')
  const [contactPreference, setContactPreference] = useState<'sms' | 'email'>('sms')
  const [submittingRevision, setSubmittingRevision] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [status, setStatus] = useState(doc.status)
  const [submittingOption, setSubmittingOption] = useState(false)

  // Per-option action state: which option is in approve or request-changes mode
  const [optionActionMode, setOptionActionMode] = useState<Record<string, 'approve' | 'request_changes' | null>>({})
  // Per-option size/qty entries: { optionId: { S: 5, M: 10, ... } }
  const [optionSizeQtys, setOptionSizeQtys] = useState<Record<string, Record<string, number>>>({})
  // Per-option revision text
  const [optionRevisionTexts, setOptionRevisionTexts] = useState<Record<string, string>>({})
  // Per-option contact preference
  const [optionContactPrefs, setOptionContactPrefs] = useState<Record<string, 'sms' | 'email'>>({})

  // Option hero image indexes (per option)
  const [optionHeroIndexes, setOptionHeroIndexes] = useState<Record<string, number>>({})
  // Line item hero image indexes
  const [itemHeroIndexes, setItemHeroIndexes] = useState<Record<string, number>>({})
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Ref for PDF capture
  const documentRef = useRef<HTMLDivElement>(null)

  // Customer-editable size quantities (per line item: { itemId: { S: 5, M: 10, ... } })
  const [customerSizeQtys, setCustomerSizeQtys] = useState<Record<string, Record<string, number>>>({})
  // Customer color selection (per line item: { itemId: 'Navy' })
  const [customerColors, setCustomerColors] = useState<Record<string, string>>({})
  // Supplier product data cache (per line item)
  const [supplierProducts, setSupplierProducts] = useState<Record<string, any>>({})
  const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({})
  // Canvas ref for mockup re-rendering
  const mockupCanvasRef = useRef<HTMLCanvasElement>(null)
  // Track which items have customer-edited quantities
  const [editedItems, setEditedItems] = useState<Set<string>>(new Set())

  // Option lightbox state
  const [optLightbox, setOptLightbox] = useState<{ optionId: string; index: number } | null>(null)
  const [optLightboxZoom, setOptLightboxZoom] = useState(1)
  const [optLightboxPan, setOptLightboxPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })

  // Standard lightbox zoom/pan state
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

  // Fetch supplier product data for apparel items (to get all available colors)
  useEffect(() => {
    const apparelItems = lineItems.filter(item => item.custom_fields?.apparel_mode === true && item.custom_fields?.style_id && item.custom_fields?.supplier)
    apparelItems.forEach(async (item) => {
      const cf = item.custom_fields!
      const styleId = cf.style_id
      const supplier = cf.supplier as string
      if (supplierProducts[item.id]) return // Already fetched

      setLoadingProducts(prev => ({ ...prev, [item.id]: true }))
      try {
        let url = ''
        if (supplier === 'sanmar') {
          url = `/api/suppliers/sanmar/product/${encodeURIComponent(cf.item_number || styleId)}`
        } else {
          url = `/api/suppliers/ss/style/${encodeURIComponent(styleId)}`
        }
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setSupplierProducts(prev => ({ ...prev, [item.id]: data.data }))
          }
        }
      } catch (err) {
        console.error('Failed to fetch supplier product for color picker:', err)
      }
      setLoadingProducts(prev => ({ ...prev, [item.id]: false }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems.length])

  // Initialize customer size quantities from existing line item data
  useEffect(() => {
    const initial: Record<string, Record<string, number>> = {}
    lineItems.forEach(item => {
      const cf = item.custom_fields || {}
      if (cf.apparel_mode && cf.sizes) {
        const sizes = cf.sizes as Record<string, { qty: number; price: number }>
        const sizeQtys: Record<string, number> = {}
        Object.entries(sizes).forEach(([sizeName, sizeData]) => {
          sizeQtys[sizeName] = sizeData.qty || 0
        })
        initial[item.id] = sizeQtys
      }
    })
    setCustomerSizeQtys(initial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Helper: generate mockup preview for a given garment image URL + mockup config
  const generateMockupPreview = useCallback(async (garmentImageUrl: string, mockupConfig: any, location: string): Promise<string | null> => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      canvas.width = 800
      canvas.height = 800

      // Load garment image through proxy to avoid CORS
      const garmentImg = new Image()
      garmentImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        garmentImg.onload = () => resolve()
        garmentImg.onerror = reject
        garmentImg.src = `/api/proxy-image?url=${encodeURIComponent(garmentImageUrl)}`
      })

      // Draw garment
      const scale = Math.min(canvas.width / garmentImg.width, canvas.height / garmentImg.height)
      const w = garmentImg.width * scale
      const h = garmentImg.height * scale
      const x = (canvas.width - w) / 2
      const y = (canvas.height - h) / 2
      ctx.drawImage(garmentImg, x, y, w, h)

      // Draw logos for this location
      if (mockupConfig?.logos) {
        const locationLogos = mockupConfig.logos.filter((l: any) => l.location === location)
        for (const logo of locationLogos) {
          try {
            const logoImg = new Image()
            logoImg.crossOrigin = 'anonymous'
            await new Promise<void>((resolve, reject) => {
              logoImg.onload = () => resolve()
              logoImg.onerror = reject
              logoImg.src = logo.url.startsWith('data:') ? logo.url : `/api/proxy-image?url=${encodeURIComponent(logo.url)}`
            })
            const lx = x + (logo.position?.x || 0) / 100 * w
            const ly = y + (logo.position?.y || 0) / 100 * h
            const lw = (logo.size?.width || 20) / 100 * w
            const lh = (logo.size?.height || 20) / 100 * h

            ctx.save()
            if (logo.rotation) {
              ctx.translate(lx + lw / 2, ly + lh / 2)
              ctx.rotate((logo.rotation * Math.PI) / 180)
              ctx.drawImage(logoImg, -lw / 2, -lh / 2, lw, lh)
            } else {
              ctx.drawImage(logoImg, lx, ly, lw, lh)
            }
            ctx.restore()
          } catch {
            // Skip logos that fail to load
          }
        }
      }

      // Draw text elements for this location
      if (mockupConfig?.textElements) {
        const locationTexts = mockupConfig.textElements.filter((t: any) => t.location === location)
        for (const te of locationTexts) {
          ctx.save()
          const tx = x + (te.position?.x || 0) / 100 * w
          const ty = y + (te.position?.y || 0) / 100 * h
          ctx.font = `${te.fontSize || 24}px ${te.fontFamily || 'Arial'}`
          ctx.fillStyle = te.color || '#000000'
          ctx.textAlign = 'center'
          if (te.rotation) {
            ctx.translate(tx, ty)
            ctx.rotate((te.rotation * Math.PI) / 180)
            ctx.fillText(te.text || '', 0, 0)
          } else {
            ctx.fillText(te.text || '', tx, ty)
          }
          ctx.restore()
        }
      }

      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }, [])

  // Parse fees
  const fees: Fee[] = (() => {
    try {
      return Array.isArray(doc.fees) ? doc.fees : JSON.parse(doc.fees || '[]')
    } catch { return [] }
  })()

  // Parse legacy options (flat options_json)
  const legacyOptions: QuoteOption[] = (() => {
    try {
      if (Array.isArray(doc.options_json)) return doc.options_json
      if (typeof doc.options_json === 'string') return JSON.parse(doc.options_json)
      return []
    } catch { return [] }
  })()

  // Build options from line item groups (new system: each group = one option)
  const groupOptions: { groupId: string; category: string; items: LineItem[]; total: number; title: string; description: string; images: { url: string; name: string }[] }[] = (() => {
    if (!doc.options_mode) return []
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
    return groupOrder.map((gid, idx) => {
      const items = groupMap[gid]
      const total = items.reduce((sum, i) => sum + (i.line_total || 0), 0)
      const category = items[0]?.category || ''
      const catLabel = category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      // Collect images from all line item attachments in this group
      const images = items.flatMap(item =>
        (item.attachments || []).filter(att => {
          const url = att.url || att.file_url || ''
          const name = att.name || att.filename || att.file_name || ''
          return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
        }).map(att => ({
          url: att.url || att.file_url || '',
          name: att.name || att.filename || att.file_name || 'Design'
        }))
      )
      return {
        groupId: gid,
        category,
        items,
        total,
        title: `Option ${idx + 1} — ${catLabel}`,
        description: items.map(i => i.description).filter(Boolean).join(', '),
        images
      }
    })
  })()

  // Use group-based options if available, fall back to legacy options_json
  const hasGroupOptions = groupOptions.length > 0
  const isOptionsMode = doc.options_mode === true && (hasGroupOptions || legacyOptions.length > 0)

  // Unified options array for handlers and lightbox (common shape)
  const options: (QuoteOption & { _images?: { url: string; name: string }[]; _items?: LineItem[] })[] = hasGroupOptions
    ? groupOptions.map(grp => ({
        id: grp.groupId,
        title: grp.title,
        description: grp.description,
        price_min: grp.total,
        attachments: [],
        sort_order: 0,
        _images: grp.images,
        _items: grp.items
      }))
    : legacyOptions

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
    const opt = options.find(o => o.id === optLightbox.optionId)
    if (!opt) return
    const images = opt._images || getOptionImages(opt)
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

  // Keyboard nav for option lightbox
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
      // Build line item updates from customer edits (quantities and colors)
      const lineItemUpdates: Record<string, { sizes?: Record<string, number>; color?: string }> = {}
      for (const item of lineItems) {
        const cf = item.custom_fields || {}
        if (!cf.apparel_mode) continue
        const updates: { sizes?: Record<string, number>; color?: string } = {}
        if (customerSizeQtys[item.id] && editedItems.has(item.id)) {
          updates.sizes = customerSizeQtys[item.id]
        }
        if (customerColors[item.id] && customerColors[item.id] !== cf.color) {
          updates.color = customerColors[item.id]
        }
        if (updates.sizes || updates.color) {
          lineItemUpdates[item.id] = updates
        }
      }

      const res = await fetch('/api/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          convertToInvoice: true,
          lineItemUpdates: Object.keys(lineItemUpdates).length > 0 ? lineItemUpdates : undefined
        })
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

  const handleOptionApprove = async (optionId: string) => {
    const opt = options.find(o => o.id === optionId)
    if (!opt) return

    setSubmittingOption(true)
    try {
      const sizeQtys = optionSizeQtys[optionId] || {}
      const hasQuantities = Object.values(sizeQtys).some(q => q > 0)

      // Build line item updates for this option's items
      const groupItems = (opt as any)._items || []
      const lineItemUpdates: Record<string, { sizes?: Record<string, number>; color?: string }> = {}
      for (const item of groupItems) {
        const cf = item.custom_fields || {}
        if (!cf.apparel_mode) continue
        const updates: { sizes?: Record<string, number>; color?: string } = {}
        if (customerSizeQtys[item.id] && editedItems.has(item.id)) {
          updates.sizes = customerSizeQtys[item.id]
        }
        if (customerColors[item.id] && customerColors[item.id] !== cf.color) {
          updates.color = customerColors[item.id]
        }
        if (updates.sizes || updates.color) {
          lineItemUpdates[item.id] = updates
        }
      }

      const res = await fetch('/api/documents/option-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          optionId,
          optionTitle: opt.title,
          customerName: doc.customer_name,
          contactPreference: optionContactPrefs[optionId] || 'sms',
          sizeQuantities: hasQuantities ? sizeQtys : null,
          lineItemUpdates: Object.keys(lineItemUpdates).length > 0 ? lineItemUpdates : undefined,
          action: 'approve'
        })
      })

      if (res.ok) {
        setStatus('option_selected')
      } else {
        alert('Failed to submit approval. Please try again.')
      }
    } catch (err) {
      console.error('Option approval error:', err)
      alert('Error submitting approval. Please try again.')
    }
    setSubmittingOption(false)
  }

  const handleOptionRequestChanges = async (optionId: string) => {
    const opt = options.find(o => o.id === optionId)
    if (!opt) return
    const revisionText = optionRevisionTexts[optionId]?.trim()
    if (!revisionText) return

    setSubmittingOption(true)
    try {
      const res = await fetch('/api/documents/option-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          optionId,
          optionTitle: opt.title,
          question: revisionText,
          customerName: doc.customer_name,
          contactPreference: optionContactPrefs[optionId] || 'sms',
          action: 'request_changes'
        })
      })

      if (res.ok) {
        setStatus('option_selected')
      } else {
        alert('Failed to submit request. Please try again.')
      }
    } catch (err) {
      console.error('Option revision error:', err)
      alert('Error submitting request. Please try again.')
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
        {isOptionsMode && status !== 'option_selected' && status !== 'revision_requested' && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px 0' }}>
              Your Options
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0' }}>
              Review each option below. Approve the one that works best, or request changes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Render group-based options (new system) or legacy flat options */}
              {(hasGroupOptions ? groupOptions.map(grp => ({
                id: grp.groupId,
                title: grp.title,
                description: grp.description,
                price_min: grp.total,
                price_max: undefined as number | undefined,
                attachments: [] as Attachment[],
                sort_order: 0,
                _images: grp.images,
                _items: grp.items
              })) : legacyOptions).map((opt: any) => {
                const images: { url: string; name: string }[] = opt._images || getOptionImages(opt)
                const heroIdx = optionHeroIndexes[opt.id] || 0
                const actionMode = optionActionMode[opt.id] || null
                const sizeQtys = optionSizeQtys[opt.id] || {}
                const revisionText = optionRevisionTexts[opt.id] || ''
                const contactPref = optionContactPrefs[opt.id] || 'sms'
                const groupItems: LineItem[] = opt._items || []
                const isGroupOption = groupItems.length > 0

                // For group-based options, derive sizes from line items
                const groupApparelItems = groupItems.filter((i: LineItem) => i.custom_fields?.apparel_mode === true)
                const hasApparelSizes = groupApparelItems.some((i: LineItem) => {
                  const cf = i.custom_fields || {}
                  return (cf.enabled_sizes || []).length > 0
                })

                // For legacy options, show generic size entry
                const availableSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
                const hasEnteredQtys = Object.values(sizeQtys).some(q => q > 0)
                const totalQty = Object.values(sizeQtys).reduce((sum: number, q: any) => sum + (q || 0), 0)

                return (
                  <div
                    key={opt.id}
                    style={{
                      borderRadius: '14px',
                      border: actionMode === 'approve' ? '3px solid #22c55e' : actionMode === 'request_changes' ? '3px solid #f59e0b' : '2px solid #e5e7eb',
                      background: '#ffffff',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      boxShadow: actionMode ? '0 4px 20px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Image Gallery */}
                    {images.length > 0 && (
                      <div style={{ position: 'relative', background: '#f1f5f9' }}>
                        <div
                          style={{
                            width: '100%',
                            paddingBottom: '56.25%',
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                          onClick={() => setOptLightbox({ optionId: opt.id, index: heroIdx })}
                        >
                          <img
                            src={images[heroIdx]?.url}
                            alt={images[heroIdx]?.name || opt.title}
                            style={{
                              position: 'absolute', top: 0, left: 0,
                              width: '100%', height: '100%', objectFit: 'cover'
                            }}
                          />
                          <div style={{
                            position: 'absolute', bottom: '12px', right: '12px',
                            background: 'rgba(0,0,0,0.6)', color: 'white',
                            padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
                            display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                            </svg>
                            Click to enlarge
                          </div>
                          {images.length > 1 && (
                            <div style={{
                              position: 'absolute', top: '12px', right: '12px',
                              background: 'rgba(0,0,0,0.6)', color: 'white',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500
                            }}>
                              {heroIdx + 1} / {images.length}
                            </div>
                          )}
                        </div>
                        {images.length > 1 && (
                          <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', overflowX: 'auto', background: '#ffffff' }}>
                            {images.map((img, idx) => (
                              <div
                                key={idx}
                                onClick={() => setOptionHeroIndexes(prev => ({ ...prev, [opt.id]: idx }))}
                                style={{
                                  width: '64px', height: '48px', borderRadius: '6px',
                                  overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                                  border: heroIdx === idx ? '2px solid #be1e2d' : '2px solid transparent',
                                  opacity: heroIdx === idx ? 1 : 0.6, transition: 'all 0.15s ease'
                                }}
                              >
                                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Option Details + Actions */}
                    <div style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: isGroupOption ? '12px' : '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', marginBottom: '6px' }}>{opt.title}</div>
                          {opt.description && !isGroupOption && (
                            <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{opt.description}</div>
                          )}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#be1e2d', whiteSpace: 'nowrap', paddingTop: '2px' }}>
                          {opt.price_max
                            ? `${formatCurrency(opt.price_min)} - ${formatCurrency(opt.price_max)}`
                            : formatCurrency(opt.price_min)
                          }
                        </div>
                      </div>

                      {/* Group-based option: show line item details */}
                      {isGroupOption && (
                        <div style={{ marginBottom: '16px' }}>
                          {groupItems.map((item: LineItem) => {
                            const cf = item.custom_fields || {} as any
                            const isApparelItem = cf.apparel_mode === true
                            const enabledSizes = (cf.enabled_sizes || []) as string[]
                            const sizes = (cf.sizes || {}) as Record<string, { qty: number; price: number }>
                            const currentColor = customerColors[item.id] || cf.color
                            const product = supplierProducts[item.id]
                            const availableColors = product?.colors || []

                            return (
                              <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                  <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #be1e2d 0%, #8a1621 100%)',
                                    marginTop: '6px', flexShrink: 0
                                  }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                                      {item.description || 'Line Item'}
                                      {currentColor && <span style={{ color: '#6b7280', fontWeight: 400 }}> — {currentColor}</span>}
                                    </div>
                                    {cf.item_number && (
                                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Item #{cf.item_number}</div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{formatCurrency(item.line_total)}</div>
                                    {item.quantity > 0 && <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.quantity} pcs</div>}
                                  </div>
                                </div>

                                {/* Color picker for apparel items */}
                                {isApparelItem && availableColors.length > 1 && (
                                  <div style={{ marginTop: '10px', marginLeft: '18px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                      Color Options
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {availableColors.map((c: any, ci: number) => {
                                        const isActive = c.colorName === currentColor
                                        return (
                                          <div
                                            key={c.colorID || ci}
                                            onClick={() => setCustomerColors(prev => ({ ...prev, [item.id]: c.colorName }))}
                                            title={c.colorName}
                                            style={{
                                              width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
                                              border: isActive ? '3px solid #be1e2d' : '2px solid #e5e7eb',
                                              background: c.colorHex ? `#${c.colorHex.replace('#', '')}` : '#ccc',
                                              ...(c.colorSwatchUrl && !c.colorHex ? { backgroundImage: `url(${c.colorSwatchUrl})`, backgroundSize: 'cover' } : {}),
                                              transition: 'all 0.15s ease',
                                              boxShadow: isActive ? '0 0 0 2px rgba(190,30,45,0.3)' : 'none'
                                            }}
                                          />
                                        )
                                      })}
                                    </div>
                                    {currentColor !== cf.color && (
                                      <div style={{ fontSize: '12px', color: '#be1e2d', marginTop: '4px', fontWeight: 500 }}>
                                        Changed to: {currentColor}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Apparel size breakdown - editable */}
                                {isApparelItem && enabledSizes.length > 0 && (
                                  <div style={{ marginTop: '10px', marginLeft: '18px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                      Sizes & Quantities
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {enabledSizes.map(size => {
                                        const s = sizes[size] || { qty: 0, price: 0 }
                                        const custQty = customerSizeQtys[item.id]?.[size] ?? s.qty
                                        return (
                                          <div key={size} style={{
                                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                            padding: '8px 10px', background: custQty > 0 ? 'rgba(190,30,45,0.03)' : '#f8f9fa', borderRadius: '8px',
                                            border: custQty > 0 ? '2px solid #be1e2d' : '1px solid #e5e7eb', minWidth: '75px',
                                            transition: 'all 0.15s ease'
                                          }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: custQty > 0 ? '#be1e2d' : '#6b7280', textTransform: 'uppercase' }}>{size}</div>
                                            <input
                                              type="number"
                                              min="0"
                                              value={custQty || ''}
                                              placeholder="0"
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0
                                                setCustomerSizeQtys(prev => ({
                                                  ...prev,
                                                  [item.id]: { ...(prev[item.id] || {}), [size]: val }
                                                }))
                                                setEditedItems(prev => new Set(prev).add(item.id))
                                              }}
                                              style={{
                                                width: '52px', padding: '6px 4px', marginTop: '4px',
                                                border: '1px solid #e5e7eb', borderRadius: '6px',
                                                fontSize: '16px', fontWeight: 600, textAlign: 'center',
                                                background: '#ffffff', outline: 'none', fontFamily: 'inherit'
                                              }}
                                            />
                                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{formatCurrency(s.price)} ea</div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Quantity Tier Pricing Breakdown */}
                      {isGroupOption && pricingMatrices.length > 0 && (() => {
                        // Build tier tables for apparel items in this group
                        const apparelItemsWithTiers = groupItems
                          .filter((item: LineItem) => item.custom_fields?.apparel_mode === true)
                          .map((item: LineItem) => ({
                            item,
                            tiers: buildTierPricing(item, pricingMatrices)
                          }))
                          .filter(x => x.tiers && x.tiers.length > 0)

                        if (apparelItemsWithTiers.length === 0) return null

                        return (
                          <div style={{
                            marginBottom: '16px', padding: '16px',
                            background: '#f8f9fa', borderRadius: '12px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#be1e2d" strokeWidth="2">
                                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                              </svg>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                                Price Per Piece by Quantity
                              </span>
                            </div>

                            {apparelItemsWithTiers.map(({ item, tiers }) => {
                              const cf = item.custom_fields || {} as any
                              return (
                                <div key={item.id} style={{ marginBottom: apparelItemsWithTiers.length > 1 ? '14px' : '0' }}>
                                  {apparelItemsWithTiers.length > 1 && (
                                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '8px' }}>
                                      {item.description}{cf.color ? ` — ${cf.color}` : ''}
                                    </div>
                                  )}
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{
                                      width: '100%', borderCollapse: 'collapse', fontSize: '13px'
                                    }}>
                                      <thead>
                                        <tr>
                                          <th style={{
                                            padding: '8px 12px', textAlign: 'left',
                                            borderBottom: '2px solid #e5e7eb',
                                            color: '#6b7280', fontWeight: 600, fontSize: '11px',
                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                          }}>Qty</th>
                                          <th style={{
                                            padding: '8px 12px', textAlign: 'right',
                                            borderBottom: '2px solid #e5e7eb',
                                            color: '#6b7280', fontWeight: 600, fontSize: '11px',
                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                          }}>Per Piece</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {tiers!.map((tier, tidx) => {
                                          // Highlight the tier that matches the current quantity
                                          const currentQty = item.quantity || 0
                                          const tierBreak = pricingMatrices
                                            .find(m => m.decoration_type === (item.category === 'EMBROIDERY' ? 'embroidery' : 'dtf'))
                                            ?.quantity_breaks.sort((a, b) => a.min - b.min)[tidx]
                                          const isActiveTier = tierBreak && currentQty >= tierBreak.min && currentQty <= tierBreak.max

                                          return (
                                            <tr key={tidx} style={{
                                              background: isActiveTier ? 'rgba(190,30,45,0.06)' : tidx % 2 === 0 ? '#ffffff' : 'transparent'
                                            }}>
                                              <td style={{
                                                padding: '8px 12px',
                                                borderBottom: '1px solid #f1f5f9',
                                                fontWeight: isActiveTier ? 700 : 500,
                                                color: isActiveTier ? '#be1e2d' : '#1a1a1a',
                                                whiteSpace: 'nowrap'
                                              }}>
                                                {tier.label} pcs
                                                {isActiveTier && (
                                                  <span style={{
                                                    marginLeft: '8px', fontSize: '10px', fontWeight: 600,
                                                    background: '#be1e2d', color: 'white',
                                                    padding: '2px 6px', borderRadius: '4px',
                                                    textTransform: 'uppercase', letterSpacing: '0.3px'
                                                  }}>Current</span>
                                                )}
                                              </td>
                                              <td style={{
                                                padding: '8px 12px',
                                                borderBottom: '1px solid #f1f5f9',
                                                textAlign: 'right',
                                                fontWeight: isActiveTier ? 700 : 600,
                                                color: isActiveTier ? '#be1e2d' : '#1a1a1a'
                                              }}>
                                                {formatCurrency(tier.pricePerPiece)}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* Action Buttons (default state) */}
                      {!actionMode && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={() => setOptionActionMode(prev => ({ ...prev, [opt.id]: 'approve' }))}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,197,94,0.25)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            style={{
                              flex: 1, padding: '14px 20px',
                              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                              border: 'none', borderRadius: '10px', color: 'white',
                              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={() => setOptionActionMode(prev => ({ ...prev, [opt.id]: 'request_changes' }))}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#d97706'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            style={{
                              flex: 1, padding: '14px 20px',
                              background: '#ffffff', border: '2px solid #e5e7eb',
                              borderRadius: '10px', color: '#6b7280',
                              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Request Changes
                          </button>
                        </div>
                      )}

                      {/* APPROVE FLOW */}
                      {actionMode === 'approve' && (
                        <div style={{
                          marginTop: '4px', padding: '20px',
                          background: 'rgba(34,197,94,0.04)', borderRadius: '12px',
                          border: '1px solid rgba(34,197,94,0.15)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>
                              {isGroupOption && hasApparelSizes ? 'Confirm Your Order' : 'Sizes & Quantities'}
                            </span>
                          </div>

                          {/* Group option with apparel sizes already set: editable confirmation view */}
                          {isGroupOption && hasApparelSizes ? (
                            <div style={{ marginBottom: '16px' }}>
                              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px 0' }}>
                                Review and update the sizes and quantities below before approving.
                              </p>
                              {groupApparelItems.map((item: LineItem) => {
                                const cf = item.custom_fields || {} as any
                                const enabledSizes = (cf.enabled_sizes || []) as string[]
                                const sizes = (cf.sizes || {}) as Record<string, { qty: number; price: number }>
                                const custQtys = customerSizeQtys[item.id] || {}
                                const itemTotalQty = enabledSizes.reduce((sum, s) => sum + (custQtys[s] ?? sizes[s]?.qty ?? 0), 0)
                                return (
                                  <div key={item.id} style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>
                                      {item.description}{cf.color ? ` — ${customerColors[item.id] || cf.color}` : ''} ({itemTotalQty} pcs)
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {enabledSizes.map(size => {
                                        const s = sizes[size] || { qty: 0, price: 0 }
                                        const custQty = custQtys[size] ?? s.qty
                                        return (
                                          <div key={size} style={{
                                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                            padding: '8px 10px', background: custQty > 0 ? 'rgba(190,30,45,0.03)' : '#ffffff', borderRadius: '8px',
                                            border: custQty > 0 ? '2px solid #be1e2d' : '1px solid #e5e7eb', minWidth: '68px',
                                            transition: 'all 0.15s ease'
                                          }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: custQty > 0 ? '#be1e2d' : '#6b7280', textTransform: 'uppercase' }}>{size}</div>
                                            <input
                                              type="number"
                                              min="0"
                                              value={custQty || ''}
                                              placeholder="0"
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0
                                                setCustomerSizeQtys(prev => ({
                                                  ...prev,
                                                  [item.id]: { ...(prev[item.id] || {}), [size]: val }
                                                }))
                                                setEditedItems(prev => new Set(prev).add(item.id))
                                              }}
                                              style={{
                                                width: '52px', padding: '6px 4px', marginTop: '4px',
                                                border: '1px solid #e5e7eb', borderRadius: '6px',
                                                fontSize: '16px', fontWeight: 600, textAlign: 'center',
                                                background: '#ffffff', outline: 'none', fontFamily: 'inherit'
                                              }}
                                            />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            /* Legacy option or non-apparel: size entry grid */
                            <>
                              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
                                Enter the quantity for each size you need. Leave sizes you don't need at 0.
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                                {availableSizes.map(size => (
                                  <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '72px' }}>
                                    <label style={{
                                      fontSize: '13px', fontWeight: 700,
                                      color: (sizeQtys[size] || 0) > 0 ? '#be1e2d' : '#6b7280',
                                      textTransform: 'uppercase', transition: 'color 0.15s ease'
                                    }}>{size}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={sizeQtys[size] || ''}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0
                                        setOptionSizeQtys(prev => ({
                                          ...prev,
                                          [opt.id]: { ...(prev[opt.id] || {}), [size]: val }
                                        }))
                                      }}
                                      style={{
                                        width: '72px', padding: '10px 8px',
                                        border: (sizeQtys[size] || 0) > 0 ? '2px solid #be1e2d' : '1px solid #e5e7eb',
                                        borderRadius: '8px', fontSize: '16px', fontWeight: 600, textAlign: 'center',
                                        background: (sizeQtys[size] || 0) > 0 ? 'rgba(190,30,45,0.03)' : '#ffffff',
                                        outline: 'none', transition: 'all 0.15s ease', fontFamily: 'inherit'
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                              {hasEnteredQtys && (
                                <div style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '12px 16px', background: '#ffffff', borderRadius: '8px',
                                  border: '1px solid #e5e7eb', marginBottom: '16px'
                                }}>
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>Total Pieces</span>
                                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#be1e2d' }}>{totalQty}</span>
                                </div>
                              )}
                            </>
                          )}

                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>Preferred contact method</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              {(['sms', 'email'] as const).map(pref => (
                                <label key={pref} style={{
                                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  gap: '6px', padding: '10px', borderRadius: '8px',
                                  border: contactPref === pref ? '2px solid #be1e2d' : '1px solid #e5e7eb',
                                  background: contactPref === pref ? 'rgba(190,30,45,0.05)' : '#ffffff',
                                  cursor: 'pointer', transition: 'all 0.15s ease'
                                }}>
                                  <input type="radio" name={`contactPref_${opt.id}`} value={pref}
                                    checked={contactPref === pref}
                                    onChange={() => setOptionContactPrefs(prev => ({ ...prev, [opt.id]: pref }))}
                                    style={{ display: 'none' }}
                                  />
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                                    {pref === 'sms' ? 'Text / SMS' : 'Email'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => setOptionActionMode(prev => ({ ...prev, [opt.id]: null }))}
                              style={{
                                padding: '12px 20px', background: '#ffffff', border: '1px solid #e5e7eb',
                                borderRadius: '8px', color: '#6b7280', fontSize: '14px', fontWeight: 500,
                                cursor: 'pointer', transition: 'all 0.15s ease'
                              }}
                            >Back</button>
                            <button
                              onClick={() => handleOptionApprove(opt.id)}
                              disabled={submittingOption}
                              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,197,94,0.3)'; }}}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                              style={{
                                flex: 1, padding: '12px 20px',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                border: 'none', borderRadius: '8px', color: 'white',
                                fontSize: '15px', fontWeight: 600,
                                cursor: submittingOption ? 'not-allowed' : 'pointer',
                                opacity: submittingOption ? 0.6 : 1, transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                              }}
                            >
                              {submittingOption ? 'Submitting...' : hasEnteredQtys ? `Confirm & Approve (${totalQty} pcs)` : 'Approve Option'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* REQUEST CHANGES FLOW */}
                      {actionMode === 'request_changes' && (
                        <div style={{
                          marginTop: '4px', padding: '20px',
                          background: 'rgba(245,158,11,0.04)', borderRadius: '12px',
                          border: '1px solid rgba(245,158,11,0.15)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>What changes would you like?</span>
                          </div>

                          <textarea
                            value={revisionText}
                            onChange={(e) => setOptionRevisionTexts(prev => ({ ...prev, [opt.id]: e.target.value }))}
                            placeholder="e.g. Could we change the color from blue to black? Or adjust the logo placement..."
                            rows={3}
                            style={{
                              width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb',
                              borderRadius: '8px', fontSize: '14px', resize: 'vertical',
                              boxSizing: 'border-box', marginBottom: '16px', fontFamily: 'inherit', outline: 'none'
                            }}
                          />

                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>Preferred contact method</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              {(['sms', 'email'] as const).map(pref => (
                                <label key={pref} style={{
                                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  gap: '6px', padding: '10px', borderRadius: '8px',
                                  border: contactPref === pref ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                                  background: contactPref === pref ? 'rgba(245,158,11,0.05)' : '#ffffff',
                                  cursor: 'pointer', transition: 'all 0.15s ease'
                                }}>
                                  <input type="radio" name={`changeContactPref_${opt.id}`} value={pref}
                                    checked={contactPref === pref}
                                    onChange={() => setOptionContactPrefs(prev => ({ ...prev, [opt.id]: pref }))}
                                    style={{ display: 'none' }}
                                  />
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                                    {pref === 'sms' ? 'Text / SMS' : 'Email'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => setOptionActionMode(prev => ({ ...prev, [opt.id]: null }))}
                              style={{
                                padding: '12px 20px', background: '#ffffff', border: '1px solid #e5e7eb',
                                borderRadius: '8px', color: '#6b7280', fontSize: '14px', fontWeight: 500,
                                cursor: 'pointer', transition: 'all 0.15s ease'
                              }}
                            >Back</button>
                            <button
                              onClick={() => handleOptionRequestChanges(opt.id)}
                              disabled={submittingOption || !revisionText.trim()}
                              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.25)'; }}}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                              style={{
                                flex: 1, padding: '12px 20px',
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                border: 'none', borderRadius: '8px', color: 'white',
                                fontSize: '15px', fontWeight: 600,
                                cursor: (submittingOption || !revisionText.trim()) ? 'not-allowed' : 'pointer',
                                opacity: (submittingOption || !revisionText.trim()) ? 0.6 : 1,
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                              }}
                            >
                              {submittingOption ? 'Submitting...' : 'Submit Change Request'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
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
                            const currentColor = customerColors[item.id] || cf.color
                            const product = supplierProducts[item.id]
                            const availableColors = product?.colors || []

                            if (isApparelItem && enabledSizes.length > 0) {
                              // Calculate total from customer-edited quantities
                              const custQtys = customerSizeQtys[item.id] || {}
                              const totalPcs = enabledSizes.reduce((sum, s) => sum + (custQtys[s] ?? sizes[s]?.qty ?? 0), 0)

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
                                        {currentColor && <span style={{ color: '#6b7280', fontWeight: 400 }}> — {currentColor}</span>}
                                      </div>
                                      {cf.item_number && (
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Item #{cf.item_number}</div>
                                      )}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{formatCurrency(item.line_total)}</div>
                                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{totalPcs} pcs total</div>
                                    </div>
                                  </div>

                                  {/* Color picker */}
                                  {availableColors.length > 1 && canApprove && (
                                    <div style={{ marginTop: '12px', marginLeft: '20px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                        Color Options
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {availableColors.map((c: any, ci: number) => {
                                          const isActive = c.colorName === currentColor
                                          return (
                                            <div
                                              key={c.colorID || ci}
                                              onClick={() => setCustomerColors(prev => ({ ...prev, [item.id]: c.colorName }))}
                                              title={c.colorName}
                                              style={{
                                                width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
                                                border: isActive ? '3px solid #be1e2d' : '2px solid #e5e7eb',
                                                background: c.colorHex ? `#${c.colorHex.replace('#', '')}` : '#ccc',
                                                ...(c.colorSwatchUrl && !c.colorHex ? { backgroundImage: `url(${c.colorSwatchUrl})`, backgroundSize: 'cover' } : {}),
                                                transition: 'all 0.15s ease',
                                                boxShadow: isActive ? '0 0 0 2px rgba(190,30,45,0.3)' : 'none'
                                              }}
                                            />
                                          )
                                        })}
                                      </div>
                                      {currentColor !== cf.color && currentColor && (
                                        <div style={{ fontSize: '12px', color: '#be1e2d', marginTop: '4px', fontWeight: 500 }}>
                                          Changed to: {currentColor}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Size breakdown grid - editable when quote can be approved */}
                                  <div style={{ marginTop: '10px', marginLeft: '20px' }}>
                                    {canApprove && (
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                        Sizes & Quantities
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {enabledSizes.map(size => {
                                        const s = sizes[size] || { qty: 0, price: 0 }
                                        const custQty = custQtys[size] ?? s.qty
                                        if (!canApprove && custQty <= 0) return null
                                        return (
                                          <div key={size} style={{
                                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                            padding: '8px 10px', background: custQty > 0 ? (canApprove ? 'rgba(190,30,45,0.03)' : '#f8f9fa') : '#f8f9fa', borderRadius: '8px',
                                            border: custQty > 0 && canApprove ? '2px solid #be1e2d' : '1px solid #e5e7eb', minWidth: '75px',
                                            transition: 'all 0.15s ease'
                                          }}>
                                            <div style={{ fontSize: '14px', fontWeight: 700, color: custQty > 0 ? '#be1e2d' : '#6b7280', textTransform: 'uppercase' }}>{size}</div>
                                            {canApprove ? (
                                              <input
                                                type="number"
                                                min="0"
                                                value={custQty || ''}
                                                placeholder="0"
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value) || 0
                                                  setCustomerSizeQtys(prev => ({
                                                    ...prev,
                                                    [item.id]: { ...(prev[item.id] || {}), [size]: val }
                                                  }))
                                                  setEditedItems(prev => new Set(prev).add(item.id))
                                                }}
                                                style={{
                                                  width: '52px', padding: '6px 4px', marginTop: '4px',
                                                  border: '1px solid #e5e7eb', borderRadius: '6px',
                                                  fontSize: '16px', fontWeight: 600, textAlign: 'center',
                                                  background: '#ffffff', outline: 'none', fontFamily: 'inherit'
                                                }}
                                              />
                                            ) : (
                                              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginTop: '3px' }}>{custQty}</div>
                                            )}
                                            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '3px' }}>{formatCurrency(s.price)} ea</div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {/* Qty tier pricing table */}
                                  {pricingMatrices.length > 0 && (() => {
                                    const tiers = buildTierPricing(item, pricingMatrices)
                                    if (!tiers || tiers.length === 0) return null
                                    const currentQty = totalPcs || item.quantity || 0
                                    const isEmbroidery = item.category === 'EMBROIDERY' || item.decoration_type === 'embroidery'
                                    const matrix = pricingMatrices.find(m => m.decoration_type === (isEmbroidery ? 'embroidery' : 'dtf'))
                                    const sortedBreaks = matrix ? [...matrix.quantity_breaks].sort((a, b) => a.min - b.min) : []

                                    return (
                                      <div style={{ marginTop: '12px', marginLeft: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                          Price Per Piece by Qty
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {tiers.map((tier, tidx) => {
                                            const tierBreak = sortedBreaks[tidx]
                                            const isActive = tierBreak && currentQty >= tierBreak.min && currentQty <= tierBreak.max
                                            return (
                                              <div key={tidx} style={{
                                                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                                padding: '6px 12px', borderRadius: '6px',
                                                background: isActive ? 'rgba(190,30,45,0.08)' : '#ffffff',
                                                border: isActive ? '2px solid #be1e2d' : '1px solid #e5e7eb',
                                                minWidth: '70px'
                                              }}>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: isActive ? '#be1e2d' : '#6b7280' }}>{tier.label} pcs</div>
                                                <div style={{ fontSize: '14px', fontWeight: 700, color: isActive ? '#be1e2d' : '#1a1a1a', marginTop: '2px' }}>{formatCurrency(tier.pricePerPiece)}</div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })()}
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

                          {/* Dynamic mockup preview when customer changes color */}
                          {(() => {
                            const cf = item.custom_fields || {}
                            const selectedColor = customerColors[item.id]
                            const hasColorChange = selectedColor && selectedColor !== cf.color && cf.apparel_mode && cf.mockup_config
                            if (!hasColorChange) return null

                            const product = supplierProducts[item.id]
                            if (!product) return null
                            const newColorData = product.colors?.find((c: any) => c.colorName === selectedColor)
                            if (!newColorData) return null

                            // Show the new color's garment images as a preview
                            const previewImages: { url: string; location: string }[] = []
                            if (newColorData.frontImage) previewImages.push({ url: newColorData.frontImage, location: 'Front' })
                            if (newColorData.backImage) previewImages.push({ url: newColorData.backImage, location: 'Back' })
                            if (newColorData.sideImage) previewImages.push({ url: newColorData.sideImage, location: 'Side' })

                            if (previewImages.length === 0) return null

                            return (
                              <div style={{ marginTop: '16px', padding: '12px', background: '#fffbf0', border: '1px solid #f59e0b', borderRadius: '10px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                  Preview: {selectedColor}
                                </div>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: previewImages.length === 1 ? '1fr' : `repeat(${Math.min(previewImages.length, 3)}, 1fr)`,
                                  gap: '8px'
                                }}>
                                  {previewImages.map((preview, pidx) => (
                                    <div key={pidx}>
                                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px', fontWeight: 500 }}>{preview.location}</div>
                                      <div style={{
                                        position: 'relative', width: '100%', paddingBottom: '100%',
                                        borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9'
                                      }}>
                                        <img
                                          src={preview.url}
                                          alt={`${selectedColor} ${preview.location}`}
                                          style={{
                                            position: 'absolute', top: 0, left: 0,
                                            width: '100%', height: '100%', objectFit: 'contain'
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
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

            {/* Zoom instruction hint */}
            {lightboxZoom === 1 && (
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                pointerEvents: 'none',
                opacity: 0.8
              }}>
                Double-click to zoom
              </div>
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
        const images = opt._images || getOptionImages(opt)
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