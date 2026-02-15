'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { isAutomationEnabled } from '../../../lib/automation-settings'
import SSProductLookup from '@/app/components/operations/SSProductLookup'
import GarmentMockupBuilder from '@/app/components/operations/GarmentMockupBuilder'

const buttonStyles = `
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .action-btn:hover:not(:disabled) {
    transform: translateY(-4px) scale(1.05);
  }
  .action-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }
  .action-btn-secondary {
    background: #282a30;
    border: 1px solid rgba(148,163,184,0.2);
    color: #94a3b8;
  }
  .action-btn-secondary:hover:not(:disabled) {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }
  .action-btn-primary {
    background: linear-gradient(135deg, #d71cd1, #8b5cf6);
    border: none;
    color: white;
    font-weight: 600;
    box-shadow: 0 0 20px rgba(215, 28, 209, 0.3);
  }
  .action-btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 30px rgba(215, 28, 209, 0.6);
  }
  .action-btn-success {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border: none;
    color: white;
    font-weight: 600;
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
  }
  .action-btn-success:hover:not(:disabled) {
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.6);
  }
  .action-btn-success-outline {
    background: transparent;
    border: 2px solid #22c55e;
    color: #22c55e;
    font-weight: 600;
  }
  .action-btn-success-outline:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.1);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

// Reusable Button Component with hover effects
const ActionButton = ({ 
  onClick, 
  disabled, 
  variant = 'secondary', 
  children, 
  style = {} 
}: { 
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'success' | 'success-outline'
  children: React.ReactNode
  style?: React.CSSProperties
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`action-btn action-btn-${variant}`}
      style={style}
    >
      {children}
    </button>
  )
}

// ============================================================================
// TYPES
// ============================================================================
type Attachment = { url: string; key: string; filename: string; contentType: string; size: number; uploadedAt: string; file_id?: string; file_url?: string; file_name?: string; name?: string; type?: string; mime_type?: string; uploaded_at?: string }
type Customer = { id: string; display_name: string; first_name: string; last_name: string; email: string; phone: string; company: string; emb_thread_colors?: string; emb_drive_folder_url?: string }

type Document = {
  id: string; doc_number: number; doc_type: string; status: string; bucket: string; customer_id: string
  customer_name: string; customer_email: string; customer_phone: string; company_name: string
  vehicle_description: string; project_description: string; category: string
  subtotal: number; discount_amount: number; discount_percent: number; tax_amount: number; total: number
  deposit_required: number; deposit_paid: number; amount_paid: number; balance_due: number
  notes: string; created_at: string; sent_at: string; viewed_at: string; approved_at: string; paid_at: string
  valid_until: string | null; attachments?: Attachment[]; in_production: boolean; fees?: Fee[] | string
  followup_count?: number; last_followup_at?: string; revision_history_json?: any; discount_note?: string
  options_mode?: boolean; options_json?: QuoteOption[]; history_log?: HistoryEntry[]
  fulfillment_type?: string; fulfillment_details?: any
}

type HistoryEntry = {
  timestamp: string
  event: string
  detail?: string
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

type LineItemGroup = { group_id: string; category_key: string }

type Category = {
  category_key: string; parent_category: string; label: string; calendar_color: string
  line_template: string; has_types: boolean; has_packages: boolean
  unit_label: string; default_rate: number; sort_order: number; active: boolean
  apparel_mode?: boolean
}

type Package = {
  package_key: string; category_key: string; label: string; description: string
  coverage_areas: string; sqft_estimate: number; base_price: number; rate_per_sqft: number
}

type LineItemType = {
  type_key: string; category_key: string; label: string; default_rate: number
}

type FeeType = { fee_type_key: string; label: string; default_amount: number }

type Fee = { fee_type: string; description: string; amount: number }

type Payment = {
  id: string
  document_id: string
  amount: number
  processing_fee: number
  payment_method: string
  processor: string
  processor_txn_id: string
  status: string
  notes: string
  created_at: string
}

type Props = {
  document: Document
  initialLineItems: LineItem[]
  customers?: Customer[]
  categories: Category[]
  packages: Package[]
  lineItemTypes: LineItemType[]
  feeTypes: FeeType[]
  payments: Payment[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const hasTypes = (cat: Category) => cat.has_types === true
const hasPackages = (cat: Category) => cat.has_packages === true

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function DocumentDetail({ 
  document: initialDoc, 
  initialLineItems, 
  customers = [],
  categories = [],
  packages = [],
  lineItemTypes = [],
  feeTypes = [],
  payments: initialPayments = []
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  const [doc, setDoc] = useState(initialDoc)
  const [attachments, setAttachments] = useState<Attachment[]>(initialDoc.attachments || [])
  
  // Customer fields
  const [customerName, setCustomerName] = useState(initialDoc.customer_name || '')
  const [companyName, setCompanyName] = useState(initialDoc.company_name || '')
  const [customerEmail, setCustomerEmail] = useState(initialDoc.customer_email || '')
  const [customerPhone, setCustomerPhone] = useState(initialDoc.customer_phone || '')
  const [vehicleDescription, setVehicleDescription] = useState(initialDoc.vehicle_description || '')
  const [projectDescription, setProjectDescription] = useState(initialDoc.project_description || '')
  
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])

  // Config helpers using props
  const getCategoryByKey = (key: string) => categories.find(c => c.category_key === key)
  const getPackagesForCategory = (categoryKey: string) => packages.filter(p => p.category_key === categoryKey)
  const getTypesForCategory = (categoryKey: string) => lineItemTypes.filter(t => t.category_key === categoryKey)

  // Line items state
  const [lineItemGroups, setLineItemGroups] = useState<LineItemGroup[]>(() => {
    const groups: LineItemGroup[] = []
    const seen = new Set<string>()
    initialLineItems.forEach(item => {
      if (item.group_id && !seen.has(item.group_id)) {
        seen.add(item.group_id)
        groups.push({ group_id: item.group_id, category_key: item.category || 'OTHER' })
      }
    })
    return groups
  })
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    console.log('🔍 Initial lineItems load:', initialLineItems.length, 'items', '- Component loaded at:', new Date().toLocaleTimeString())
    initialLineItems.forEach((item, idx) => {
      console.log(`  Item ${idx + 1}:`, {
        id: item.id,
        description: item.description,
        custom_fields: item.custom_fields
      })
    })
    return initialLineItems
  })
  
  // Fees state - load from document
  const [fees, setFees] = useState<Fee[]>(() => {
    try {
      return Array.isArray(initialDoc.fees) ? initialDoc.fees : JSON.parse(initialDoc.fees || '[]')
    } catch { return [] }
  })
  
  // Discount/Tax/Notes state
  const [discountAmountInput, setDiscountAmountInput] = useState(initialDoc.discount_amount || 0)
  const [discountPercentInput, setDiscountPercentInput] = useState(initialDoc.discount_percent || 0)
  const [discountMode, setDiscountMode] = useState<'none' | 'percent' | 'flat'>(() => {
    if (initialDoc.discount_percent > 0) return 'percent'
    if (initialDoc.discount_amount > 0) return 'flat'
    return 'none'
  })
  const [discountNote, setDiscountNote] = useState(initialDoc.discount_note || '')
  const [taxAmountInput, setTaxAmountInput] = useState(initialDoc.tax_amount || 0)
  const [depositRequired, setDepositRequired] = useState(initialDoc.deposit_required || 0)
  const [depositType, setDepositType] = useState<'50%' | 'full' | 'custom'>(() => {
    const dep = initialDoc.deposit_required || 0
    const tot = initialDoc.total || 0
    if (tot > 0 && Math.abs(dep - tot) < 0.01) return 'full'
    if (tot > 0 && Math.abs(dep - (tot * 0.5)) < 0.01) return '50%'
    if (dep > 0) return 'custom'
    return '50%'
  })
  const [validUntil, setValidUntil] = useState(initialDoc.valid_until ? initialDoc.valid_until.split('T')[0] : '')
  const [notes, setNotes] = useState(initialDoc.notes || '')
  // Options mode state
  const [optionsMode, setOptionsMode] = useState(initialDoc.options_mode || false)
  const [options, setOptions] = useState<QuoteOption[]>(() => {
    try {
      if (Array.isArray(initialDoc.options_json)) return initialDoc.options_json
      if (typeof initialDoc.options_json === 'string') return JSON.parse(initialDoc.options_json)
      return []
    } catch { return [] }
  })
  const handleDiscountNoteBlur = async () => {
    await supabase.from('documents').update({ discount_note: discountNote }).eq('id', doc.id)
    setDoc({ ...doc, discount_note: discountNote })
  }

  // Payments state
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Auto-mark unread payments as read when viewing this document
  useEffect(() => {
    const unreadIds = initialPayments.filter((p: any) => p.read === false).map(p => p.id)
    if (unreadIds.length > 0) {
      fetch('/api/payments/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds: unreadIds })
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false)
  const [fulfillmentType, setFulfillmentType] = useState(doc.fulfillment_type || '')
  const [fulfillmentDetails, setFulfillmentDetails] = useState(doc.fulfillment_details || {})
  const [deleting, setDeleting] = useState(false)

  // Revision History state
  const [revisions, setRevisions] = useState<Array<{timestamp: string, from: string, name: string, message: string, sentSms?: boolean}>>(() => {
    try {
      const doc = initialDoc as any
      return Array.isArray(doc.revision_history_json) ? doc.revision_history_json : JSON.parse(doc.revision_history_json || '[]')
    } catch { return [] }
  })
  const [revisionReply, setRevisionReply] = useState('')
  const [revisionSendSms, setRevisionSendSms] = useState(false)
  const [revisionIncludeLink, setRevisionIncludeLink] = useState(false)
  const [sendingRevision, setSendingRevision] = useState(false)

  // History Log state
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>(() => {
    try {
      const log = (initialDoc as any).history_log
      return Array.isArray(log) ? log : JSON.parse(log || '[]')
    } catch { return [] }
  })
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // Append a history entry and persist
  const appendHistory = async (event: string, detail?: string) => {
    const entry: HistoryEntry = { timestamp: new Date().toISOString(), event, detail }
    const updated = [...historyLog, entry]
    setHistoryLog(updated)
    await supabase.from('documents').update({ history_log: updated }).eq('id', doc.id)
  }

  // Apparel size management
  const [apparelSizeMenu, setApparelSizeMenu] = useState<string | null>(null)

  // Mockup builder state
  const [mockupBuilderOpen, setMockupBuilderOpen] = useState(false)
  const [mockupLineItemId, setMockupLineItemId] = useState<string | null>(null)
  const [mockupGarmentUrl, setMockupGarmentUrl] = useState<string>('')
  const [mockupGarmentName, setMockupGarmentName] = useState<string>('')
  const [mockupColorName, setMockupColorName] = useState<string>('')

  // SS Product cache for line items (stores fetched product data)
  const [ssProductCache, setSsProductCache] = useState<Record<string, any>>({})

  // Send to Zayn (embroidery digitizing)
  const [showZaynModal, setShowZaynModal] = useState(false)
  const [zaynItemType, setZaynItemType] = useState<'flat' | 'cap' | 'both'>('flat')
  const [zaynFlatDimType, setZaynFlatDimType] = useState<'width' | 'height'>('width')
  const [zaynFlatDimValue, setZaynFlatDimValue] = useState('')
  const [zaynCapDimType, setZaynCapDimType] = useState<'width' | 'height'>('width')
  const [zaynCapDimValue, setZaynCapDimValue] = useState('')
  const [zaynRush, setZaynRush] = useState(false)
  const [zaynMessage, setZaynMessage] = useState('')
  const [zaynSending, setZaynSending] = useState(false)
  const [zaynSelectedFiles, setZaynSelectedFiles] = useState<{url: string; filename: string}[]>([])

  // Check if document has embroidery line items
  const hasEmbroideryItems = lineItems.some(li => li.category?.toUpperCase() === 'EMBROIDERY')
  const matchedCustomer = customers.find(c => c.id === doc.customer_id)

  // Modals
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveBucket, setArchiveBucket] = useState<'won' | 'lost'>('lost')
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveOtherReason, setArchiveOtherReason] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [schedulingEvent, setSchedulingEvent] = useState(false)
  // Vehicle On Site (syncs to Google Calendar)
  const [vehicleStartDate, setVehicleStartDate] = useState('')
  const [vehicleStartTime, setVehicleStartTime] = useState('09:00')
  const [vehicleEndDate, setVehicleEndDate] = useState('')
  const [vehicleEndTime, setVehicleEndTime] = useState('17:00')
  // Install Period (internal only)
  const [installStartDate, setInstallStartDate] = useState('')
  const [installStartTime, setInstallStartTime] = useState('09:00')
  const [installEndDate, setInstallEndDate] = useState('')
  const [installEndTime, setInstallEndTime] = useState('17:00')
  
  // Send modal state
  const [sendEmail, setSendEmail] = useState(true)
  const [sendSms, setSendSms] = useState(true)
  const [sendingDocument, setSendingDocument] = useState(false)
  const [approvalType, setApprovalType] = useState('both')
  const [customApprovalText, setCustomApprovalText] = useState('')
  const [includeLineAttachments, setIncludeLineAttachments] = useState(true)
  const [includeProjectAttachments, setIncludeProjectAttachments] = useState(false)
  const [paymentTerms, setPaymentTerms] = useState('deposit_50')
  const [customPaymentAmount, setCustomPaymentAmount] = useState<number | string>('')
  const [notificationPref, setNotificationPref] = useState('sms')
  
  // Calculate line item attachment count
  const lineItemAttachmentCount = lineItems.reduce((count, item) => {
    const itemAttachments = item.attachments || []
    return count + itemAttachments.length
  }, 0)

  // Follow-up modal state
  const [followUpTemplate, setFollowUpTemplate] = useState<'CHECKING_IN' | 'READY_TO_PROCEED'>('CHECKING_IN')
  const [followUpMessage, setFollowUpMessage] = useState('')
  const [followUpIncentiveEnabled, setFollowUpIncentiveEnabled] = useState(false)
  const [followUpDiscountType, setFollowUpDiscountType] = useState<'percent' | 'dollar'>('percent')
  const [followUpDiscountPercent, setFollowUpDiscountPercent] = useState(10)
  const [followUpDiscountDollar, setFollowUpDiscountDollar] = useState(50)
  const [followUpExpiryDate, setFollowUpExpiryDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [followUpDepositType, setFollowUpDepositType] = useState<'50' | '100' | 'custom'>('50')
  const [followUpDepositAmount, setFollowUpDepositAmount] = useState(0)
  const [sendingFollowUp, setSendingFollowUp] = useState(false)
  const [sectionModalTab, setSectionModalTab] = useState<'AUTOMOTIVE' | 'SIGNAGE' | 'APPAREL'>('AUTOMOTIVE')
  
  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 })
  
  // Option lightbox
  const [optionLightboxIndex, setOptionLightboxIndex] = useState<number | null>(null)
  const [optionLightboxOptionId, setOptionLightboxOptionId] = useState<string | null>(null)
  const [optionLightboxZoom, setOptionLightboxZoom] = useState(1)
  const [optionLightboxPan, setOptionLightboxPan] = useState({ x: 0, y: 0 })

  const imageAttachments = attachments.filter(a => a.contentType?.startsWith('image/'))
  const lightboxUrl = lightboxIndex !== null ? imageAttachments[lightboxIndex]?.url : null
  
// Toast notifications
  const [toasts, setToasts] = useState<Array<{id: number, message: string, type: 'success' | 'error' | 'info'}>>([])
  const toastIdRef = useRef(0)
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // Line item lightbox state
  const [lineItemLightbox, setLineItemLightbox] = useState<{itemId: string, index: number} | null>(null)
  
  const getLineItemImageAttachments = (itemId: string) => {
    const item = lineItems.find(i => i.id === itemId)
    if (!item || !item.attachments) return []
    return item.attachments.filter(att => {
      const url = att.url || att.file_url || ''
      const name = att.name || att.filename || att.file_name || ''
      return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
    })
  }
  
  const openLineItemLightbox = (itemId: string, index: number) => {
    setLineItemLightbox({ itemId, index })
    setLightboxZoom(1)
    setLightboxPan({ x: 0, y: 0 })
  }
  
  const lineItemLightboxImages = lineItemLightbox ? getLineItemImageAttachments(lineItemLightbox.itemId) : []
  const lineItemLightboxUrl = lineItemLightbox && lineItemLightboxImages[lineItemLightbox.index] 
    ? (lineItemLightboxImages[lineItemLightbox.index].url || lineItemLightboxImages[lineItemLightbox.index].file_url || '')
    : null

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
  const feesTotal = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  const discountAmount = doc.discount_percent ? (subtotal * doc.discount_percent / 100) : (parseFloat(String(doc.discount_amount)) || 0)
  const taxableSubtotal = lineItems.filter(item => item.taxable).reduce((sum, item) => sum + (item.line_total || 0), 0)
  const calculatedTax = taxableSubtotal * 0.06
  const taxAmount = calculatedTax
  const total = subtotal + feesTotal - discountAmount + taxAmount
  // Calculate actual amount paid from payments (doc.amount_paid may be stale)
  const actualAmountPaid = (() => {
    const fromPayments = (payments || []).filter(p => p.status === 'completed').reduce((sum, p) => {
      const amt = parseFloat(String(p.amount)) || 0
      const fee = parseFloat(String(p.processing_fee)) || 0
      if (fee > 0 && fee < amt) return sum + (amt - fee)
      if (fee >= amt && p.payment_method === 'card') return sum + Math.round(((amt - 0.30) / 1.029) * 100) / 100
      return sum + amt
    }, 0)
    return Math.max(fromPayments, parseFloat(String(doc.amount_paid)) || 0)
  })()
  const balanceDue = total - actualAmountPaid

  
  // Auto-update deposit when total changes (if not custom)
  useEffect(() => {
    if (depositType === '50%') {
      setDepositRequired(total * 0.5)
    } else if (depositType === 'full') {
      setDepositRequired(total)
    }
  }, [total, depositType])

  // Track customer field changes
  useEffect(() => {
    const changed = customerName !== (initialDoc.customer_name || '') || companyName !== (initialDoc.company_name || '') ||
      customerEmail !== (initialDoc.customer_email || '') || customerPhone !== (initialDoc.customer_phone || '') ||
      vehicleDescription !== (initialDoc.vehicle_description || '') || projectDescription !== (initialDoc.project_description || '')
    setHasChanges(changed)
  }, [customerName, companyName, customerEmail, customerPhone, vehicleDescription, projectDescription, initialDoc])

  // Customer autocomplete
  useEffect(() => {
    if (customerSearch.length >= 2) {
      const term = customerSearch.toLowerCase()
      const filtered = customers.filter(c => c.display_name?.toLowerCase().includes(term) || c.first_name?.toLowerCase().includes(term) || c.last_name?.toLowerCase().includes(term) || c.company?.toLowerCase().includes(term)).slice(0, 8)
      setFilteredCustomers(filtered)
      setShowCustomerDropdown(filtered.length > 0)
    } else {
      setFilteredCustomers([])
      setShowCustomerDropdown(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearch])

  // Lightbox keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle line item lightbox
      if (lineItemLightbox) {
        if (e.key === 'Escape') { setLineItemLightbox(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
        else if (e.key === 'ArrowLeft') { setLineItemLightbox(prev => prev ? { ...prev, index: prev.index > 0 ? prev.index - 1 : lineItemLightboxImages.length - 1 } : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
        else if (e.key === 'ArrowRight') { setLineItemLightbox(prev => prev ? { ...prev, index: prev.index < lineItemLightboxImages.length - 1 ? prev.index + 1 : 0 } : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
        else if (e.key === '+' || e.key === '=') setLightboxZoom(z => Math.min(z * 1.5, 5))
        else if (e.key === '-') setLightboxZoom(z => { const nz = Math.max(z / 1.5, 1); if (nz === 1) setLightboxPan({ x: 0, y: 0 }); return nz })
        return
      }
      if (lightboxIndex === null) return
      if (e.key === 'Escape') { setLightboxIndex(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
      else if (e.key === 'ArrowLeft') { setLightboxIndex(i => i !== null ? (i > 0 ? i - 1 : imageAttachments.length - 1) : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
      else if (e.key === 'ArrowRight') { setLightboxIndex(i => i !== null ? (i < imageAttachments.length - 1 ? i + 1 : 0) : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
      else if (e.key === '+' || e.key === '=') setLightboxZoom(z => Math.min(z * 1.5, 5))
      else if (e.key === '-') setLightboxZoom(z => { const nz = Math.max(z / 1.5, 1); if (nz === 1) setLightboxPan({ x: 0, y: 0 }); return nz })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, imageAttachments.length])

  // Seed history log from existing timestamps if log is empty
  useEffect(() => {
    if (historyLog.length > 0) return
    const entries: HistoryEntry[] = []
    if (doc.created_at) entries.push({ timestamp: doc.created_at, event: 'Created', detail: `${doc.doc_type === 'quote' ? 'Quote' : 'Invoice'} #${doc.doc_number} created` })
    if (doc.sent_at) entries.push({ timestamp: doc.sent_at, event: 'Sent', detail: `Sent to ${doc.customer_name}` })
    if (doc.viewed_at) entries.push({ timestamp: doc.viewed_at, event: 'Viewed', detail: 'Customer viewed the document' })
    if (doc.approved_at) entries.push({ timestamp: doc.approved_at, event: 'Approved', detail: 'Customer approved' })
    if (doc.paid_at) entries.push({ timestamp: doc.paid_at, event: 'Paid', detail: 'Payment received' })
    if (entries.length > 0) {
      entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      setHistoryLog(entries)
      supabase.from('documents').update({ history_log: entries }).eq('id', doc.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openLightbox = (attachment: Attachment) => {
    const idx = imageAttachments.findIndex(a => a.key === attachment.key)
    if (idx !== -1) { setLightboxIndex(idx); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleSelectCustomer = (customer: Customer) => {
    setCustomerName(customer.display_name || customer.first_name + ' ' + customer.last_name)
    setCompanyName(customer.company || '')
    setCustomerEmail(customer.email || '')
    setCustomerPhone(customer.phone || '')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setHasChanges(true)
  }

  const handleSaveDocument = async () => {
    setSaving(true)
    const updates = { customer_name: customerName, company_name: companyName, customer_email: customerEmail, customer_phone: customerPhone, vehicle_description: vehicleDescription, project_description: projectDescription, subtotal, total }
    await supabase.from('documents').update(updates).eq('id', doc.id)
    setDoc({ ...doc, ...updates })
    setHasChanges(false)
    setSaving(false)
  }

  const [linkCopied, setLinkCopied] = useState(false)
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/view/' + doc.id)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Navigate to Message Hub with customer phone pre-filled
  const handleOpenMessageHub = () => {
    if (customerPhone) {
      router.push(`/messages?to=${encodeURIComponent(customerPhone)}`)
    }
  }

  // Initiate a call from Twilio number to customer
  const [calling, setCalling] = useState(false)
  const handleCallCustomer = async () => {
    if (!customerPhone || calling) return

    if (!confirm(`Call ${doc.customer_name} at ${customerPhone}?`)) return

    setCalling(true)
    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerPhone,
          customerName: doc.customer_name || 'Customer',
          documentId: doc.id
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert('Call initiated! Your phone will ring first, then we\'ll connect you to the customer.')
      } else {
        alert(`Failed to initiate call: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error initiating call:', error)
      alert('Failed to initiate call. Please try again.')
    } finally {
      setCalling(false)
    }
  }

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = () => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }


  // Follow-up handlers
  const handleOpenFollowUpModal = () => {
    const firstName = (customerName || 'there').split(' ')[0]
    const docType = doc.doc_type || 'quote'
    setFollowUpTemplate('CHECKING_IN')
    setFollowUpMessage(`Hi ${firstName}, just checking in on the ${docType} we sent over. Let me know if you have any questions!`)
    setFollowUpIncentiveEnabled(false)
    setFollowUpDiscountType('percent')
    setFollowUpDiscountPercent(10)
    setFollowUpDiscountDollar(50)
    setFollowUpDepositType('50')
    setFollowUpDepositAmount(total * 0.5)
    const d = new Date()
    d.setDate(d.getDate() + 7)
    setFollowUpExpiryDate(d.toISOString().split('T')[0])
    setShowFollowUpModal(true)
  }

  const handleSelectFollowUpTemplate = (template: 'CHECKING_IN' | 'READY_TO_PROCEED') => {
    setFollowUpTemplate(template)
    const firstName = (customerName || 'there').split(' ')[0]
    const docType = doc.doc_type || 'quote'
    if (template === 'CHECKING_IN') {
      setFollowUpMessage(`Hi ${firstName}, just checking in on the ${docType} we sent over. Let me know if you have any questions!`)
    } else {
      setFollowUpMessage(`Hi ${firstName}, wanted to follow up on your ${docType}. We're ready to get started whenever works for you.`)
    }
  }

  const getFollowUpDiscountAmount = () => {
    if (followUpDiscountType === 'percent') {
      return Math.round(subtotal * followUpDiscountPercent) / 100
    }
    return followUpDiscountDollar
  }

  const handleFollowUpDepositTypeChange = (type: '50' | '100' | 'custom') => {
    setFollowUpDepositType(type)
    let effectiveTotal = subtotal
    if (followUpIncentiveEnabled) {
      effectiveTotal = subtotal - getFollowUpDiscountAmount()
    }
    if (type === '50') setFollowUpDepositAmount(effectiveTotal * 0.5)
    else if (type === '100') setFollowUpDepositAmount(effectiveTotal)
  }

  const handleSendFollowUp = async () => {
    if (!followUpMessage.trim()) {
      showToast('Please enter a message', 'error')
      return
    }
    setSendingFollowUp(true)

    try {
      const customerLink = window.location.origin + '/view/' + doc.id
      const firstName = (customerName || 'there').split(' ')[0]
      
      // Build the full message with incentive if enabled
      let fullMessage = followUpMessage
      if (followUpIncentiveEnabled) {
        const discountText = followUpDiscountType === 'percent' 
          ? `${followUpDiscountPercent}% off` 
          : `$${followUpDiscountDollar.toFixed(2)} off`
        fullMessage += `\n\nSpecial offer: ${discountText} if you approve by ${followUpExpiryDate}!`
      }
      fullMessage += `\n\nView your ${doc.doc_type}: ${customerLink}`

      // Send SMS
      if (customerPhone) {
        const smsRes = await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            to: customerPhone,
            message: fullMessage
          })
        })
        const smsData = await smsRes.json()
        if (!smsData.success) {
          console.error('SMS failed:', smsData.error)
        }
      }

      // Send Email
      if (customerEmail) {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: doc.id,
            to: customerEmail,
            subject: `Following up on your ${doc.doc_type === 'quote' ? 'Quote' : 'Invoice'} #${doc.doc_number}`,
            customMessage: fullMessage
          })
        })
      }

      // Update document with follow-up info
      const newFollowUpCount = (doc.followup_count || 0) + 1
      const updates: any = {
        last_followup_at: new Date().toISOString(),
        followup_count: newFollowUpCount
      }
      
      // If incentive enabled, update discount
      if (followUpIncentiveEnabled) {
        if (followUpDiscountType === 'percent') {
          updates.discount_percent = followUpDiscountPercent
          updates.discount_amount = 0
        } else {
          updates.discount_amount = followUpDiscountDollar
          updates.discount_percent = 0
        }
      }
      
      // Update deposit required
      updates.deposit_required = followUpDepositAmount

      await supabase.from('documents').update(updates).eq('id', doc.id)
      
      setDoc({ ...doc, ...updates })
      setShowFollowUpModal(false)
      showToast('Follow-up sent!', 'success')

    } catch (err) {
      console.error('Follow-up error:', err)
      showToast('Failed to send follow-up', 'error')
    }
    setSendingFollowUp(false)
  }
  const handleOpenSendModal = () => {
    setSendEmail(!!customerEmail)
    setSendSms(!!customerPhone)
    setApprovalType('both')
    setCustomApprovalText('')
    setIncludeLineAttachments(lineItemAttachmentCount > 0)
    setIncludeProjectAttachments(false)
    setPaymentTerms('deposit_50')
    setCustomPaymentAmount(0)
    setNotificationPref('sms')
    setShowSendModal(true)
  }

  const handleSendDocument = async () => {
    if (!sendEmail && !sendSms) { showToast('Select at least one delivery method', 'error'); return }
    setSendingDocument(true)
    
    try {
      const customerLink = window.location.origin + '/view/' + doc.id
      const docLabel = (doc.doc_type === 'quote' ? 'Quote' : 'Invoice') + ' #' + doc.doc_number
      const firstName = customerName.split(' ')[0] || 'there'
      
      // Determine deposit amount based on payment terms
      let depositAmount = 0
      if (paymentTerms === 'deposit_50') depositAmount = total * 0.5
      else if (paymentTerms === 'full') depositAmount = total
      else if (paymentTerms === 'custom') depositAmount = Number(customPaymentAmount) || 0
      
      // Build approval message for quotes
      let approvalMessage = ''
      if (isQuote) {
        if (approvalType === 'design') approvalMessage = 'Please review and approve the design.'
        else if (approvalType === 'price') approvalMessage = 'Please review and approve the quote.'
        else if (approvalType === 'both') approvalMessage = 'Please review and approve the design and quote.'
        else if (approvalType === 'custom' && customApprovalText) approvalMessage = customApprovalText
      }
      
      // Send Email
      if (sendEmail && customerEmail) {
        const emailRes = await fetch('/api/email', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            documentId: doc.id, 
            to: customerEmail, 
            subject: docLabel + ' from Frederick Wraps',
            includeLink: true,
            approvalMessage,
            depositAmount,
            includeLineAttachments,
            includeProjectAttachments
          }) 
        })
        const emailData = await emailRes.json()
        if (!emailData.success) {
          showToast('Email failed: ' + emailData.error, 'error')
        }
      }
      
      // Send SMS
      console.log('SMS Check - sendSms:', sendSms, 'customerPhone:', customerPhone)
      if (sendSms && customerPhone) {
        const smsBody = `Hi ${firstName}! Your ${docLabel} from Frederick Wraps is ready. ${approvalMessage ? approvalMessage + ' ' : ''}View it here: ${customerLink}`
        console.log('Attempting SMS to:', customerPhone, 'Body:', smsBody)
        
        try {
          const smsRes = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              to: customerPhone,
              message: smsBody
            })
          })
          console.log('SMS Response status:', smsRes.status)
          const smsData = await smsRes.json()
          console.log('SMS Response data:', smsData)
          if (!smsData.success) {
            showToast('SMS failed: ' + (smsData.error || JSON.stringify(smsData)), 'error')
          } else {
            console.log('SMS sent successfully!')
          }
        } catch (smsErr) {
          console.error('SMS fetch error:', smsErr)
          showToast('SMS error: ' + smsErr, 'error')
        }
      } else {
        console.log('SMS skipped - sendSms:', sendSms, 'customerPhone:', customerPhone)
      }
      
      // Update document with send options
      const sendOptions = {
        sms: sendSms,
        email: sendEmail,
        approvalType: isQuote ? approvalType : null,
        customApprovalText: approvalType === 'custom' ? customApprovalText : null,
        includeLineAttachments,
        includeProjectAttachments,
        paymentTerms,
        depositAmount,
        customerNotificationPref: notificationPref
      }
      
      await supabase.from('documents').update({ 
        status: 'sent', 
        sent_at: new Date().toISOString(),
        deposit_required: depositAmount,
        send_options_json: sendOptions
      }).eq('id', doc.id)
      
      setDoc({ ...doc, status: 'sent', sent_at: new Date().toISOString(), deposit_required: depositAmount })
      setShowSendModal(false)
      showToast('Sent successfully!', 'success')
      await appendHistory('Sent', `${doc.doc_type === 'quote' ? 'Quote' : 'Invoice'} sent to ${doc.customer_name}`)
      
    } catch (err) {
      showToast('Failed to send', 'error')
    }
    setSendingDocument(false)
  }

  const handleMarkApproved = async () => {
    if (!confirm('Mark this quote as approved? This will also convert it to an invoice.')) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, convertToInvoice: true })
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast('Quote approved and converted to invoice!', 'success')
        await appendHistory('Approved', 'Quote approved and converted to invoice')
        window.location.reload()
      } else {
        showToast('Failed to approve: ' + (data.error || 'Unknown error'), 'error')
      }
    } catch (err) {
      console.error('Approve error:', err)
      showToast('Failed to approve quote', 'error')
    }
    setSaving(false)
  }

  const handleConvertToInvoice = async () => {
    if (!confirm('Convert to invoice?')) return
    setSaving(true)
    await supabase.from('documents').update({ doc_type: 'invoice', status: 'pending' }).eq('id', doc.id)
    setDoc({ ...doc, doc_type: 'invoice', status: 'pending' })
    await appendHistory('Converted', 'Converted from quote to invoice')
    setSaving(false)
  }

  const handleArchive = async () => {
    setSaving(true)
    const bucketValue = archiveBucket === 'won' ? 'ARCHIVE_WON' : 'ARCHIVE_LOST'
    const reason = archiveBucket === 'lost' ? (archiveReason === 'OTHER' ? archiveOtherReason : archiveReason) : null
    
    await supabase.from('documents').update({ 
      status: 'archived', 
      bucket: bucketValue,
      archive_reason: reason
    }).eq('id', doc.id)
    
    setShowArchiveModal(false)
    await appendHistory('Archived', `Archived as ${archiveBucket}${reason ? ': ' + reason : ''}`)
    router.push(doc.doc_type === 'quote' ? '/quotes' : '/invoices')
    setSaving(false)
  }

  const handleMoveToCold = async () => {
    if (!confirm(`Move this ${doc.doc_type} to Cold?`)) return
    setSaving(true)
    await supabase.from('documents').update({ bucket: 'COLD' }).eq('id', doc.id)
    setDoc({ ...doc, bucket: 'COLD' })
    await appendHistory('Moved to Cold', 'Document moved to cold bucket')
    router.push(doc.doc_type === 'quote' ? '/quotes' : '/invoices')
    setSaving(false)
  }

  const handleSaveFulfillment = async () => {
    setSaving(true)
    await supabase.from('documents').update({
      fulfillment_type: fulfillmentType || null,
      fulfillment_details: fulfillmentDetails
    }).eq('id', doc.id)
    setDoc({ ...doc, fulfillment_type: fulfillmentType, fulfillment_details: fulfillmentDetails })
    await appendHistory('Fulfillment Updated', `Set to ${fulfillmentType ? fulfillmentType.replace(/_/g, ' ') : 'none'}`)
    setShowFulfillmentModal(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        showToast(`${doc.doc_type} #${doc.doc_number} deleted successfully`, 'success')
        setShowDeleteModal(false)
        // Use window.location for hard refresh to clear cache
        window.location.href = doc.doc_type === 'quote' ? '/quotes' : '/invoices'
      } else {
        showToast(result.error || 'Failed to delete document', 'error')
        setShowDeleteModal(false)
      }
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete document', 'error')
    }
    setDeleting(false)
  }

  const handleOpenScheduleModal = () => {
    // Build default title from document info
    const parts = []
    if (customerName) parts.push(customerName)
    if (vehicleDescription) parts.push(vehicleDescription)
    if (projectDescription) parts.push(projectDescription)
    const defaultTitle = parts.join(' ') || 'Scheduled Job'
    
    // Default to tomorrow for vehicle drop-off
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dropOffDate = tomorrow.toISOString().split('T')[0]
    
    // Default vehicle pickup 7 days later
    const pickupDate = new Date(tomorrow)
    pickupDate.setDate(pickupDate.getDate() + 7)
    const vehicleEndStr = pickupDate.toISOString().split('T')[0]
    
    // Default install starts day after drop-off, ends day before pickup
    const installStart = new Date(tomorrow)
    installStart.setDate(installStart.getDate() + 1)
    const installEnd = new Date(pickupDate)
    installEnd.setDate(installEnd.getDate() - 1)
    
    setScheduleTitle(defaultTitle)
    setVehicleStartDate(dropOffDate)
    setVehicleStartTime('09:00')
    setVehicleEndDate(vehicleEndStr)
    setVehicleEndTime('17:00')
    setInstallStartDate(installStart.toISOString().split('T')[0])
    setInstallStartTime('09:00')
    setInstallEndDate(installEnd.toISOString().split('T')[0])
    setInstallEndTime('17:00')
    setScheduleNotes('')
    setShowScheduleModal(true)
  }

  const handleScheduleEvent = async () => {
    if (!scheduleTitle || !vehicleStartDate || !vehicleEndDate || !installStartDate || !installEndDate) {
      showToast('Please fill in all required fields', 'error')
      return
    }
    
    setSchedulingEvent(true)
    
    try {
      // Vehicle On Site times (for Google Calendar)
      const vehicleStart = new Date(`${vehicleStartDate}T${vehicleStartTime}`).toISOString()
      const vehicleEnd = new Date(`${vehicleEndDate}T${vehicleEndTime}`).toISOString()
      
      // Install times (internal only)
      const installStart = new Date(`${installStartDate}T${installStartTime}`).toISOString()
      const installEnd = new Date(`${installEndDate}T${installEndTime}`).toISOString()
      
      // Create Google Calendar event (Vehicle On Site only)
      const calendarResponse = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scheduleTitle,
          description: `Vehicle On Site\n\nInstall: ${installStartDate} - ${installEndDate}\n\n${scheduleNotes}`,
          startTime: vehicleStart,
          endTime: vehicleEnd,
          customerName: customerName,
          customerPhone: customerPhone
        })
      })
      
      const calendarResult = await calendarResponse.json()
      
      if (!calendarResult.success) {
        showToast('Failed to create calendar event: ' + (calendarResult.error || 'Unknown error'), 'error')
        setSchedulingEvent(false)
        return
      }
      
      // Save to database with all date fields
      const { error: dbError } = await supabase.from('calendar_events').insert({
        google_event_id: calendarResult.eventId,
        event_type: 'Job',
        title: scheduleTitle,
        start_time: vehicleStart,
        end_time: vehicleEnd,
        vehicle_start: vehicleStartDate,
        vehicle_end: vehicleEndDate,
        install_start: installStartDate,
        install_end: installEndDate,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        vehicle_description: vehicleDescription || null,
        document_id: doc.id,
        status: 'Scheduled',
        notes: scheduleNotes || null
      })
      
      if (dbError) {
        console.error('DB error:', dbError)
        showToast('Event created in Google Calendar, but failed to save locally', 'error')
      } else {
        showToast('Event scheduled!', 'success')
      }
      
      setShowScheduleModal(false)
    } catch (err) {
      console.error('Schedule error:', err)
      showToast('Failed to schedule event', 'error')
    }
    
    setSchedulingEvent(false)
  }

  const handleMoveToProduction = async () => {
    if (!confirm('Move this invoice to Production? This will generate production tasks based on line item categories.')) return
    setSaving(true)

    try {
      // Call new API to generate tasks from templates
      const response = await fetch('/api/production/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: doc.id })
      })

      const result = await response.json()

      if (result.success) {
        // Update document status
        await supabase.from('documents').update({
          in_production: true,
          bucket: 'IN_PRODUCTION'
        }).eq('id', doc.id)

        setDoc({ ...doc, in_production: true, bucket: 'IN_PRODUCTION' })
        showToast(`Moved to Production! ${result.totalTasksCreated} tasks created across ${result.lineItemsProcessed} line items.`, 'success')
      } else {
        showToast(`Partial success: ${result.totalTasksCreated} tasks created. Errors: ${result.errors.join(', ')}`, 'error')
      }

    } catch (err) {
      console.error('Error moving to production:', err)
      showToast('Failed to move to production', 'error')
    }

    setSaving(false)
  }

  const handleMarkPaid = async () => {
    setSaving(true)
    await supabase.from('documents').update({ status: 'paid', paid_at: new Date().toISOString(), amount_paid: total, balance_due: 0 }).eq('id', doc.id)
    setDoc({ ...doc, status: 'paid', paid_at: new Date().toISOString(), amount_paid: total, balance_due: 0 })
    await appendHistory('Marked Paid', `Manually marked as paid in full`)
    setSaving(false)
  }

  const handleSendRevisionReply = async () => {
    if (!revisionReply.trim()) return
    setSendingRevision(true)
    
    try {
      const newRevision = {
        timestamp: new Date().toISOString(),
        from: 'fwg',
        name: 'FWG',
        message: revisionReply.trim(),
        sentSms: revisionSendSms
      }
      
      const updatedRevisions = [...revisions, newRevision]
      
      // Send SMS if checked
      if (revisionSendSms && customerPhone) {
        let smsMessage = revisionReply.trim()
        if (revisionIncludeLink) {
          smsMessage += `\n\nView your ${doc.doc_type}: ${window.location.origin}/view/${doc.id}`
        }
        
        await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customerPhone, message: smsMessage })
        })
      }
      
      // Save to database
      await supabase.from('documents').update({ revision_history_json: updatedRevisions }).eq('id', doc.id)
      
      setRevisions(updatedRevisions)
      setRevisionReply('')
      setRevisionSendSms(false)
      setRevisionIncludeLink(false)
      await appendHistory('Revision Reply Sent', revisionSendSms ? 'Reply sent with SMS notification' : 'Reply saved')
      
    } catch (err) {
      console.error('Revision reply error:', err)
      showToast('Failed to send reply', 'error')
    }
    
    setSendingRevision(false)
  }

  const handleRecordPayment = async () => {
    if (paymentAmount <= 0) return
    setRecordingPayment(true)
    
    try {
      // Insert payment record
      const { data: newPayment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          document_id: doc.id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          processor: paymentMethod === 'card' ? 'manual' : null,
          status: 'completed',
          read: true,
          notes: paymentNotes || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (paymentError) throw paymentError
      
      // Update document totals
      const newAmountPaid = actualAmountPaid + paymentAmount
      const newBalanceDue = total - newAmountPaid
      const isPaidInFull = newBalanceDue <= 0
      
      const { error: docError } = await supabase
        .from('documents')
        .update({
          status: isPaidInFull ? 'paid' : 'partial',
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalanceDue),
          paid_at: new Date().toISOString()
        })
        .eq('id', doc.id)
      
      if (docError) throw docError

      // Automation #1: Auto-move to production on payment (any payment amount)
      let automationRan = false
      if (paymentAmount > 0 && !doc.in_production) {
        const autoProductionEnabled = await isAutomationEnabled('auto_production_on_payment')

        if (autoProductionEnabled) {
          try {
            // Generate production tasks
            const taskResponse = await fetch('/api/production/generate-tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId: doc.id })
            })

            const taskResult = await taskResponse.json()

            if (taskResult.success) {
              // Move invoice to production
              await supabase
                .from('documents')
                .update({
                  in_production: true,
                  bucket: 'IN_PRODUCTION'
                })
                .eq('id', doc.id)

              automationRan = true
              console.log(`[Automation] Moved invoice #${doc.doc_number} to production (${taskResult.totalTasksCreated} tasks created)`)
              showToast(`Payment recorded! Auto-moved to production (${taskResult.totalTasksCreated} tasks created)`, 'success')
            }
          } catch (autoError) {
            console.error('[Automation] Failed to auto-move to production:', autoError)
            // Don't fail the payment process if automation fails - continue normally
          }
        }
      }

      // Auto-sync payment to Google Sheets
      try {
        const syncRes = await fetch('/api/payments/sync-to-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: newPayment.id })
        })
        const syncResult = await syncRes.json()
        if (syncResult.success && syncResult.rowsAdded > 0) {
          console.log(`✓ Auto-synced payment to Google Sheets: ${syncResult.rowsAdded} row(s)`)
        }
      } catch (syncErr) {
        console.error('Auto-sync to Google Sheets failed:', syncErr)
        // Don't fail the payment process if sheet sync fails
      }

      // Update local state
      setPayments([newPayment, ...payments])
      setDoc({
        ...doc,
        in_production: automationRan ? true : doc.in_production,
        bucket: automationRan ? 'IN_PRODUCTION' : doc.bucket,
        status: isPaidInFull ? 'paid' : 'partial',
        amount_paid: newAmountPaid,
        balance_due: Math.max(0, newBalanceDue),
        paid_at: isPaidInFull ? new Date().toISOString() : doc.paid_at
      })
      setShowRecordPaymentModal(false)
      const methodLabel = paymentMethod === 'card' ? 'Credit Card' : paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'check' ? 'Check' : 'Other'
      await appendHistory('Payment Recorded', `$${paymentAmount.toFixed(2)} via ${methodLabel}${isPaidInFull ? ' — Paid in full' : ''}`)
      
    } catch (err) {
      console.error('Error recording payment:', err)
      showToast('Failed to record payment', 'error')
    }
    
    setRecordingPayment(false)
  }

  // ============================================================================
  // APPAREL / SIZE HELPERS
  // ============================================================================
  const ALL_SIZES = [
    '6M','12M','18M','24M','2T','3T','4T','5T',
    'Youth-XS','Youth-S','Youth-M','Youth-L','Youth-XL',
    'XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL',
  ]

  const isApparelCategory = (categoryKey: string) => {
    const cat = getCategoryByKey(categoryKey)
    return cat?.apparel_mode === true
  }

  const getApparelFields = (item: LineItem) => {
    return (item.custom_fields || {}) as {
      apparel_mode?: boolean
      color?: string
      item_number?: string
      enabled_sizes?: string[]
      sizes?: Record<string, { qty: number; price: number }>
    }
  }

  const recalcApparelTotals = (sizes: Record<string, { qty: number; price: number }>) => {
    let totalQty = 0
    let totalAmount = 0
    for (const s of Object.values(sizes)) {
      totalQty += s.qty || 0
      totalAmount += (s.qty || 0) * (s.price || 0)
    }
    return { totalQty, totalAmount: Math.round(totalAmount * 100) / 100 }
  }

  const updateApparelField = async (itemId: string, fieldPath: string, value: any) => {
    const newItems = lineItems.map(item => {
      if (item.id !== itemId) return item
      const cf: Record<string, any> = { ...(item.custom_fields || {}), apparel_mode: true }

      if (fieldPath === 'color' || fieldPath === 'item_number' || fieldPath === 'enabled_sizes') {
        cf[fieldPath] = value
      } else if (fieldPath.startsWith('size.')) {
        // e.g. size.XL.qty or size.XL.price
        const parts = fieldPath.split('.')
        const sizeName = parts[1]
        const sizeField = parts[2] // 'qty' or 'price'
        const sizes = { ...(cf.sizes || {}) }
        sizes[sizeName] = { ...(sizes[sizeName] || { qty: 0, price: 0 }), [sizeField]: value }
        cf.sizes = sizes
      }

      // Recalculate totals from sizes
      const { totalQty, totalAmount } = recalcApparelTotals(cf.sizes || {})
      return {
        ...item,
        custom_fields: cf,
        quantity: totalQty,
        sqft: totalQty,
        line_total: totalAmount,
        unit_price: totalQty > 0 ? Math.round((totalAmount / totalQty) * 100) / 100 : 0,
        rate: totalQty > 0 ? Math.round((totalAmount / totalQty) * 100) / 100 : 0,
      }
    })
    setLineItems(newItems)

    const updatedItem = newItems.find(i => i.id === itemId)
    if (updatedItem) {
      await supabase.from('line_items').update({
        quantity: updatedItem.quantity,
        sqft: updatedItem.sqft,
        unit_price: updatedItem.unit_price,
        rate: updatedItem.rate,
        line_total: updatedItem.line_total,
        custom_fields: updatedItem.custom_fields,
      }).eq('id', itemId)
    }
    updateDocumentTotals(newItems)
  }

  // ============================================================================
  // SS ACTIVEWEAR INTEGRATION HANDLERS
  // ============================================================================

  // Helper to strip HTML tags from text
  const stripHtml = (html: string): string => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  // Handle SS product selection
  const handleSSProductSelect = async (itemId: string, product: any) => {
    console.log('🔍 handleSSProductSelect called:', { itemId, product })
    try {
      // Fetch full product details including colors and sizes
      const response = await fetch(`/api/suppliers/ss/style/${product.styleID}`)
      const data = await response.json()
      console.log('📦 SS Style Detail API Response:', data)

      if (data.success && data.data) {
        const styleDetail = data.data
        console.log('✅ Setting SS product cache:', styleDetail)

        // Cache the product data
        setSsProductCache(prev => ({
          ...prev,
          [itemId]: styleDetail
        }))

        // Update item number
        await updateApparelField(itemId, 'item_number', product.styleName)

        // Clear color to force user selection
        await updateApparelField(itemId, 'color', '')

        // Update description with product title from SS API
        const item = lineItems.find(i => i.id === itemId)
        if (item) {
          // Use the title field from SS API (e.g., "Unisex Heavy Cotton™ T-Shirt")
          updateLineItem(itemId, 'description', styleDetail.title || styleDetail.styleName)
        }

        showToast(`Select a color for ${styleDetail.styleName}`, 'info')
      }
    } catch (error) {
      console.error('Error fetching SS product:', error)
      showToast('Failed to load product details', 'error')
    }
  }

  // Open mockup builder for a line item
  const handleOpenMockupBuilder = (itemId: string) => {
    const item = lineItems.find(i => i.id === itemId)
    if (!item) return

    const af = getApparelFields(item)
    const cachedProduct = ssProductCache[itemId]

    // Get garment image URL from cached product data
    let garmentImageUrl = ''
    let garmentName = af.item_number || 'Garment'
    let colorName = af.color || ''

    if (cachedProduct) {
      // Find the color that matches the selected color
      const selectedColor = cachedProduct.colors?.find((c: any) => c.colorName === colorName)
      // colorImages is an array, get the first image if available
      const relativePath = selectedColor?.colorImages?.[0] || cachedProduct.productThumbnail || ''
      // SS images are relative paths - prepend the base URL
      garmentImageUrl = relativePath ? `https://www.ssactivewear.com/${relativePath}` : ''
      garmentName = cachedProduct.styleName || garmentName
    }

    if (!garmentImageUrl) {
      showToast('Please select a product with a garment image first', 'error')
      return
    }

    setMockupLineItemId(itemId)
    setMockupGarmentUrl(garmentImageUrl)
    setMockupGarmentName(garmentName)
    setMockupColorName(colorName)
    setMockupBuilderOpen(true)
  }

  // Save mockup as line item attachment
  const handleSaveMockup = async (mockupDataUrl: string) => {
    if (!mockupLineItemId) return

    try {
      // Convert data URL to blob
      const response = await fetch(mockupDataUrl)
      const blob = await response.blob()

      // Create a File object from the blob
      const fileName = `mockup_${mockupGarmentName}_${mockupColorName}_${Date.now()}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      // Upload using existing upload API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentId', doc.id)
      formData.append('prefix', 'doc-line-item')
      formData.append('lineItemId', mockupLineItemId)

      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadResponse.json()

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed')
      }

      // Add attachment to line item
      const item = lineItems.find(i => i.id === mockupLineItemId)
      if (!item) return

      const newAttachment = {
        url: uploadData.url,
        key: uploadData.key,
        filename: uploadData.filename || fileName,
        contentType: uploadData.contentType || 'image/png',
        size: uploadData.size || blob.size,
        uploadedAt: new Date().toISOString()
      }

      const updatedAttachments = [...(item.attachments || []), newAttachment]

      // Update line item in database
      const { error: updateError } = await supabase
        .from('line_items')
        .update({ attachments: updatedAttachments })
        .eq('id', mockupLineItemId)

      if (updateError) throw updateError

      // Update local state
      setLineItems(lineItems.map(i =>
        i.id === mockupLineItemId
          ? { ...i, attachments: updatedAttachments }
          : i
      ))

      showToast('Mockup saved successfully', 'success')
      setMockupBuilderOpen(false)
      setMockupLineItemId(null)
    } catch (error) {
      console.error('Error saving mockup:', error)
      showToast('Failed to save mockup', 'error')
    }
  }

  // ============================================================================
  // LINE ITEM HANDLERS
  // ============================================================================
  const addSection = async (categoryKey: string) => {
    setShowSectionModal(false)
    const groupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    const newGroups = [...lineItemGroups, { group_id: groupId, category_key: categoryKey }]
    setLineItemGroups(newGroups)

    const category = getCategoryByKey(categoryKey)
    const isApparel = category?.apparel_mode === true
    const newItem: any = {
      document_id: doc.id,
      group_id: groupId,
      category: categoryKey,
      line_type: '',
      package_key: '',
      description: '',
      quantity: isApparel ? 0 : 1,
      sqft: 0,
      unit_price: isApparel ? 0 : (category?.default_rate || 0),
      rate: isApparel ? 0 : (category?.default_rate || 0),
      line_total: 0,
      sort_order: lineItems.length,
      ...(isApparel ? { custom_fields: { apparel_mode: true, color: '', item_number: '', enabled_sizes: [], sizes: {} } } : {}),
    }
    
    const { data, error } = await supabase.from('line_items').insert(newItem).select().single()
    if (data) {
      setLineItems([...lineItems, data as LineItem])
    }
  }

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Delete this section and all its items?')) return

    console.log('🗑️ deleteGroup called:', groupId)

    // Delete all line items in this group from database
    const { error: itemsError } = await supabase
      .from('line_items')
      .delete()
      .eq('group_id', groupId)

    if (itemsError) {
      console.error('❌ Failed to delete line items:', itemsError)
      showToast('Failed to delete line items', 'error')
      return
    }

    console.log('✅ All line items in group deleted from database')

    // Update state (groups are derived from line items, so just remove the group from state)
    setLineItemGroups(lineItemGroups.filter(g => g.group_id !== groupId))
    const newItems = lineItems.filter(i => i.group_id !== groupId)
    setLineItems(newItems)
    updateDocumentTotals(newItems)
  }

  const addLineItemToGroup = async (groupId: string, categoryKey: string) => {
    console.log('➕ addLineItemToGroup called:', { groupId, categoryKey })
    const category = getCategoryByKey(categoryKey)
    const isApparel = category?.apparel_mode === true
    const newItem: any = {
      document_id: doc.id,
      group_id: groupId,
      category: categoryKey,
      line_type: '',
      package_key: '',
      description: '',
      quantity: isApparel ? 0 : 1,
      sqft: 0,
      unit_price: isApparel ? 0 : (category?.default_rate || 0),
      rate: isApparel ? 0 : (category?.default_rate || 0),
      line_total: 0,
      sort_order: lineItems.length,
      ...(isApparel ? { custom_fields: { apparel_mode: true, color: '', item_number: '', enabled_sizes: [], sizes: {} } } : {}),
    }
    
    const { data, error } = await supabase.from('line_items').insert(newItem).select().single()
    if (data) {
      setLineItems([...lineItems, data as LineItem])
    }
  }

  const updateLineItem = async (itemId: string, field: string, value: any) => {
    const newItems = lineItems.map(item => {
      if (item.id !== itemId) return item
      const updated = { ...item, [field]: value }
      
      // Handle package selection
      if (field === 'package_key' && value) {
        const pkg = packages.find(p => p.package_key === value)
        if (pkg) {
          updated.description = pkg.label + (pkg.description ? ' - ' + pkg.description : '')
          updated.sqft = pkg.sqft_estimate
          updated.rate = pkg.rate_per_sqft
          updated.unit_price = pkg.rate_per_sqft
          updated.quantity = pkg.sqft_estimate
          updated.line_total = pkg.sqft_estimate * pkg.rate_per_sqft
        }
      }
      
      // Handle type selection
      if (field === 'line_type' && value) {
        const type = lineItemTypes.find(t => t.type_key === value)
        if (type) {
          updated.rate = type.default_rate
          updated.unit_price = type.default_rate
        }
      }
      
      // Recalculate total for qty/sqft/rate changes
      if (['quantity', 'sqft', 'unit_price', 'rate'].includes(field)) {
        const qty = field === 'sqft' ? value : (updated.sqft || updated.quantity || 1)
        const rate = field === 'unit_price' || field === 'rate' ? value : (updated.rate || updated.unit_price || 0)
        updated.line_total = qty * rate
        if (field === 'sqft') updated.quantity = value
        if (field === 'rate') updated.unit_price = value
        if (field === 'unit_price') updated.rate = value
      }
      
      return updated
    })
    setLineItems(newItems)
    
    // Save to database
    const updatedItem = newItems.find(i => i.id === itemId)
    if (updatedItem) {
      await supabase.from('line_items').update({
        description: updatedItem.description,
        category: updatedItem.category,
        line_type: updatedItem.line_type,
        package_key: updatedItem.package_key,
        quantity: updatedItem.quantity,
        sqft: updatedItem.sqft,
        unit_price: updatedItem.unit_price,
        rate: updatedItem.rate,
        line_total: updatedItem.line_total,
        taxable: updatedItem.taxable || false,
        custom_fields: updatedItem.custom_fields || null
      }).eq('id', itemId)
    }
    
    updateDocumentTotals(newItems)
  }

  const deleteLineItem = async (itemId: string) => {
    alert(`🗑️ DELETE CLICKED - Item ID: ${itemId}`)
    console.log('🗑️ deleteLineItem called:', itemId)
    const { error } = await supabase.from('line_items').delete().eq('id', itemId)
    if (error) {
      console.error('❌ Delete failed:', error)
      showToast('Failed to delete line item', 'error')
      return
    }
    console.log('✅ Line item deleted from database')
    const newItems = lineItems.filter(i => i.id !== itemId)
    setLineItems(newItems)
    // Remove empty groups
    const usedGroupIds = new Set(newItems.map(i => i.group_id))
    setLineItemGroups(lineItemGroups.filter(g => usedGroupIds.has(g.group_id)))
    updateDocumentTotals(newItems)
  }

  const updateDocumentTotals = async (items: LineItem[]) => {
    const newSubtotal = items.reduce((sum, i) => sum + (i.line_total || 0), 0)
    const newTotal = newSubtotal + feesTotal - discountAmount + taxAmount
    await supabase.from('documents').update({ subtotal: newSubtotal, total: newTotal }).eq('id', doc.id)
  }

  // ============================================================================
  // FILE HANDLERS
  // ============================================================================
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
        const response = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await response.json()
        if (data.success) newAttachments.push({ url: data.url, key: data.key, filename: data.filename, contentType: data.contentType, size: data.size, uploadedAt: new Date().toISOString() })
      } catch (err) { console.error(err) }
    }
    if (newAttachments.length > 0) {
      const updated = [...attachments, ...newAttachments]
      setAttachments(updated)
      await supabase.from('documents').update({ attachments: updated }).eq('id', doc.id)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleLineItemAttachment = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    const item = lineItems.find(i => i.id === itemId)
    if (!item) return
    
    const newAttachments: Attachment[] = [...(item.attachments || [])]
    
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentId', doc.id)
      formData.append('prefix', 'doc-line-item')
      formData.append('lineItemId', itemId)
      
      try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await response.json()
        if (data.success) {
          newAttachments.push({
            url: data.url,
            key: data.key,
            filename: data.filename || file.name,
            contentType: data.contentType || file.type,
            size: data.size || file.size,
            uploadedAt: new Date().toISOString()
          })
        }
      } catch (err) {
        console.error('Upload error:', err)
      }
    }
    
    // Update line item with new attachments
    const updatedItems = lineItems.map(i => i.id === itemId ? { ...i, attachments: newAttachments } : i)
    setLineItems(updatedItems)
    
    // Save to database
    await supabase.from('line_items').update({ attachments: newAttachments }).eq('id', itemId)
    
    // Reset file input
    e.target.value = ''
  }

  const handleDeleteLineItemAttachment = async (itemId: string, fileId: string) => {
    if (!confirm('Delete this attachment?')) return
    
    const item = lineItems.find(i => i.id === itemId)
    if (!item) return
    
    const currentAttachments = item.attachments || []
    const updatedAttachments = currentAttachments.filter((att, idx) => (att.file_id || att.key || String(idx)) !== fileId)
    
    // Update local state
    const updatedItems = lineItems.map(i => i.id === itemId ? { ...i, attachments: updatedAttachments } : i)
    setLineItems(updatedItems)
    
    // Save to database
    await supabase.from('line_items').update({ attachments: updatedAttachments }).eq('id', itemId)
  }

  const handleDeleteAttachment = async (key: string) => {
    const updated = attachments.filter(a => a.key !== key)
    setAttachments(updated)
    await supabase.from('documents').update({ attachments: updated }).eq('id', doc.id)
  }

  // ============================================================================
  // FEE HANDLERS
  // ============================================================================
  const addFee = async () => {
    const newFees = [...fees, { fee_type: '', description: '', amount: 0 }]
    setFees(newFees)
    await supabase.from('documents').update({ fees: newFees }).eq('id', doc.id)
  }
  
  const updateFee = async (index: number, field: string, value: any) => {
    const newFees = [...fees]
    newFees[index] = { ...newFees[index], [field]: value }
    if (field === 'fee_type' && value) {
      const feeType = feeTypes.find(ft => ft.fee_type_key === value)
      if (feeType) {
        if (!newFees[index].description) newFees[index].description = feeType.label
        if (!newFees[index].amount) newFees[index].amount = feeType.default_amount
      }
    }
    setFees(newFees)
    
    // Calculate new totals
    const newFeesTotal = newFees.reduce((sum, f) => sum + (f.amount || 0), 0)
    const newTotal = subtotal + newFeesTotal - discountAmount + taxAmount
    await supabase.from('documents').update({ fees: newFees, total: newTotal }).eq('id', doc.id)
  }
  
  const deleteFee = async (index: number) => {
    const newFees = fees.filter((_, i) => i !== index)
    setFees(newFees)
    
    // Calculate new totals
    const newFeesTotal = newFees.reduce((sum, f) => sum + (f.amount || 0), 0)
    const newTotal = subtotal + newFeesTotal - discountAmount + taxAmount
    await supabase.from('documents').update({ fees: newFees, total: newTotal }).eq('id', doc.id)
  }

  const handleDiscountChange = async () => {
    const newTotal = subtotal + feesTotal - (discountAmountInput || (subtotal * discountPercentInput / 100)) + taxAmountInput
    await supabase.from('documents').update({ 
      discount_amount: discountAmountInput, 
      discount_percent: discountPercentInput,
      discount_note: discountNote,
      total: newTotal 
    }).eq('id', doc.id)
    setDoc({ ...doc, discount_amount: discountAmountInput, discount_percent: discountPercentInput, discount_note: discountNote, total: newTotal })
  }

  const handleTaxChange = async () => {
    const discount = discountAmountInput || (subtotal * discountPercentInput / 100)
    const newTotal = subtotal + feesTotal - discount + taxAmountInput
    await supabase.from('documents').update({ tax_amount: taxAmountInput, total: newTotal }).eq('id', doc.id)
    setDoc({ ...doc, tax_amount: taxAmountInput, total: newTotal })
  }

  const handleSaveAll = async () => {
    setSaving(true)
    const discount = discountAmountInput || (subtotal * discountPercentInput / 100)
    const newTotal = subtotal + feesTotal - discount + taxAmountInput
    
    const updates = {
      customer_name: customerName,
      company_name: companyName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      vehicle_description: vehicleDescription,
      project_description: projectDescription,
      discount_amount: discountAmountInput,
      discount_percent: discountPercentInput,
      tax_amount: taxAmountInput,
      deposit_required: depositRequired,
      valid_until: validUntil || null,
      notes: notes,
      subtotal: subtotal,
      total: newTotal,
      fees: fees
    }
    
    const { error } = await supabase.from('documents').update(updates).eq('id', doc.id)
    if (!error) {
      setDoc({ ...doc, ...updates })
      setHasChanges(false)
      // Saved successfully - no toast needed
    } else {
      showToast('Save failed: ' + error.message, 'error')
    }
    setSaving(false)
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  const getStatusStyle = (s: string) => {
    const status = s?.toLowerCase() || ''
    if (status === 'draft') return { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' }
    if (status === 'sent') return { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' }
    if (status === 'viewed') return { bg: 'rgba(168,85,247,0.2)', color: '#a855f7' }
    if (status === 'approved' || status === 'paid') return { bg: 'rgba(34,197,94,0.2)', color: '#22c55e' }
    if (status === 'declined' || status === 'overdue') return { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' }
    if (status === 'pending' || status === 'partial') return { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b' }
    return { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' }
  }

  const statusStyle = getStatusStyle(doc.status)
  const isQuote = doc.doc_type === 'quote'
  const isInvoice = doc.doc_type === 'invoice'

  // Styles
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const cardStyle: React.CSSProperties = { background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }
  const btnSecondary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s ease' }
  const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 0 20px rgba(215, 28, 209, 0.3)' }
  const btnSuccess: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }

  // Button hover/click handlers
  const btnHover = (e: React.MouseEvent<HTMLButtonElement>, type: 'primary' | 'secondary' | 'success') => {
    const btn = e.currentTarget
    btn.style.transform = 'translateY(-2px) scale(1.02)'
    if (type === 'primary') btn.style.boxShadow = '0 0 30px rgba(215, 28, 209, 0.5)'
    else if (type === 'success') btn.style.boxShadow = '0 0 30px rgba(34, 197, 94, 0.5)'
    else btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
  }
  const btnLeave = (e: React.MouseEvent<HTMLButtonElement>, type: 'primary' | 'secondary' | 'success') => {
    const btn = e.currentTarget
    btn.style.transform = 'translateY(0) scale(1)'
    if (type === 'primary') btn.style.boxShadow = '0 0 20px rgba(215, 28, 209, 0.3)'
    else if (type === 'success') btn.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.3)'
    else btn.style.boxShadow = 'none'
  }
  const btnDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'translateY(0) scale(0.97)'
  }
  const btnUp = (e: React.MouseEvent<HTMLButtonElement>, type: 'primary' | 'secondary' | 'success') => {
    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
  }

  // Get categories grouped by parent
  const automotiveCategories = categories.filter(c => c.parent_category === 'AUTOMOTIVE' && c.active).sort((a, b) => a.sort_order - b.sort_order)
  const signageCategories = categories.filter(c => c.parent_category === 'SIGNAGE' && c.active).sort((a, b) => a.sort_order - b.sort_order)
  const apparelCategories = categories.filter(c => c.parent_category === 'APPAREL' && c.active).sort((a, b) => a.sort_order - b.sort_order)

  const getTabCategories = () => {
    if (sectionModalTab === 'AUTOMOTIVE') return automotiveCategories
    if (sectionModalTab === 'SIGNAGE') return signageCategories
    if (sectionModalTab === 'APPAREL') return apparelCategories
    return []
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', paddingBottom: '100px' }}>
      <style>{`
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .action-btn:hover:not(:disabled) {
          transform: translateY(-4px) scale(1.05) !important;
        }
        .action-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.97) !important;
        }
        .action-btn-secondary {
          background: #282a30;
          border: 1px solid rgba(148,163,184,0.2);
          color: #94a3b8;
        }
        .action-btn-secondary:hover:not(:disabled) {
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .action-btn-primary {
          background: linear-gradient(135deg, #d71cd1, #8b5cf6);
          border: none;
          color: white;
          font-weight: 600;
          box-shadow: 0 0 20px rgba(215, 28, 209, 0.3);
        }
        .action-btn-primary:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(215, 28, 209, 0.6) !important;
        }
        .action-btn-success {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
          color: white;
          font-weight: 600;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
        }
        .action-btn-success:hover:not(:disabled) {
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.6) !important;
  }
  .action-btn-success-outline {
    background: transparent !important;
    border: 2px solid #22c55e !important;
    color: #22c55e !important;
    font-weight: 600;
  }
  .action-btn-success-outline:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.1) !important;
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.3) !important;
  }
  .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Remove spinner arrows from number inputs */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 600, margin: 0 }}>{isQuote ? 'Quote' : 'Invoice'} Details</h1>
        <ActionButton onClick={handleRefresh} variant="secondary">{refreshing ? 'Refreshing...' : 'Refresh'}</ActionButton>
      </div>

      {/* Document Header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, margin: 0 }}>{isQuote ? 'Quote' : 'Invoice'} # {doc.doc_number}</h2>
              <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', background: isQuote ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)', color: isQuote ? '#3b82f6' : '#22c55e' }}>{doc.doc_type}</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>
              Status: <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, background: statusStyle.bg, color: statusStyle.color, textTransform: 'capitalize', marginLeft: '4px' }}>{doc.status || 'Draft'}</span>
              <span style={{ margin: '0 8px' }}>-</span>Created: {formatDate(doc.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(() => {
              const isArchived = doc.bucket === 'ARCHIVE_WON' || doc.bucket === 'ARCHIVE_LOST'
              const hasBeenSent = doc.sent_at || doc.status === 'sent' || doc.status === 'viewed'
              const isCold = doc.bucket === 'COLD'
              const inProduction = doc.in_production === true
              const buttons = []
              
              // Copy Link - always show
              buttons.push(<ActionButton key="copy" onClick={handleCopyLink} variant="secondary">{linkCopied ? 'Copied!' : 'Copy Link'}</ActionButton>)

              // Send to Zayn - show for embroidery documents
              if (hasEmbroideryItems) {
                buttons.push(
                  <ActionButton key="zayn" onClick={() => {
                    setZaynSelectedFiles(attachments.map(a => ({ url: a.url, filename: a.filename })))
                    setShowZaynModal(true)
                  }} variant="secondary" style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    Send to Zayn
                  </ActionButton>
                )
              }

              // Message Button - show if customer has phone
              if (customerPhone) {
                buttons.push(
                  <ActionButton key="message" onClick={handleOpenMessageHub} variant="secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Message
                  </ActionButton>
                )
              }

              // Call Button - show if customer has phone
              if (customerPhone) {
                buttons.push(
                  <ActionButton key="call" onClick={handleCallCustomer} variant="secondary" style={{ color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    Call
                  </ActionButton>
                )
              }

              if (isQuote) {
                // Send (unless declined/expired/archived)
                if (doc.status !== 'declined' && doc.status !== 'expired' && !isArchived) {
                  buttons.push(<ActionButton key="send" onClick={handleOpenSendModal} disabled={saving || (!customerEmail && !customerPhone)} variant="secondary">Send</ActionButton>)
                }
                // Follow Up (if sent, not approved/declined/expired/archived)
                if (hasBeenSent && !isArchived && doc.status !== 'approved' && doc.status !== 'declined' && doc.status !== 'expired') {
                  buttons.push(<ActionButton key="followup" onClick={handleOpenFollowUpModal} variant="secondary">Follow Up{doc.followup_count ? ` (${doc.followup_count})` : ''}</ActionButton>)
                }
                // Mark Approved (unless already approved/declined/expired/archived)
                if (doc.status !== 'approved' && doc.status !== 'declined' && doc.status !== 'expired' && !isArchived) {
                  buttons.push(<ActionButton key="approve" onClick={handleMarkApproved} disabled={saving} variant="success-outline">Mark Approved</ActionButton>)
                }
                // Convert to Invoice (unless declined/expired/archived)
                if (doc.status !== 'declined' && doc.status !== 'expired' && !isArchived) {
                  buttons.push(<ActionButton key="convert" onClick={handleConvertToInvoice} disabled={saving} variant="success">Convert to Invoice</ActionButton>)
                }
              }
              
              if (isInvoice) {
                // Send (unless void/paid/archived)
                if (doc.status !== 'void' && doc.status !== 'paid' && !isArchived) {
                  buttons.push(<ActionButton key="send" onClick={handleOpenSendModal} disabled={saving || (!customerEmail && !customerPhone)} variant="secondary">Send</ActionButton>)
                }
                // Follow Up (if sent, not paid/void/archived)
                if (hasBeenSent && !isArchived && doc.status !== 'paid' && doc.status !== 'void') {
                  buttons.push(<ActionButton key="followup" onClick={handleOpenFollowUpModal} variant="secondary">Follow Up{doc.followup_count ? ` (${doc.followup_count})` : ''}</ActionButton>)
                }
                // Fulfillment Type (unless archived)
                if (!isArchived) {
                  buttons.push(<ActionButton key="fulfillment" onClick={() => setShowFulfillmentModal(true)} variant="secondary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>{doc.fulfillment_type ? doc.fulfillment_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Set Fulfillment'}</ActionButton>)
                }
                // Schedule It (unless archived)
                if (!isArchived) {
                  buttons.push(<ActionButton key="schedule" onClick={handleOpenScheduleModal} variant="primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Schedule It</ActionButton>)
                }
                // Move to Production (unless archived or already in production)
                if (!isArchived && !inProduction) {
                  buttons.push(<ActionButton key="production" onClick={handleMoveToProduction} disabled={saving} variant="primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>Move to Production</ActionButton>)
                }
              }
              
              // Move to Cold (if sent, not archived, not already cold)
              if (!isArchived && !isCold && hasBeenSent) {
                buttons.push(<ActionButton key="cold" onClick={handleMoveToCold} disabled={saving} variant="secondary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4m12 0h4M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>Move to Cold</ActionButton>)
              }
              
              // Archive (unless already archived)
              if (!isArchived) {
                buttons.push(<ActionButton key="archive" onClick={() => { setArchiveBucket(doc.status === 'paid' ? 'won' : 'lost'); setArchiveReason(''); setArchiveOtherReason(''); setShowArchiveModal(true) }} disabled={saving} variant="secondary">Archive</ActionButton>)
              }

              // Delete - always show
              buttons.push(
                <ActionButton
                  key="delete"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={saving}
                  variant="secondary"
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Delete
                </ActionButton>
              )

              return buttons
            })()}
          </div>
        </div>
      </div>

      {/* Revision Request Banner */}
      {doc.status === 'revision_requested' && revisions.length > 0 && (() => {
        const latestRevision = revisions[revisions.length - 1]
        const contactPref = (latestRevision as any).contactPreference || 'sms'
        return (
          <div style={{
            background: 'rgba(251, 146, 60, 0.15)',
            border: '2px solid #fb923c',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              background: 'rgba(251, 146, 60, 0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: '#fb923c', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase' }}>Revision Requested</span>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '11px', 
                  fontWeight: 600,
                  background: contactPref === 'email' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)',
                  color: contactPref === 'email' ? '#3b82f6' : '#22c55e'
                }}>
                  Prefers {contactPref === 'email' ? 'Email' : 'SMS'}
                </span>
              </div>
              <div style={{ color: '#f1f5f9', fontSize: '14px', lineHeight: 1.5, marginBottom: '12px' }}>
                "{latestRevision.message}"
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <ActionButton 
                  onClick={() => router.push(`/messages?phone=${encodeURIComponent(customerPhone)}`)} 
                  variant="primary" 
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Reply via SMS
                </ActionButton>
                <ActionButton 
                  onClick={() => {}} 
                  variant="secondary" 
                  style={{ padding: '8px 16px', fontSize: '13px', opacity: 0.5, cursor: 'not-allowed' }}
                  disabled
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Reply via Email
                </ActionButton>
              </div>
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', flexShrink: 0 }}>
              {new Date(latestRevision.timestamp).toLocaleString()}
            </div>
          </div>
        )
      })()}

      {/* Customer Information */}
      <div style={cardStyle}>
        <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0' }}>Customer Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Customer Name *</label>
            <input type="text" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerSearch(e.target.value) }} onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)} placeholder="Full name" style={inputStyle} />
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', marginTop: '4px', zIndex: 100, maxHeight: '200px', overflow: 'auto' }}>
                {filteredCustomers.map(c => (
                  <div key={c.id} onClick={() => handleSelectCustomer(c)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(148,163,184,0.1)' }} onMouseEnter={e => (e.currentTarget.style.background = '#282a30')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{c.display_name || c.first_name + ' ' + c.last_name}</div>
                    {c.company && <div style={{ color: '#64748b', fontSize: '12px' }}>{c.company}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div><label style={labelStyle}>Company</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" style={inputStyle} /></div>
          <div><label style={labelStyle}>Email</label><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" style={inputStyle} /></div>
          <div><label style={labelStyle}>Phone</label><input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(240) 555-1234" style={inputStyle} /></div>
        </div>
        <div style={{ marginTop: '16px' }}><label style={labelStyle}>Vehicle / Subject</label><input type="text" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} placeholder="e.g., 2024 Ford Transit - White" style={inputStyle} /></div>
        <div style={{ marginTop: '16px' }}><label style={labelStyle}>Project Description</label><textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Describe the project scope..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        {hasChanges && <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}><button onClick={handleSaveDocument} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Changes'}</button></div>}
      </div>

      {/* Project Files */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0 }}>Project Files</h3></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {attachments.map((a) => (
            <div key={a.key} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', overflow: 'hidden', cursor: 'pointer' }} onClick={() => a.contentType?.startsWith('image/') ? openLightbox(a) : window.open(a.url, '_blank')}>
              {a.contentType?.startsWith('image/') ? <img src={a.url} alt={a.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '10px' }}>{a.filename?.split('.').pop()?.toUpperCase()}</div>}
              <button onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(a.key) }} style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
            </div>
          ))}
          <label style={{ width: '80px', height: '80px', borderRadius: '8px', border: '2px dashed rgba(148,163,184,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '11px' }}>
            <span style={{ fontSize: '20px' }}>+</span><span>Add</span>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Embroidery Info Banner */}
      {hasEmbroideryItems && matchedCustomer && (matchedCustomer.emb_thread_colors || matchedCustomer.emb_drive_folder_url) && (
        <div style={{ ...cardStyle, border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(139, 92, 246, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              Embroidery Info
            </h3>
            {matchedCustomer.emb_drive_folder_url && (
              <a href={matchedCustomer.emb_drive_folder_url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                EMB Drive Folder
              </a>
            )}
          </div>
          {matchedCustomer.emb_thread_colors && (
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Thread Colors: </span>
              <span style={{ color: '#f1f5f9', fontSize: '13px' }}>{matchedCustomer.emb_thread_colors}</span>
            </div>
          )}
        </div>
      )}

      {/* Options Mode Toggle */}
      {isQuote && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>Quote Mode</h3>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                {optionsMode 
                  ? 'Options mode: Customer will choose from multiple options' 
                  : 'Standard mode: Traditional quote with line items'}
              </p>
            </div>
            <button
              onClick={async () => {
                const newMode = !optionsMode
                setOptionsMode(newMode)
                const updateData: any = { options_mode: newMode }
                if (!newMode && ['option_selected', 'viewed', 'sent'].includes(doc.status)) {
                  updateData.status = 'draft'
                }
                await supabase.from('documents').update(updateData).eq('id', doc.id)
                if (updateData.status) {
                  window.location.reload()
                }
              }}
              style={{
                padding: '10px 20px',
                background: optionsMode ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#282a30',
                border: optionsMode ? 'none' : '1px solid rgba(148,163,184,0.2)',
                borderRadius: '8px',
                color: optionsMode ? 'white' : '#94a3b8',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              {optionsMode ? 'Options Mode ON' : 'Options Mode OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Options Builder (when in options mode) */}
      {isQuote && optionsMode && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0 }}>Options</h3>
            <button
              onClick={async () => {
                const newOption: QuoteOption = {
                  id: 'opt_' + Date.now(),
                  title: `Option ${options.length + 1}`,
                  description: '',
                  price_min: 0,
                  price_max: undefined,
                  attachments: [],
                  sort_order: options.length
                }
                const updated = [...options, newOption]
                setOptions(updated)
                await supabase.from('documents').update({ options_json: updated }).eq('id', doc.id)
              }}
              style={{
                padding: '8px 16px',
                background: '#d71cd1',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Option
            </button>
          </div>

          {options.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', border: '2px dashed rgba(148,163,184,0.2)', borderRadius: '12px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }}>
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>No options yet</p>
              <p style={{ margin: 0, fontSize: '12px' }}>Add options for your customer to choose from</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {options.map((opt, idx) => (
                <div key={opt.id} style={{ background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Option Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#161616', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #d71cd1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
                      {idx + 1}
                    </div>
                    <input
                      type="text"
                      value={opt.title}
                      onChange={async (e) => {
                        const updated = options.map(o => o.id === opt.id ? { ...o, title: e.target.value } : o)
                        setOptions(updated)
                      }}
                      onBlur={async () => {
                        await supabase.from('documents').update({ options_json: options }).eq('id', doc.id)
                      }}
                      placeholder="Option title"
                      style={{ flex: 1, padding: '8px 12px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '15px', fontWeight: 600 }}
                    />
                    {/* Sort buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        onClick={async () => {
                          if (idx === 0) return
                          const updated = [...options]
                          const temp = updated[idx - 1]
                          updated[idx - 1] = updated[idx]
                          updated[idx] = temp
                          updated.forEach((o, i) => o.sort_order = i)
                          setOptions(updated)
                          await supabase.from('documents').update({ options_json: updated }).eq('id', doc.id)
                        }}
                        disabled={idx === 0}
                        style={{ background: 'none', border: 'none', color: idx === 0 ? '#334155' : '#64748b', cursor: idx === 0 ? 'default' : 'pointer', padding: '2px', lineHeight: 1 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (idx === options.length - 1) return
                          const updated = [...options]
                          const temp = updated[idx + 1]
                          updated[idx + 1] = updated[idx]
                          updated[idx] = temp
                          updated.forEach((o, i) => o.sort_order = i)
                          setOptions(updated)
                          await supabase.from('documents').update({ options_json: updated }).eq('id', doc.id)
                        }}
                        disabled={idx === options.length - 1}
                        style={{ background: 'none', border: 'none', color: idx === options.length - 1 ? '#334155' : '#64748b', cursor: idx === options.length - 1 ? 'default' : 'pointer', padding: '2px', lineHeight: 1 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this option?')) return
                        const updated = options.filter(o => o.id !== opt.id)
                        setOptions(updated)
                        await supabase.from('documents').update({ options_json: updated }).eq('id', doc.id)
                      }}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>

                  {/* Option Body */}
                  <div style={{ padding: '16px' }}>
                    {/* Description */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={labelStyle}>Description</label>
                      <textarea
                        value={opt.description}
                        onChange={(e) => {
                          const updated = options.map(o => o.id === opt.id ? { ...o, description: e.target.value } : o)
                          setOptions(updated)
                        }}
                        onBlur={async () => {
                          await supabase.from('documents').update({ options_json: options }).eq('id', doc.id)
                        }}
                        placeholder="Describe what's included in this option..."
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </div>

                    {/* Pricing */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label style={labelStyle}>Price {opt.price_max ? '(Min)' : ''}</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>$</span>
                          <input
                            type="number"
                            value={opt.price_min || ''}
                            onChange={(e) => {
                              const updated = options.map(o => o.id === opt.id ? { ...o, price_min: parseFloat(e.target.value) || 0 } : o)
                              setOptions(updated)
                            }}
                            onBlur={async () => {
                              await supabase.from('documents').update({ options_json: options }).eq('id', doc.id)
                            }}
                            placeholder="0"
                            style={{ ...inputStyle, paddingLeft: '28px' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Price Max (optional - shows range)</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>$</span>
                          <input
                            type="number"
                            value={opt.price_max || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : undefined
                              const updated = options.map(o => o.id === opt.id ? { ...o, price_max: val } : o)
                              setOptions(updated)
                            }}
                            onBlur={async () => {
                              await supabase.from('documents').update({ options_json: options }).eq('id', doc.id)
                            }}
                            placeholder="Leave empty for fixed price"
                            style={{ ...inputStyle, paddingLeft: '28px' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Price Preview */}
                    <div style={{ padding: '12px 16px', background: '#282a30', borderRadius: '8px', marginBottom: '16px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Customer sees: </span>
                      <span style={{ color: '#22c55e', fontSize: '18px', fontWeight: 700 }}>
                        {opt.price_max 
                          ? `$${(opt.price_min || 0).toLocaleString()} - $${opt.price_max.toLocaleString()}`
                          : `$${(opt.price_min || 0).toLocaleString()}`
                        }
                      </span>
                    </div>

                    {/* Attachments */}
                    <div>
                      <label style={labelStyle}>Images</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(opt.attachments || []).map((att, attIdx) => {
                          const url = att.url || att.file_url || ''
                          const name = att.name || att.filename || att.file_name || 'File'
                          return (
                            <div key={attIdx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)' }}>
                              <img 
                                src={url} 
                                alt={name} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                onClick={() => {
                                  setOptionLightboxOptionId(opt.id)
                                  setOptionLightboxIndex(attIdx)
                                  setOptionLightboxZoom(1)
                                  setOptionLightboxPan({ x: 0, y: 0 })
                                }}
                              />
                              <button
                                onClick={async () => {
                                  const updatedAtts = (opt.attachments || []).filter((_, i) => i !== attIdx)
                                  const updated = options.map(o => o.id === opt.id ? { ...o, attachments: updatedAtts } : o)
                                  setOptions(updated)
                                  await supabase.from('documents').update({ options_json: updated }).eq('id', doc.id)
                                }}
                                style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >×</button>
                            </div>
                          )
                        })}
                        <label style={{ width: '80px', height: '80px', border: '2px dashed rgba(148,163,184,0.3)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '11px' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const files = e.target.files
                              if (!files || files.length === 0) return
                              
                              const newAttachments: Attachment[] = [...(opt.attachments || [])]
                              
                              for (const file of Array.from(files)) {
                                const formData = new FormData()
                                formData.append('file', file)
                                formData.append('documentId', doc.id)
                                formData.append('prefix', 'doc-option')
                                
                                try {
                                  const response = await fetch('/api/upload', { method: 'POST', body: formData })
                                  const data = await response.json()
                                  if (data.success) {
                                    newAttachments.push({
                                      url: data.url,
                                      key: data.key,
                                      filename: data.filename || file.name,
                                      contentType: data.contentType || file.type,
                                      size: data.size || file.size,
                                      uploadedAt: new Date().toISOString()
                                    })
                                  }
                                } catch (err) {
                                  console.error('Upload error:', err)
                                }
                              }
                              
                              const updated = options.map(o => o.id === opt.id ? { ...o, attachments: newAttachments } : o)
                              setOptions(updated)
                              await supabase.from('documents').update({ options_json: updated }).eq('id', doc.id)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Line Items */}
      <div style={{ ...cardStyle, display: optionsMode ? 'none' : 'block' }}>
        <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0' }}>Line Items</h3>
        
        {/* Line Item Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {lineItemGroups.map(group => {
            const category = getCategoryByKey(group.category_key)
            const groupItems = lineItems.filter(i => i.group_id === group.group_id)
            const groupTotal = groupItems.reduce((sum, i) => sum + (i.line_total || 0), 0)
            const pkgs = getPackagesForCategory(group.category_key)
            const types = getTypesForCategory(group.category_key)
            const showPackages = category && hasPackages(category) && pkgs.length > 0
            const showTypes = category && hasTypes(category) && types.length > 0
            const isApparel = isApparelCategory(group.category_key)

            return (
              <div key={group.group_id} style={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Group Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#1d1d1d', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                  <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: category?.calendar_color || '#94a3b8' }} />
                  <div style={{ flex: 1, fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>{category?.label || group.category_key}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', background: '#282a30', padding: '2px 8px', borderRadius: '10px' }}>{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#22c55e' }}>${groupTotal.toFixed(2)}</div>
                  <button onClick={() => deleteGroup(group.group_id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} title="Delete section">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>

                {isApparel ? (
                  /* ============ APPAREL MODE TABLE ============ */
                  <div>
                    {groupItems.map(item => {
                      const af = getApparelFields(item)
                      const enabledSizes = af.enabled_sizes || []
                      const sizes = af.sizes || {}
                      return (
                        <div key={item.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.1)', padding: '16px' }}>
                          {/* Top row: Item #, Color, Description, Manage Sizes */}
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ width: '180px' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Item # (Search SS)</div>
                              <SSProductLookup
                                itemNumber={af.item_number || ''}
                                onSelect={(product) => handleSSProductSelect(item.id, product)}
                                onItemNumberChange={(value) => updateApparelField(item.id, 'item_number', value)}
                              />
                            </div>
                            <div style={{ width: '140px' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Color</div>
                              {ssProductCache[item.id] && ssProductCache[item.id].colors ? (
                                <select
                                  value={af.color || ''}
                                  onChange={async (e) => {
                                    const newColor = e.target.value

                                    // Update sizes with new color's pricing (keep description unchanged)
                                    const product = ssProductCache[item.id]
                                    const selectedColor = product.colors.find((c: any) => c.colorName === newColor)

                                    if (selectedColor && selectedColor.sizes) {
                                      // Apply default 100% markup to SS wholesale prices
                                      // TODO: Replace with pricing matrix lookup based on document settings
                                      const DEFAULT_MARKUP = 1.0 // 100% markup (2x wholesale)

                                      const sizesObj: Record<string, { qty: number; price: number }> = {}
                                      selectedColor.sizes.forEach((s: any) => {
                                        const existingSize = (af.sizes || {})[s.sizeName]
                                        const wholesalePrice = s.wholesalePrice || 0
                                        const retailPrice = wholesalePrice * (1 + DEFAULT_MARKUP)

                                        sizesObj[s.sizeName] = {
                                          qty: existingSize?.qty || 0,
                                          price: retailPrice
                                        }
                                      })

                                      // Update custom_fields with color and sizes (don't change description)
                                      const newItems = lineItems.map(li => {
                                        if (li.id !== item.id) return li
                                        return {
                                          ...li,
                                          custom_fields: {
                                            ...li.custom_fields,
                                            color: newColor,  // Just the color name (e.g., "Black")
                                            sizes: sizesObj,
                                            enabled_sizes: selectedColor.sizes.map((s: any) => s.sizeName)
                                          }
                                        }
                                      })
                                      setLineItems(newItems)

                                      const updatedItem = newItems.find(i => i.id === item.id)
                                      if (updatedItem) {
                                        await supabase.from('line_items').update({
                                          custom_fields: updatedItem.custom_fields,
                                        }).eq('id', item.id)
                                      }
                                    }
                                  }}
                                  style={{ ...inputStyle, padding: '8px', fontSize: '13px' }}
                                >
                                  <option value="">Select Color</option>
                                  {ssProductCache[item.id].colors.map((color: any) => {
                                    const product = ssProductCache[item.id]
                                    // Format like Printavo: Brand - Style# - Color - Description
                                    const optionText = `${product.brandName} - ${product.styleName} - ${color.colorName}`
                                    return (
                                      <option key={color.colorID} value={color.colorName}>
                                        {optionText}
                                      </option>
                                    )
                                  })}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={af.color || ''}
                                  onChange={e => updateApparelField(item.id, 'color', e.target.value)}
                                  placeholder="Deep Black"
                                  style={{ ...inputStyle, padding: '8px', fontSize: '13px' }}
                                />
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Product</div>
                              <input type="text" value={item.description || ''} onChange={e => updateLineItem(item.id, 'description', e.target.value)} placeholder="Port Authority Active 1/2-Zip Soft Shell Jacket" style={{ ...inputStyle, padding: '8px', fontSize: '13px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingBottom: '1px' }}>
                              <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Qty</div>
                                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, padding: '8px 0' }}>{item.quantity || 0}</div>
                              </div>
                              <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Total</div>
                                <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, padding: '8px 0' }}>${(item.line_total || 0).toFixed(2)}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingBottom: '6px' }}>
                                <input type="checkbox" checked={item.taxable || false} onChange={e => updateLineItem(item.id, 'taxable', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#d71cd1', cursor: 'pointer' }} title="Charge 6% sales tax" />
                                {/* Manage Sizes Menu */}
                                <div style={{ position: 'relative' }}>
                                  <button
                                    onClick={() => setApparelSizeMenu(apparelSizeMenu === item.id ? null : item.id)}
                                    style={{ background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                    Sizes
                                  </button>
                                  {apparelSizeMenu === item.id && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '12px', zIndex: 100, width: '200px', maxHeight: '400px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '10px' }}>Manage Sizes</div>
                                      {ALL_SIZES.map(size => (
                                        <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                                          <input
                                            type="checkbox"
                                            checked={enabledSizes.includes(size)}
                                            onChange={e => {
                                              const newSizes = e.target.checked
                                                ? [...enabledSizes, size]
                                                : enabledSizes.filter(s => s !== size)
                                              updateApparelField(item.id, 'enabled_sizes', newSizes)
                                            }}
                                            style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                                          />
                                          <span style={{ color: enabledSizes.includes(size) ? '#f1f5f9' : '#64748b', fontSize: '13px' }}>{size}</span>
                                        </label>
                                      ))}
                                      <button onClick={() => setApparelSizeMenu(null)} style={{ width: '100%', marginTop: '10px', padding: '6px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', color: '#a78bfa', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Done</button>
                                    </div>
                                  )}
                                </div>
                                <button onClick={() => deleteLineItem(item.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Size Grid */}
                          {enabledSizes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {enabledSizes.map(size => {
                                const sizeData = sizes[size] || { qty: 0, price: 0 }
                                return (
                                  <div key={size} style={{ background: '#161616', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px', padding: '8px 10px', minWidth: '90px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', marginBottom: '6px' }}>{size}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <input
                                        type="number"
                                        value={sizeData.qty || ''}
                                        onChange={e => updateApparelField(item.id, `size.${size}.qty`, parseInt(e.target.value) || 0)}
                                        placeholder="Qty"
                                        style={{ width: '100%', padding: '4px 6px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '4px', color: '#f1f5f9', fontSize: '13px', textAlign: 'center', fontFamily: 'inherit' }}
                                      />
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11px' }}>$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={sizeData.price || ''}
                                          onChange={e => updateApparelField(item.id, `size.${size}.price`, parseFloat(e.target.value) || 0)}
                                          placeholder="0.00"
                                          style={{ width: '100%', padding: '4px 6px', background: '#111', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '4px', color: '#f1f5f9', fontSize: '12px', textAlign: 'center', fontFamily: 'inherit' }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {enabledSizes.length === 0 && (
                            <div style={{ padding: '12px', textAlign: 'center', color: '#475569', fontSize: '13px', background: '#161616', borderRadius: '8px' }}>
                              Click <strong>Sizes</strong> to choose which sizes to include
                            </div>
                          )}

                          {/* Attachments row */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                            {/* Mockup Creator Button */}
                            <button
                              onClick={() => handleOpenMockupBuilder(item.id)}
                              style={{
                                padding: '8px 12px',
                                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 8px rgba(139,92,246,0.3)'
                              }}
                              title="Create visual mockup with logo placement"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                              Mockup Creator
                            </button>

                            {(item.attachments || []).map((att, attIdx) => {
                              const url = att.url || att.file_url || ''
                              const name = att.name || att.filename || att.file_name || 'File'
                              const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
                              return (
                                <div key={att.file_id || att.key || attIdx} style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d' }} onClick={() => isImage ? openLineItemLightbox(item.id, attIdx) : window.open(url, '_blank')}>
                                  {isImage && url ? (
                                    <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#64748b' }}>
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </div>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteLineItemAttachment(item.id, att.file_id || att.key || String(attIdx)) }} style={{ position: 'absolute', top: '1px', right: '1px', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                                </div>
                              )
                            })}
                            <label style={{ width: '50px', height: '50px', border: '2px dashed rgba(148,163,184,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              <input type="file" multiple accept=".jpg,.jpeg,.png,.svg,.pdf,.ai,.eps" onChange={(e) => handleLineItemAttachment(item.id, e)} style={{ display: 'none' }} />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (

                /* ============ STANDARD MODE TABLE ============ */
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#161616' }}>
                      {showPackages && <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '150px' }}>Package</th>}
                      {showTypes && <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '150px' }}>Type</th>}
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '80px' }}>{category?.unit_label || 'Qty'}</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '90px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '100px' }}>Total</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '50px' }}>Tax</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.map(item => (
                      <React.Fragment key={item.id}>
                        <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                          {showPackages && (
                            <td style={{ padding: '8px 12px' }}>
                              <select value={item.package_key || ''} onChange={(e) => updateLineItem(item.id, 'package_key', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: '13px' }}>
                                <option value="">-- Select --</option>
                                {pkgs.map(p => <option key={p.package_key} value={p.package_key}>{p.label}</option>)}
                              </select>
                            </td>
                          )}
                          {showTypes && (
                            <td style={{ padding: '8px 12px' }}>
                              <select value={item.line_type || ''} onChange={(e) => updateLineItem(item.id, 'line_type', e.target.value)} style={{ ...inputStyle, padding: '8px', fontSize: '13px' }}>
                                <option value="">-- Select --</option>
                                {types.map(t => <option key={t.type_key} value={t.type_key}>{t.label}</option>)}
                              </select>
                            </td>
                          )}
                          <td style={{ padding: '8px 12px' }}>
                            <input type="text" value={item.description || ''} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, padding: '8px', fontSize: '13px' }} />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="number" value={item.sqft || item.quantity || ''} onChange={(e) => updateLineItem(item.id, 'sqft', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, padding: '8px', fontSize: '13px', textAlign: 'right' }} />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="number" step="0.01" value={item.rate || item.unit_price || ''} onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, padding: '8px', fontSize: '13px', textAlign: 'right' }} />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#f1f5f9', fontWeight: 500, fontSize: '14px' }}>${(item.line_total || 0).toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={item.taxable || false}
                              onChange={(e) => updateLineItem(item.id, 'taxable', e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: '#d71cd1', cursor: 'pointer' }}
                              title="Charge 6% sales tax"
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button onClick={() => deleteLineItem(item.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </td>
                        </tr>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                          <td colSpan={20} style={{ padding: '8px 12px 12px 12px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                              {(item.attachments || []).map((att, attIdx) => {
                                const url = att.url || att.file_url || ''
                                const name = att.name || att.filename || att.file_name || 'File'
                                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + ' ' + url)
                                // Normalize attachment for lightbox
                                const normalizedAtt: Attachment = {
                                  url: url,
                                  key: att.key || att.file_id || String(attIdx),
                                  filename: name,
                                  contentType: att.contentType || att.type || att.mime_type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
                                  size: att.size || 0,
                                  uploadedAt: att.uploadedAt || att.uploaded_at || ''
                                }
                                return (
                                  <div key={att.file_id || att.key || attIdx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d' }} onClick={() => isImage ? openLineItemLightbox(item.id, attIdx) : window.open(url, '_blank')}>
                                    {isImage && url ? (
                                      <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', gap: '2px' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        <span>{name.length > 8 ? name.substring(0, 8) + '...' : name}</span>
                                      </div>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteLineItemAttachment(item.id, att.file_id || att.key || String(attIdx)) }} style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                  </div>
                                )
                              })}
                              <label style={{ width: '60px', height: '60px', border: '2px dashed rgba(148,163,184,0.3)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '10px', background: 'transparent', transition: 'all 0.15s' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <input type="file" multiple accept=".jpg,.jpeg,.png,.svg,.pdf,.ai,.eps" onChange={(e) => handleLineItemAttachment(item.id, e)} style={{ display: 'none' }} />
                              </label>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                )}

                {/* Add Line Item Button */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                  <button onClick={() => addLineItemToGroup(group.group_id, group.category_key)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'transparent', border: '1px dashed rgba(148,163,184,0.3)', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Line Item
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add Section Button */}
        <div style={{ marginTop: '16px' }}>
          <button onClick={() => setShowSectionModal(true)} style={{ width: '100%', padding: '16px', background: 'transparent', border: '2px dashed rgba(148,163,184,0.3)', borderRadius: '8px', color: '#64748b', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Section
          </button>
        </div>
      </div>

      {/* Fees & Adjustments */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0 }}>Fees & Adjustments</h3>
          <ActionButton onClick={addFee} variant="secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Fee
          </ActionButton>
        </div>
        {fees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '13px' }}>No fees added</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fees.map((fee, index) => (
              <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select value={fee.fee_type} onChange={(e) => updateFee(index, 'fee_type', e.target.value)} style={{ ...inputStyle, width: '150px', padding: '8px' }}>
                  <option value="">-- Select --</option>
                  {feeTypes.map(ft => <option key={ft.fee_type_key} value={ft.fee_type_key}>{ft.label}</option>)}
                </select>
                <input type="text" value={fee.description} onChange={(e) => updateFee(index, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, flex: 1, padding: '8px' }} />
                <input type="number" step="0.01" value={fee.amount} onChange={(e) => updateFee(index, 'amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: '100px', padding: '8px', textAlign: 'right' }} />
                <button onClick={() => deleteFee(index)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '12px', textAlign: 'right', color: '#64748b', fontSize: '14px' }}>Fees Total: <span style={{ color: '#f1f5f9', fontWeight: 500 }}>${feesTotal.toFixed(2)}</span></div>
        
        {/* Totals Section */}
        <div style={{ maxWidth: '480px', marginLeft: 'auto', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(148,163,184,0.1)' }}>
          {/* Subtotal Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Subtotal</span>
            <div></div>
            <span style={{ color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>${subtotal.toFixed(2)}</span>
          </div>
          
          {/* Discount Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Discount</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select 
                value={
                  discountPercentInput === 5 ? '5%' :
                  discountPercentInput === 10 ? '10%' :
                  discountPercentInput === 15 ? '15%' :
                  discountPercentInput === 20 ? '20%' :
                  discountPercentInput === 25 ? '25%' :
                  discountPercentInput > 0 ? 'custom%' :
                  discountAmountInput > 0 ? 'flat' : 'none'
                } 
                onChange={async (e) => {
                  const val = e.target.value
                  let newPercent = 0
                  let newAmount = 0
                  
                  if (val === 'none') {
                    newPercent = 0
                    newAmount = 0
                    setDiscountMode('none')
                  } else if (val === 'flat') {
                    newPercent = 0
                    newAmount = discountAmountInput || 50
                    setDiscountMode('flat')
                  } else if (val === 'custom%') {
                    newPercent = discountPercentInput || 10
                    newAmount = 0
                    setDiscountMode('percent')
                  } else if (val.endsWith('%')) {
                    newPercent = parseInt(val)
                    newAmount = 0
                    setDiscountMode('percent')
                  }
                  
                  setDiscountPercentInput(newPercent)
                  setDiscountAmountInput(newAmount)
                  
                  const discount = newAmount || (subtotal * newPercent / 100)
                  const newTotal = subtotal + feesTotal - discount + taxAmountInput
                  await supabase.from('documents').update({ 
                    discount_amount: newAmount, 
                    discount_percent: newPercent,
                    total: newTotal 
                  }).eq('id', doc.id)
                  setDoc({ ...doc, discount_amount: newAmount, discount_percent: newPercent, total: newTotal })
                }}
                style={{ ...inputStyle, width: '110px', padding: '8px 10px', fontSize: '13px' }}
              >
                <option value="none">None</option>
                <option value="5%">5%</option>
                <option value="10%">10%</option>
                <option value="15%">15%</option>
                <option value="20%">20%</option>
                <option value="25%">25%</option>
                <option value="flat">Flat $</option>
                <option value="custom%">Custom %</option>
              </select>
              {(discountPercentInput > 0 && ![5,10,15,20,25].includes(discountPercentInput)) && (
                <input type="text" inputMode="decimal" value={discountPercentInput || ''} onChange={(e) => setDiscountPercentInput(parseFloat(e.target.value) || 0)} onBlur={handleDiscountChange} style={{ ...inputStyle, width: '60px', padding: '8px 10px', fontSize: '13px', textAlign: 'right' }} placeholder="%" />
              )}
              {discountMode === 'flat' && (
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={discountAmountInput || ''} 
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || val === '.' || /^\d*\.?\d*$/.test(val)) {
                      setDiscountAmountInput(val as any)
                    }
                  }} 
                  onBlur={(e) => {
                    const parsed = parseFloat(e.target.value) || 0
                    setDiscountAmountInput(parsed)
                    handleDiscountChange()
                  }}
                  style={{ ...inputStyle, width: '80px', padding: '8px 10px', fontSize: '13px', textAlign: 'right' }} 
                  placeholder="0.00" 
                />
              )}
            </div>
            <span style={{ color: '#22c55e', fontSize: '14px', textAlign: 'right' }}>-${(discountPercentInput > 0 ? (subtotal * discountPercentInput / 100) : (parseFloat(String(discountAmountInput)) || 0)).toFixed(2)}</span>
          </div>
          
          {/* Tax Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Tax (6%)</span>
            <span style={{ color: '#64748b', fontSize: '12px', textAlign: 'right' }}>{lineItems.filter(i => i.taxable).length} taxable item{lineItems.filter(i => i.taxable).length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>${taxAmount.toFixed(2)}</span>
          </div>
          
          {/* Total Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', paddingTop: '16px', paddingBottom: '16px', borderTop: '1px solid rgba(148,163,184,0.2)', marginBottom: '16px', gap: '12px' }}>
            <span style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600 }}>Total</span>
            <div></div>
            <span style={{ color: '#22c55e', fontSize: '22px', fontWeight: 700, textAlign: 'right' }}>${total.toFixed(2)}</span>
          </div>
          
          {/* Deposit Required Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Deposit Required</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
              <select 
                value={depositType} 
                onChange={async (e) => {
                  const val = e.target.value as '50%' | 'full' | 'custom'
                  setDepositType(val)
                  let newDeposit = 0
                  
                  if (val === 'full') {
                    newDeposit = total
                  } else if (val === '50%') {
                    newDeposit = total * 0.5
                  } else {
                    newDeposit = depositRequired || total * 0.5
                  }
                  
                  setDepositRequired(newDeposit)
                  await supabase.from('documents').update({ deposit_required: newDeposit }).eq('id', doc.id)
                  setDoc({ ...doc, deposit_required: newDeposit })
                }}
                style={{ ...inputStyle, width: '90px', padding: '8px 10px', fontSize: '13px' }}
              >
                <option value="50%">50%</option>
                <option value="full">Full</option>
                <option value="custom">Custom</option>
              </select>
              {depositType === 'custom' && (
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={depositRequired || ''} 
                  onChange={(e) => setDepositRequired(parseFloat(e.target.value) || 0)} 
                  onBlur={async () => {
                    await supabase.from('documents').update({ deposit_required: depositRequired }).eq('id', doc.id)
                    setDoc({ ...doc, deposit_required: depositRequired })
                  }}
                  style={{ ...inputStyle, width: '80px', padding: '8px 10px', fontSize: '13px', textAlign: 'right' }} 
                  placeholder="0.00"
                />
              )}
            </div>
            <span style={{ color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>${depositRequired.toFixed(2)}</span>
          </div>
          
          {/* Amount Paid & Balance Due - show for any doc type with payments */}
          {actualAmountPaid > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', marginTop: '16px', gap: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Amount Paid</span>
                <div></div>
                <span style={{ color: '#22c55e', fontSize: '14px', textAlign: 'right' }}>-${actualAmountPaid.toFixed(2)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', marginTop: '16px', gap: '12px' }}>
                <span style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600 }}>Balance Due</span>
                <div></div>
                <span style={{ color: '#f59e0b', fontSize: '20px', fontWeight: 700, textAlign: 'right' }}>${balanceDue.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Internal Notes */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0 }}>Internal Notes</h3>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes (not shown to customer)..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      {/* Revision History */}
      {revisions.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Revision Requests
          </h3>
          
          {/* Message Thread */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', padding: '4px', marginBottom: '16px' }}>
            {revisions.map((rev, idx) => {
              const isCustomer = rev.from === 'customer'
              const timestamp = new Date(rev.timestamp).toLocaleString()
              return (
                <div key={idx} style={{ 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  maxWidth: '85%', 
                  alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                  background: isCustomer ? '#1d1d1d' : 'rgba(215,28,209,0.15)',
                  border: isCustomer ? '1px solid #f59e0b' : '1px solid #d71cd1',
                  borderBottomLeftRadius: isCustomer ? '4px' : '12px',
                  borderBottomRightRadius: isCustomer ? '12px' : '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11px', color: '#64748b' }}>
                    <span style={{ fontWeight: 600, color: isCustomer ? '#f59e0b' : '#d71cd1' }}>{rev.name || (isCustomer ? 'Customer' : 'FWG')}</span>
                    <span>{timestamp}</span>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>{rev.message}</div>
                  {rev.sentSms && <div style={{ marginTop: '6px', fontSize: '10px', color: '#64748b' }}>Sent via SMS</div>}
                </div>
              )
            })}
          </div>
          
          {/* Reply Box */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: '16px' }}>
            <textarea 
              value={revisionReply} 
              onChange={(e) => setRevisionReply(e.target.value)} 
              placeholder="Reply to customer..." 
              rows={2} 
              style={{ ...inputStyle, resize: 'none', marginBottom: '12px' }} 
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}>
                  <input type="checkbox" checked={revisionSendSms} onChange={(e) => { setRevisionSendSms(e.target.checked); if (!e.target.checked) setRevisionIncludeLink(false) }} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                  Send SMS to customer
                </label>
                {revisionSendSms && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer', marginLeft: '24px' }}>
                    <input type="checkbox" checked={revisionIncludeLink} onChange={(e) => setRevisionIncludeLink(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                    Include {doc.doc_type} link
                  </label>
                )}
              </div>
              <ActionButton onClick={handleSendRevisionReply} disabled={sendingRevision || !revisionReply.trim()} variant="primary" style={{ padding: '8px 16px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {sendingRevision ? 'Sending...' : 'Save & Send'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}



      {/* Payments Section */}
      {(isInvoice || payments.length > 0 || actualAmountPaid > 0) && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0 }}>Payments</h3>
            <ActionButton onClick={() => { setPaymentAmount(balanceDue > 0 ? balanceDue : total); setPaymentMethod('card'); setPaymentNotes(''); setShowRecordPaymentModal(true) }} variant="secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Record Payment
            </ActionButton>
          </div>
          
          {payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '14px' }}>
              No payments recorded yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.map((payment) => (
                <div key={payment.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#1d1d1d', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.1)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>${payment.amount.toFixed(2)}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {payment.payment_method === 'card' ? 'Credit Card' : payment.payment_method === 'bank_transfer' ? 'Bank Transfer' : payment.payment_method === 'cash' ? 'Cash' : payment.payment_method === 'check' ? 'Check' : 'Other'}
                      {payment.processor && ` via ${payment.processor.charAt(0).toUpperCase() + payment.processor.slice(1)}`}
                      {(payment.processing_fee || 0) > 0 && <span style={{ color: '#94a3b8' }}> (incl. ${(payment.processing_fee || 0).toFixed(2)} processing fee)</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: '#22c55e', fontSize: '12px', fontWeight: 500 }}>{payment.status}</div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{formatDate(payment.created_at)}</div>
                    </div>
                    <button
                      onClick={async () => {
                        const doSync = async (force = false) => {
                          try {
                            showToast('Syncing payment to Google Sheets...', 'info')
                            const response = await fetch('/api/payments/sync-to-sheet', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ paymentId: payment.id, force })
                            })
                            const result = await response.json()
                            if (result.success) {
                              if (result.alreadySynced) {
                                // Ask for confirmation to re-sync
                                if (window.confirm('This payment has already been synced to Google Sheets. Are you sure you want to add it again?')) {
                                  await doSync(true)
                                }
                              } else {
                                showToast(`Synced ${result.rowsAdded} row(s) to Google Sheets`, 'success')
                              }
                            } else {
                              showToast(`Failed to sync: ${result.error}`, 'error')
                            }
                          } catch (err) {
                            console.error('Error syncing payment:', err)
                            showToast('Failed to sync payment', 'error')
                          }
                        }
                        await doSync()
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: 'rgba(139,92,246,0.1)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: '4px',
                        color: '#a78bfa',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                      </svg>
                      Sync to Sheet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {payments.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '14px' }}>Total Paid</span>
              <span style={{ color: '#22c55e', fontSize: '16px', fontWeight: 600 }}>${actualAmountPaid.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* History Log */}
      <div style={cardStyle}>
        <div 
          onClick={() => setHistoryExpanded(!historyExpanded)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Activity Log
            {historyLog.length > 0 && (
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>({historyLog.length})</span>
            )}
          </h3>
          <svg 
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" 
            style={{ transition: 'transform 0.2s ease', transform: historyExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {historyExpanded && (
          <div style={{ marginTop: '16px' }}>
            {historyLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '13px' }}>
                No activity recorded yet. Events will appear here as the document progresses.
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: '20px' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: '7px', top: '4px', bottom: '4px', width: '2px', background: 'rgba(148,163,184,0.15)', borderRadius: '1px' }} />
                
                {[...historyLog].reverse().map((entry, idx) => {
                  const date = new Date(entry.timestamp)
                  const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
                  
                  // Color-code by event type
                  let dotColor = '#64748b'
                  if (entry.event.includes('Sent')) dotColor = '#3b82f6'
                  if (entry.event.includes('Approved')) dotColor = '#22c55e'
                  if (entry.event.includes('Paid') || entry.event.includes('Payment')) dotColor = '#22c55e'
                  if (entry.event.includes('Revision')) dotColor = '#f59e0b'
                  if (entry.event.includes('Archived') || entry.event.includes('Cold')) dotColor = '#6b7280'
                  if (entry.event.includes('Converted')) dotColor = '#a855f7'
                  
                  return (
                    <div key={idx} style={{ position: 'relative', paddingBottom: idx < historyLog.length - 1 ? '16px' : '0', paddingLeft: '16px' }}>
                      {/* Dot */}
                      <div style={{ 
                        position: 'absolute', left: '-13px', top: '3px',
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: dotColor, border: '2px solid #111111'
                      }} />
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#f1f5f9' }}>{entry.event}</div>
                      {entry.detail && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{entry.detail}</div>}
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{timeStr}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      

      {/* Sticky Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 24px', background: 'linear-gradient(to top, #111111 60%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <ActionButton onClick={() => router.back()} variant="secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </ActionButton>
        <button 
          onClick={handleSaveAll} 
          disabled={saving} 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '12px 28px', 
            background: 'linear-gradient(135deg, #d71cd1, #38c2f0)', 
            border: 'none', 
            borderRadius: '8px', 
            color: 'white', 
            fontSize: '15px', 
            fontWeight: 600, 
            cursor: 'pointer', 
            opacity: saving ? 0.7 : 1, 
            boxShadow: '0 0 20px rgba(215, 28, 209, 0.4)',
            transition: 'all 0.2s ease',
            transform: 'scale(1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0 30px rgba(215, 28, 209, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(215, 28, 209, 0.4)'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)'
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Add Section Modal */}
      {showSectionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSectionModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Add Section</h2>
              <button onClick={() => setShowSectionModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>x</button>
            </div>
            
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
              {(['AUTOMOTIVE', 'SIGNAGE', 'APPAREL'] as const).map(tab => (
                <button key={tab} onClick={() => setSectionModalTab(tab)} style={{ flex: 1, padding: '12px 16px', background: 'none', border: 'none', borderBottom: sectionModalTab === tab ? '2px solid #d71cd1' : '2px solid transparent', color: sectionModalTab === tab ? '#d71cd1' : '#94a3b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Category Grid */}
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxHeight: '300px', overflow: 'auto' }}>
              {getTabCategories().map(cat => (
                <button key={cat.category_key} onClick={() => addSection(cat.category_key)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: cat.calendar_color }} />
                  <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500 }}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Follow-Up Modal */}
      {showFollowUpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowFollowUpModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Follow Up</h2>
              <button onClick={() => setShowFollowUpModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
                Send a follow-up message to <strong style={{ color: '#f1f5f9' }}>{customerName || 'customer'}</strong>
                {doc.followup_count ? <span style={{ color: '#64748b' }}> (Follow-up #{(doc.followup_count || 0) + 1})</span> : ''}
              </p>

              {/* Message Templates */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Message Template</div>
                <label onClick={() => handleSelectFollowUpTemplate('CHECKING_IN')} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: followUpTemplate === 'CHECKING_IN' ? 'rgba(215,28,209,0.1)' : '#1d1d1d', border: followUpTemplate === 'CHECKING_IN' ? '1px solid #d71cd1' : '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="followUpTemplate" checked={followUpTemplate === 'CHECKING_IN'} onChange={() => {}} style={{ accentColor: '#d71cd1', marginTop: '2px' }} />
                  <div>
                    <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>Just Checking In</div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>Hi {(customerName || 'there').split(' ')[0]}, just checking in on the {doc.doc_type} we sent over...</div>
                  </div>
                </label>
                <label onClick={() => handleSelectFollowUpTemplate('READY_TO_PROCEED')} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: followUpTemplate === 'READY_TO_PROCEED' ? 'rgba(215,28,209,0.1)' : '#1d1d1d', border: followUpTemplate === 'READY_TO_PROCEED' ? '1px solid #d71cd1' : '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="followUpTemplate" checked={followUpTemplate === 'READY_TO_PROCEED'} onChange={() => {}} style={{ accentColor: '#d71cd1', marginTop: '2px' }} />
                  <div>
                    <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>Ready When You Are</div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>Hi {(customerName || 'there').split(' ')[0]}, wanted to follow up on your {doc.doc_type}. We're ready to get started...</div>
                  </div>
                </label>
              </div>

              {/* Editable Message */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Message Preview (editable)</div>
                <textarea value={followUpMessage} onChange={(e) => setFollowUpMessage(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Incentive Toggle */}
              <div style={{ marginBottom: '16px', padding: '16px', background: '#1d1d1d', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: followUpIncentiveEnabled ? '16px' : '0' }}>
                  <input type="checkbox" checked={followUpIncentiveEnabled} onChange={(e) => setFollowUpIncentiveEnabled(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                  <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>Include a limited-time discount incentive</span>
                </label>
                
                {followUpIncentiveEnabled && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Discount Type</label>
                        <select value={followUpDiscountType} onChange={(e) => setFollowUpDiscountType(e.target.value as 'percent' | 'dollar')} style={inputStyle}>
                          <option value="percent">Percentage (%)</option>
                          <option value="dollar">Dollar Amount ($)</option>
                        </select>
                      </div>
                      {followUpDiscountType === 'percent' ? (
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '4px' }}>Discount %</label>
                          <input type="number" value={followUpDiscountPercent} onChange={(e) => setFollowUpDiscountPercent(parseInt(e.target.value) || 0)} min="1" max="100" style={inputStyle} />
                        </div>
                      ) : (
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '4px' }}>Discount $</label>
                          <input type="number" value={followUpDiscountDollar} onChange={(e) => setFollowUpDiscountDollar(parseFloat(e.target.value) || 0)} min="1" step="0.01" style={inputStyle} />
                        </div>
                      )}
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Expires On</label>
                        <input type="date" value={followUpExpiryDate} onChange={(e) => setFollowUpExpiryDate(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ padding: '10px', background: '#282a30', borderRadius: '6px', fontSize: '13px', color: '#94a3b8' }}>
                      <strong>{followUpDiscountType === 'percent' ? `${followUpDiscountPercent}% off` : `$${followUpDiscountDollar.toFixed(2)} off`}</strong> = ${getFollowUpDiscountAmount().toFixed(2)} discount<br />
                      New total: <strong>${(subtotal - getFollowUpDiscountAmount()).toFixed(2)}</strong><br />
                      Valid until: {followUpExpiryDate}
                    </div>
                  </div>
                )}
              </div>

              {/* Deposit Required */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Deposit Required</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select value={followUpDepositType} onChange={(e) => handleFollowUpDepositTypeChange(e.target.value as '50' | '100' | 'custom')} style={{ ...inputStyle, width: '120px' }}>
                    <option value="50">50%</option>
                    <option value="100">100%</option>
                    <option value="custom">Custom</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#64748b' }}>$</span>
                    <input type="number" value={followUpDepositAmount.toFixed(2)} onChange={(e) => { setFollowUpDepositType('custom'); setFollowUpDepositAmount(parseFloat(e.target.value) || 0) }} min="0" step="0.01" style={{ ...inputStyle, width: '120px' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <ActionButton onClick={() => setShowFollowUpModal(false)} variant="secondary">Cancel</ActionButton>
              <ActionButton onClick={handleSendFollowUp} disabled={sendingFollowUp} variant="primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {sendingFollowUp ? 'Sending...' : 'Send Follow-Up'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSendModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Send {doc.doc_type === 'quote' ? 'Quote' : 'Invoice'}</h2>
              <button onClick={() => setShowSendModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Delivery Method */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Delivery Method</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#1d1d1d', borderRadius: '8px', marginBottom: '8px', cursor: customerPhone ? 'pointer' : 'not-allowed', opacity: customerPhone ? 1 : 0.5 }}>
                  <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} disabled={!customerPhone} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: '14px' }}>SMS</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{customerPhone || 'No phone'}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#1d1d1d', borderRadius: '8px', cursor: customerEmail ? 'pointer' : 'not-allowed', opacity: customerEmail ? 1 : 0.5 }}>
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} disabled={!customerEmail} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: '14px' }}>Email</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{customerEmail || 'No email'}</span>
                </label>
              </div>

              {/* Approval Type (Quote only) */}
              {isQuote && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Requesting Approval For</div>
                  {[
                    { value: 'design', label: 'Design Approval' },
                    { value: 'price', label: 'Quote/Price Approval' },
                    { value: 'both', label: 'Both Design & Price' },
                    { value: 'custom', label: 'Custom' }
                  ].map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1d1d1d', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="approvalType" value={opt.value} checked={approvalType === opt.value} onChange={(e) => setApprovalType(e.target.value)} style={{ accentColor: '#d71cd1' }} />
                      <span style={{ color: '#f1f5f9', fontSize: '14px' }}>{opt.label}</span>
                    </label>
                  ))}
                  {approvalType === 'custom' && (
                    <input type="text" value={customApprovalText} onChange={(e) => setCustomApprovalText(e.target.value)} placeholder="Enter custom approval request..." style={{ ...inputStyle, marginTop: '8px' }} />
                  )}
                </div>
              )}

              {/* Attachments */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Attachments to Include</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1d1d1d', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeLineAttachments} onChange={(e) => setIncludeLineAttachments(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: '14px' }}>Line Item Attachments</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>({lineItemAttachmentCount} files)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1d1d1d', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeProjectAttachments} onChange={(e) => setIncludeProjectAttachments(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#d71cd1' }} />
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: '14px' }}>Project Level Attachments</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>({attachments.length} files)</span>
                </label>
              </div>

              {/* Payment Terms */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Payment Terms</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1d1d1d', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="paymentTerms" value="deposit_50" checked={paymentTerms === 'deposit_50'} onChange={(e) => setPaymentTerms(e.target.value)} style={{ accentColor: '#d71cd1' }} />
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: '14px' }}>50% Deposit Required</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>${(total * 0.5).toFixed(2)}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1d1d1d', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="paymentTerms" value="full" checked={paymentTerms === 'full'} onChange={(e) => setPaymentTerms(e.target.value)} style={{ accentColor: '#d71cd1' }} />
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: '14px' }}>Pay in Full</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>${total.toFixed(2)}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1d1d1d', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="paymentTerms" value="custom" checked={paymentTerms === 'custom'} onChange={(e) => setPaymentTerms(e.target.value)} style={{ accentColor: '#d71cd1' }} />
                  <span style={{ color: '#f1f5f9', fontSize: '14px' }}>Custom Amount</span>
                </label>
                {paymentTerms === 'custom' && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#64748b' }}>$</span>
                    <input type="number" value={customPaymentAmount} onChange={(e) => setCustomPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" style={{ ...inputStyle, width: '120px' }} />
                  </div>
                )}
              </div>

              {/* Customer Notification Preference */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Customer Confirmation Preference</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>How should the customer receive payment confirmations?</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['sms', 'email', 'both'].map(pref => (
                    <label key={pref} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#1d1d1d', borderRadius: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="notificationPref" value={pref} checked={notificationPref === pref} onChange={(e) => setNotificationPref(e.target.value)} style={{ accentColor: '#d71cd1' }} />
                      <span style={{ color: '#f1f5f9', fontSize: '14px', textTransform: 'capitalize' }}>{pref}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <ActionButton
                onClick={async () => {
                  // Save current send settings to the document first so the
                  // copied link reflects the configured options
                  let depositAmount = 0
                  if (paymentTerms === 'deposit_50') depositAmount = total * 0.5
                  else if (paymentTerms === 'full') depositAmount = total
                  else if (paymentTerms === 'custom') depositAmount = Number(customPaymentAmount) || 0

                  const sendOptions = {
                    approvalType: isQuote ? approvalType : null,
                    customApprovalText: approvalType === 'custom' ? customApprovalText : null,
                    includeLineAttachments,
                    includeProjectAttachments,
                    paymentTerms,
                    depositAmount,
                    customerNotificationPref: notificationPref
                  }

                  await supabase.from('documents').update({
                    status: 'sent',
                    sent_at: doc.sent_at || new Date().toISOString(),
                    deposit_required: depositAmount,
                    send_options_json: sendOptions
                  }).eq('id', doc.id)

                  setDoc({ ...doc, status: 'sent', sent_at: doc.sent_at || new Date().toISOString(), deposit_required: depositAmount })

                  navigator.clipboard.writeText(window.location.origin + '/view/' + doc.id)
                  showToast('Settings saved & link copied!', 'success')
                }}
                variant="secondary"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Copy Link
              </ActionButton>
              <div style={{ display: 'flex', gap: '12px' }}>
                <ActionButton onClick={() => setShowSendModal(false)} variant="secondary">Cancel</ActionButton>
                <ActionButton onClick={handleSendDocument} disabled={sendingDocument || (!sendEmail && !sendSms)} variant="primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  {sendingDocument ? 'Sending...' : 'Send'}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowArchiveModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Archive {isQuote ? 'Quote' : 'Invoice'}</h2>
              <button onClick={() => setShowArchiveModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px' }}>
              {/* Archive As */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ ...labelStyle, marginBottom: '12px' }}>Archive As</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={() => setArchiveBucket('won')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', background: archiveBucket === 'won' ? 'rgba(16,185,129,0.2)' : '#1d1d1d', border: archiveBucket === 'won' ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={archiveBucket === 'won' ? '#10b981' : '#64748b'} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span style={{ color: archiveBucket === 'won' ? '#10b981' : '#94a3b8', fontWeight: 600 }}>Won</span>
                  </button>
                  <button onClick={() => setArchiveBucket('lost')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', background: archiveBucket === 'lost' ? 'rgba(239,68,68,0.2)' : '#1d1d1d', border: archiveBucket === 'lost' ? '2px solid #ef4444' : '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={archiveBucket === 'lost' ? '#ef4444' : '#64748b'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <span style={{ color: archiveBucket === 'lost' ? '#ef4444' : '#94a3b8', fontWeight: 600 }}>Lost</span>
                  </button>
                </div>
              </div>
              
              {/* Reason (only for Lost) */}
              {archiveBucket === 'lost' && (
                <div>
                  <label style={{ ...labelStyle, marginBottom: '12px' }}>Reason</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { value: 'COMPETITOR', label: 'Went with competitor' },
                      { value: 'BUDGET', label: 'Budget issues' },
                      { value: 'NO_RESPONSE', label: 'No response' },
                      { value: 'TIMING', label: 'Bad timing' },
                      { value: 'OTHER', label: 'Other' }
                    ].map(reason => (
                      <label key={reason.value} onClick={() => setArchiveReason(reason.value)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: archiveReason === reason.value ? 'rgba(215,28,209,0.1)' : '#1d1d1d', border: archiveReason === reason.value ? '1px solid #d71cd1' : '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: archiveReason === reason.value ? '2px solid #d71cd1' : '2px solid rgba(148,163,184,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {archiveReason === reason.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d71cd1' }} />}
                        </div>
                        <span style={{ color: '#f1f5f9', fontSize: '14px' }}>{reason.label}</span>
                      </label>
                    ))}
                  </div>
                  {archiveReason === 'OTHER' && (
                    <input type="text" value={archiveOtherReason} onChange={(e) => setArchiveOtherReason(e.target.value)} placeholder="Enter reason..." style={{ ...inputStyle, marginTop: '12px' }} />
                  )}
                </div>
              )}
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <ActionButton onClick={() => setShowArchiveModal(false)} variant="secondary">Cancel</ActionButton>
              <ActionButton onClick={handleArchive} disabled={saving || (archiveBucket === 'lost' && !archiveReason) || (archiveReason === 'OTHER' && !archiveOtherReason)} variant="primary">Archive</ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Fulfillment Type Modal */}
      {showFulfillmentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowFulfillmentModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Fulfillment Method</h2>
              <button onClick={() => setShowFulfillmentModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {([
                  { key: 'on_site_pickup', label: 'On-Site Pickup', desc: 'Customer picks up at our location', icon: '\uD83C\uDFE2' },
                  { key: 'on_site_service', label: 'On-Site Service', desc: 'We service at customer location', icon: '\uD83D\uDEE0\uFE0F' },
                  { key: 'pickup_and_delivery', label: 'Pickup & Delivery', desc: 'We pick up and deliver back', icon: '\uD83D\uDE9A' },
                  { key: 'shipping', label: 'Shipping', desc: 'Ship completed product', icon: '\uD83D\uDCE6' },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setFulfillmentType(opt.key)} style={{
                    padding: '14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                    border: fulfillmentType === opt.key ? '2px solid #d71cd1' : '2px solid rgba(148,163,184,0.15)',
                    background: fulfillmentType === opt.key ? 'rgba(215,28,209,0.08)' : '#1d1d1d',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>{opt.icon}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: fulfillmentType === opt.key ? '#d71cd1' : '#f1f5f9', marginBottom: '2px' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Type-specific fields */}
              {fulfillmentType === 'on_site_service' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#1a1a1a', borderRadius: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Service Address</label>
                    <input type="text" value={fulfillmentDetails.service_address || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, service_address: e.target.value })}
                      placeholder="Address for on-site service" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Drop-off Date</label>
                      <input type="date" value={fulfillmentDetails.dropoff_date || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, dropoff_date: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Pickup Date</label>
                      <input type="date" value={fulfillmentDetails.pickup_date || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, pickup_date: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Service Fee ($)</label>
                    <input type="number" value={fulfillmentDetails.service_fee || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, service_fee: parseFloat(e.target.value) || 0 })}
                      placeholder="0" style={{ width: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                </div>
              )}

              {fulfillmentType === 'pickup_and_delivery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#1a1a1a', borderRadius: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Pickup Address</label>
                    <input type="text" value={fulfillmentDetails.pickup_address || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, pickup_address: e.target.value })}
                      placeholder="Address to pick up from" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Delivery Address</label>
                    <input type="text" value={fulfillmentDetails.delivery_address || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, delivery_address: e.target.value })}
                      placeholder="Address to deliver to" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Pickup Date</label>
                      <input type="date" value={fulfillmentDetails.pickup_date || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, pickup_date: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Delivery Date</label>
                      <input type="date" value={fulfillmentDetails.delivery_date || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, delivery_date: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Pickup Fee ($)</label>
                      <input type="number" value={fulfillmentDetails.pickup_fee || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, pickup_fee: parseFloat(e.target.value) || 0 })}
                        placeholder="0" style={{ width: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Delivery Fee ($)</label>
                      <input type="number" value={fulfillmentDetails.delivery_fee || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, delivery_fee: parseFloat(e.target.value) || 0 })}
                        placeholder="0" style={{ width: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                </div>
              )}

              {fulfillmentType === 'shipping' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#1a1a1a', borderRadius: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Shipping Address</label>
                    <input type="text" value={fulfillmentDetails.shipping_address || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, shipping_address: e.target.value })}
                      placeholder="Full shipping address" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Shipping Method</label>
                      <input type="text" value={fulfillmentDetails.shipping_method || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, shipping_method: e.target.value })}
                        placeholder="e.g., USPS Priority" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Shipping Fee ($)</label>
                      <input type="number" value={fulfillmentDetails.shipping_fee || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, shipping_fee: parseFloat(e.target.value) || 0 })}
                        placeholder="0" style={{ width: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Tracking Number</label>
                    <input type="text" value={fulfillmentDetails.tracking_number || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, tracking_number: e.target.value })}
                      placeholder="Tracking # (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                  </div>
                </div>
              )}

              {fulfillmentType === 'on_site_pickup' && (
                <div style={{ padding: '16px', background: '#1a1a1a', borderRadius: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Notes</label>
                    <textarea value={fulfillmentDetails.notes || ''} onChange={e => setFulfillmentDetails({ ...fulfillmentDetails, notes: e.target.value })}
                      placeholder="Any pickup instructions..." rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px', resize: 'vertical' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowFulfillmentModal(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveFulfillment} disabled={saving} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Save Fulfillment</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDeleteModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', width: '100%', maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </div>
                <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Delete {isQuote ? 'Quote' : 'Invoice'}?</h2>
              </div>
              <button onClick={() => setShowDeleteModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                Are you sure you want to permanently delete <strong style={{ color: '#f1f5f9' }}>{doc.doc_type} #{doc.doc_number}</strong>?
              </p>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '12px 0 0 0', lineHeight: '1.6' }}>
                This will delete:
              </p>
              <ul style={{ color: '#94a3b8', fontSize: '14px', margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>The document and all its data</li>
                <li>All line items</li>
                <li>All associated tasks</li>
              </ul>
              {payments.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, fontWeight: 500 }}>
                    ⚠️ This document has {payments.length} payment{payments.length > 1 ? 's' : ''}. Delete will fail.
                  </p>
                </div>
              )}
              <p style={{ color: '#ef4444', fontSize: '13px', margin: '16px 0 0 0', fontWeight: 500 }}>
                This action cannot be undone.
              </p>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <ActionButton onClick={() => setShowDeleteModal(false)} variant="secondary" disabled={deleting}>Cancel</ActionButton>
              <ActionButton
                onClick={handleDelete}
                disabled={deleting}
                variant="secondary"
                style={{ background: '#ef4444', color: 'white', borderColor: '#ef4444' }}
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowScheduleModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Schedule Project</h2>
              <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px' }}>
              {/* Project Title */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Project Title *</label>
                <input type="text" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} style={inputStyle} />
              </div>
              
              {/* Vehicle On Site Section */}
              <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(34,197,94,0.05)', border: '2px dashed rgba(34,197,94,0.3)', borderRadius: '12px' }}>
                <h3 style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Vehicle On Site
                  <span style={{ fontWeight: 400, fontSize: '12px', color: '#64748b' }}>(syncs to Google Calendar)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Drop-off Date *</label>
                    <input type="date" value={vehicleStartDate} onChange={(e) => setVehicleStartDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Drop-off Time</label>
                    <input type="time" value={vehicleStartTime} onChange={(e) => setVehicleStartTime(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Pick-up Date *</label>
                    <input type="date" value={vehicleEndDate} onChange={(e) => setVehicleEndDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Pick-up Time</label>
                    <input type="time" value={vehicleEndTime} onChange={(e) => setVehicleEndTime(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>
              
              {/* Install Period Section */}
              <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.4)', borderRadius: '12px' }}>
                <h3 style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Install Period
                  <span style={{ fontWeight: 400, fontSize: '12px', color: '#64748b' }}>(internal scheduling)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Install Start *</label>
                    <input type="date" value={installStartDate} onChange={(e) => setInstallStartDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input type="time" value={installStartTime} onChange={(e) => setInstallStartTime(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Install End *</label>
                    <input type="date" value={installEndDate} onChange={(e) => setInstallEndDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input type="time" value={installEndTime} onChange={(e) => setInstallEndTime(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>
              
              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Additional notes..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <ActionButton onClick={() => setShowScheduleModal(false)} variant="secondary">Cancel</ActionButton>
              <ActionButton onClick={handleScheduleEvent} disabled={schedulingEvent || !scheduleTitle || !vehicleStartDate || !vehicleEndDate || !installStartDate || !installEndDate} variant="success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {schedulingEvent ? 'Scheduling...' : 'Schedule Project'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowRecordPaymentModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Record Payment</h2>
              <button onClick={() => setShowRecordPaymentModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Amount *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>$</span>
                  <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '28px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={() => setPaymentAmount(balanceDue)} style={{ padding: '4px 10px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>Balance (${balanceDue.toFixed(2)})</button>
                  <button onClick={() => setPaymentAmount(total * 0.5)} style={{ padding: '4px 10px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>50% (${(total * 0.5).toFixed(2)})</button>
                  <button onClick={() => setPaymentAmount(total)} style={{ padding: '4px 10px', background: '#282a30', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>Full (${total.toFixed(2)})</button>
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { value: 'card', label: 'Card', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
                    { value: 'cash', label: 'Cash', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                    { value: 'check', label: 'Check', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
                    { value: 'other', label: 'Other', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
                  ].map(method => (
                    <button key={method.value} onClick={() => setPaymentMethod(method.value)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 8px', background: paymentMethod === method.value ? 'rgba(215,28,209,0.2)' : '#1d1d1d', border: paymentMethod === method.value ? '1px solid #d71cd1' : '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: paymentMethod === method.value ? '#d71cd1' : '#94a3b8', cursor: 'pointer' }}>
                      {method.icon}
                      <span style={{ fontSize: '12px' }}>{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input type="text" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="e.g., Check #1234, Square terminal" style={inputStyle} />
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <ActionButton onClick={() => setShowRecordPaymentModal(false)} variant="secondary">Cancel</ActionButton>
              <ActionButton onClick={handleRecordPayment} disabled={recordingPayment || paymentAmount <= 0} variant="success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                {recordingPayment ? 'Recording...' : 'Record Payment'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Line Item Lightbox */}
      {lineItemLightboxUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
            <div style={{ color: 'white', fontSize: '14px' }}>{lineItemLightbox && lineItemLightboxImages.length > 1 && `${lineItemLightbox.index + 1} / ${lineItemLightboxImages.length}`}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setLightboxZoom(z => Math.min(z * 1.5, 5))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom In"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
              <button onClick={() => { setLightboxZoom(z => { const nz = Math.max(z / 1.5, 1); if (nz === 1) setLightboxPan({ x: 0, y: 0 }); return nz }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom Out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
              <button onClick={() => { setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
              <button onClick={() => { setLineItemLightbox(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {lineItemLightboxImages.length > 1 && <button onClick={() => { setLineItemLightbox(prev => prev ? { ...prev, index: prev.index > 0 ? prev.index - 1 : lineItemLightboxImages.length - 1 } : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="15 18 9 12 15 6"/></svg></button>}
            <div 
              onClick={(e) => { if (e.target === e.currentTarget) { setLineItemLightbox(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) } }} 
              onDoubleClick={() => { 
                if (lightboxZoom > 1) { 
                  setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) 
                } else { 
                  setLightboxZoom(2.5)
                } 
              }} 
              onMouseDown={(e) => {
                if (lightboxZoom <= 1) return
                e.preventDefault()
                const startX = e.clientX - lightboxPan.x
                const startY = e.clientY - lightboxPan.y
                const handleMouseMove = (moveE: MouseEvent) => {
                  setLightboxPan({ x: moveE.clientX - startX, y: moveE.clientY - startY })
                }
                const handleMouseUp = () => {
                  window.removeEventListener('mousemove', handleMouseMove)
                  window.removeEventListener('mouseup', handleMouseUp)
                }
                window.addEventListener('mousemove', handleMouseMove)
                window.addEventListener('mouseup', handleMouseUp)
              }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: lightboxZoom > 1 ? 'grab' : 'zoom-in', height: '100%' }}
            >
              <img src={lineItemLightboxUrl} alt="Full size" draggable={false} style={{ maxWidth: lightboxZoom === 1 ? '90vw' : 'none', maxHeight: lightboxZoom === 1 ? '80vh' : 'none', transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`, transition: 'transform 0.05s ease-out', borderRadius: '4px', userSelect: 'none' }} />
            </div>
            {lineItemLightboxImages.length > 1 && <button onClick={() => { setLineItemLightbox(prev => prev ? { ...prev, index: prev.index < lineItemLightboxImages.length - 1 ? prev.index + 1 : 0 } : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="9 18 15 12 9 6"/></svg></button>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', gap: '20px' }}>
            <a href={lineItemLightboxUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#d71cd1', textDecoration: 'none', fontSize: '14px' }}>Open in New Tab</a>
            <a href={lineItemLightboxUrl} download style={{ color: '#d71cd1', textDecoration: 'none', fontSize: '14px' }}>Download</a>
          </div>
        </div>
      )}

      {/* Send to Zayn Modal */}
      {showZaynModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => !zaynSending && setShowZaynModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 600, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Send to Zayn for Digitizing
              </h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px 0' }}>
                {isQuote ? 'Quote' : 'Invoice'} #{doc.doc_number} - {customerName}
              </p>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Attachments Selection */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Attachments</label>
                {attachments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {attachments.map((a) => {
                      const isSelected = zaynSelectedFiles.some(f => f.url === a.url)
                      return (
                        <label key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: isSelected ? 'rgba(139, 92, 246, 0.1)' : '#1d1d1d', border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.4)' : 'rgba(148,163,184,0.15)'}`, borderRadius: '8px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={isSelected} onChange={() => {
                            if (isSelected) {
                              setZaynSelectedFiles(prev => prev.filter(f => f.url !== a.url))
                            } else {
                              setZaynSelectedFiles(prev => [...prev, { url: a.url, filename: a.filename }])
                            }
                          }} style={{ accentColor: '#8b5cf6' }} />
                          <span style={{ color: '#f1f5f9', fontSize: '13px', flex: 1 }}>{a.filename}</span>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>{a.contentType?.split('/')[1]?.toUpperCase()}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '13px' }}>No project files attached</p>
                )}
              </div>

              {/* Item Type */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Item Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['flat', 'cap', 'both'] as const).map(type => (
                    <button key={type} onClick={() => setZaynItemType(type)} style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                      background: zaynItemType === type ? 'rgba(139, 92, 246, 0.2)' : '#1d1d1d',
                      border: `1px solid ${zaynItemType === type ? 'rgba(139, 92, 246, 0.5)' : 'rgba(148,163,184,0.15)'}`,
                      color: zaynItemType === type ? '#8b5cf6' : '#94a3b8'
                    }}>{type}</button>
                  ))}
                </div>
              </div>

              {/* Dimensions for Flat */}
              {(zaynItemType === 'flat' || zaynItemType === 'both') && (
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Flat Dimensions</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setZaynFlatDimType('width')} style={{
                        padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        background: zaynFlatDimType === 'width' ? 'rgba(139, 92, 246, 0.2)' : '#1d1d1d',
                        border: `1px solid ${zaynFlatDimType === 'width' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(148,163,184,0.15)'}`,
                        color: zaynFlatDimType === 'width' ? '#8b5cf6' : '#94a3b8'
                      }}>Width</button>
                      <button onClick={() => setZaynFlatDimType('height')} style={{
                        padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        background: zaynFlatDimType === 'height' ? 'rgba(139, 92, 246, 0.2)' : '#1d1d1d',
                        border: `1px solid ${zaynFlatDimType === 'height' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(148,163,184,0.15)'}`,
                        color: zaynFlatDimType === 'height' ? '#8b5cf6' : '#94a3b8'
                      }}>Height</button>
                    </div>
                    <input type="text" value={zaynFlatDimValue} onChange={(e) => setZaynFlatDimValue(e.target.value)} placeholder='e.g., 3.5"' style={{ flex: 1, padding: '8px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }} />
                  </div>
                </div>
              )}

              {/* Dimensions for Cap */}
              {(zaynItemType === 'cap' || zaynItemType === 'both') && (
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Cap Dimensions</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setZaynCapDimType('width')} style={{
                        padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        background: zaynCapDimType === 'width' ? 'rgba(139, 92, 246, 0.2)' : '#1d1d1d',
                        border: `1px solid ${zaynCapDimType === 'width' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(148,163,184,0.15)'}`,
                        color: zaynCapDimType === 'width' ? '#8b5cf6' : '#94a3b8'
                      }}>Width</button>
                      <button onClick={() => setZaynCapDimType('height')} style={{
                        padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        background: zaynCapDimType === 'height' ? 'rgba(139, 92, 246, 0.2)' : '#1d1d1d',
                        border: `1px solid ${zaynCapDimType === 'height' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(148,163,184,0.15)'}`,
                        color: zaynCapDimType === 'height' ? '#8b5cf6' : '#94a3b8'
                      }}>Height</button>
                    </div>
                    <input type="text" value={zaynCapDimValue} onChange={(e) => setZaynCapDimValue(e.target.value)} placeholder='e.g., 2.25"' style={{ flex: 1, padding: '8px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }} />
                  </div>
                </div>
              )}

              {/* RUSH checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 12px', background: zaynRush ? 'rgba(239, 68, 68, 0.1)' : '#1d1d1d', border: `1px solid ${zaynRush ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148,163,184,0.15)'}`, borderRadius: '8px' }}>
                <input type="checkbox" checked={zaynRush} onChange={(e) => setZaynRush(e.target.checked)} style={{ accentColor: '#ef4444' }} />
                <span style={{ color: zaynRush ? '#ef4444' : '#94a3b8', fontSize: '14px', fontWeight: 600 }}>RUSH ORDER</span>
              </label>

              {/* Thread colors display */}
              {matchedCustomer?.emb_thread_colors && (
                <div style={{ padding: '10px 12px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Thread Colors: </span>
                  <span style={{ color: '#f1f5f9', fontSize: '13px' }}>{matchedCustomer.emb_thread_colors}</span>
                </div>
              )}

              {/* Message */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Additional Notes</label>
                <textarea value={zaynMessage} onChange={(e) => setZaynMessage(e.target.value)} rows={3} placeholder="Any special instructions..." style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              {/* Email Preview */}
              <div style={{ padding: '12px', background: '#0a0a0a', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.1)' }}>
                <p style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Email Preview</p>
                <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                  <strong>To:</strong> zayn.thedesignpals@gmail.com
                </p>
                <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                  <strong>Subject:</strong> Please Digitize{zaynRush ? ' RUSH' : ''} - {customerName} (#{doc.doc_number})
                </p>
                <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '0' }}>
                  <strong>Attachments:</strong> {zaynSelectedFiles.length > 0 ? zaynSelectedFiles.map(f => f.filename).join(', ') : 'None'}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <ActionButton onClick={() => setShowZaynModal(false)} variant="secondary" disabled={zaynSending}>Cancel</ActionButton>
                <button
                  onClick={async () => {
                    setZaynSending(true)
                    try {
                      // Build email body
                      let bodyParts: string[] = []
                      bodyParts.push(`<p>Hi Zayn,</p>`)
                      bodyParts.push(`<p>Please digitize the attached design${zaynRush ? ' <strong style="color:red">- RUSH ORDER</strong>' : ''}.</p>`)
                      bodyParts.push(`<p><strong>Customer:</strong> ${customerName}<br/>`)
                      bodyParts.push(`<strong>${isQuote ? 'Quote' : 'Invoice'}:</strong> #${doc.doc_number}</p>`)

                      // Dimensions
                      if (zaynItemType === 'flat' || zaynItemType === 'both') {
                        bodyParts.push(`<p><strong>Flat:</strong> ${zaynFlatDimType === 'width' ? 'W' : 'H'}: ${zaynFlatDimValue || 'Not specified'}</p>`)
                      }
                      if (zaynItemType === 'cap' || zaynItemType === 'both') {
                        bodyParts.push(`<p><strong>Cap:</strong> ${zaynCapDimType === 'width' ? 'W' : 'H'}: ${zaynCapDimValue || 'Not specified'}</p>`)
                      }

                      // Thread colors
                      if (matchedCustomer?.emb_thread_colors) {
                        bodyParts.push(`<p><strong>Thread Colors:</strong> ${matchedCustomer.emb_thread_colors}</p>`)
                      }

                      if (zaynMessage) {
                        bodyParts.push(`<p><strong>Notes:</strong> ${zaynMessage}</p>`)
                      }

                      bodyParts.push(`<p>Thank you!</p>`)

                      const subject = `Please Digitize${zaynRush ? ' RUSH' : ''} - ${customerName} (#${doc.doc_number})`

                      const res = await fetch('/api/email/zayn', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          subject,
                          body: bodyParts.join('\n'),
                          attachmentUrls: zaynSelectedFiles.length > 0 ? zaynSelectedFiles : undefined
                        })
                      })

                      const data = await res.json()
                      if (data.success) {
                        showToast('Email sent to Zayn!', 'success')
                        setShowZaynModal(false)
                        setZaynItemType('flat')
                        setZaynFlatDimValue('')
                        setZaynCapDimValue('')
                        setZaynRush(false)
                        setZaynMessage('')
                        setZaynSelectedFiles([])
                      } else {
                        showToast(data.error || 'Failed to send email', 'error')
                      }
                    } catch (err: any) {
                      showToast(err.message || 'Failed to send email', 'error')
                    }
                    setZaynSending(false)
                  }}
                  disabled={zaynSending}
                  style={{
                    padding: '10px 20px',
                    background: zaynRush ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: zaynSending ? 'not-allowed' : 'pointer',
                    opacity: zaynSending ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {zaynSending ? 'Sending...' : zaynRush ? 'Send RUSH to Zayn' : 'Send to Zayn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 3000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{ 
            padding: '12px 20px', 
            borderRadius: '8px', 
            background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(59,130,246,0.95)', 
            color: 'white', 
            fontSize: '14px', 
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideIn 0.2s ease-out'
          }}>
            {toast.type === 'success' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
            {toast.type === 'error' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            {toast.type === 'info' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Option Lightbox */}
      {optionLightboxOptionId !== null && optionLightboxIndex !== null && (() => {
        const opt = options.find(o => o.id === optionLightboxOptionId)
        if (!opt) return null
        const optImages = (opt.attachments || []).filter(att => {
          const url = att.url || att.file_url || ''
          const name = att.filename || att.file_name || att.name || ''
          return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(name + url)
        })
        if (optImages.length === 0) return null
        const currentAtt = optImages[optionLightboxIndex]
        const currentUrl = currentAtt?.url || currentAtt?.file_url || ''
        
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
              <div style={{ color: 'white', fontSize: '14px' }}>{optImages.length > 1 && `${optionLightboxIndex + 1} / ${optImages.length}`}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setOptionLightboxZoom(z => Math.min(z * 1.5, 5))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom In"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
                <button onClick={() => { setOptionLightboxZoom(z => { const nz = Math.max(z / 1.5, 1); if (nz === 1) setOptionLightboxPan({ x: 0, y: 0 }); return nz }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom Out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
                <button onClick={() => { setOptionLightboxZoom(1); setOptionLightboxPan({ x: 0, y: 0 }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
                <button onClick={() => { setOptionLightboxOptionId(null); setOptionLightboxIndex(null); setOptionLightboxZoom(1); setOptionLightboxPan({ x: 0, y: 0 }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {optImages.length > 1 && <button onClick={() => { setOptionLightboxIndex(i => i !== null ? (i > 0 ? i - 1 : optImages.length - 1) : null); setOptionLightboxZoom(1); setOptionLightboxPan({ x: 0, y: 0 }) }} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="15 18 9 12 15 6"/></svg></button>}
              <div 
                onClick={(e) => { if (e.target === e.currentTarget) { setOptionLightboxOptionId(null); setOptionLightboxIndex(null); setOptionLightboxZoom(1); setOptionLightboxPan({ x: 0, y: 0 }) } }} 
                onDoubleClick={() => { 
                  if (optionLightboxZoom > 1) { 
                    setOptionLightboxZoom(1); setOptionLightboxPan({ x: 0, y: 0 }) 
                  } else { 
                    setOptionLightboxZoom(2.5)
                  } 
                }}
                onMouseDown={(e) => {
                  if (optionLightboxZoom <= 1) return
                  const startX = e.clientX - optionLightboxPan.x
                  const startY = e.clientY - optionLightboxPan.y
                  const handleMouseMove = (moveE: MouseEvent) => {
                    setOptionLightboxPan({ x: moveE.clientX - startX, y: moveE.clientY - startY })
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: optionLightboxZoom > 1 ? 'grab' : 'zoom-in', height: '100%' }}
              >
                <img src={currentUrl} alt="Full size" draggable={false} style={{ maxWidth: optionLightboxZoom === 1 ? '90vw' : 'none', maxHeight: optionLightboxZoom === 1 ? '80vh' : 'none', transform: `translate(${optionLightboxPan.x}px, ${optionLightboxPan.y}px) scale(${optionLightboxZoom})`, transition: 'transform 0.1s ease-out', borderRadius: '4px' }} />
              </div>
              {optImages.length > 1 && <button onClick={() => { setOptionLightboxIndex(i => i !== null ? (i < optImages.length - 1 ? i + 1 : 0) : null); setOptionLightboxZoom(1); setOptionLightboxPan({ x: 0, y: 0 }) }} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="9 18 15 12 9 6"/></svg></button>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', gap: '20px' }}>
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#d71cd1', textDecoration: 'none', fontSize: '14px' }}>Open in New Tab</a>
              <a href={currentUrl} download style={{ color: '#d71cd1', textDecoration: 'none', fontSize: '14px' }}>Download</a>
            </div>
          </div>
        )
      })()}

      {/* Lightbox */}
      {lightboxUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
            <div style={{ color: 'white', fontSize: '14px' }}>{lightboxIndex !== null && imageAttachments.length > 1 && `${lightboxIndex + 1} / ${imageAttachments.length}`}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setLightboxZoom(z => Math.min(z * 1.5, 5))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom In"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
              <button onClick={() => { setLightboxZoom(z => { const nz = Math.max(z / 1.5, 1); if (nz === 1) setLightboxPan({ x: 0, y: 0 }); return nz }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom Out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
              <button onClick={() => { setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
              <button onClick={() => { setLightboxIndex(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {imageAttachments.length > 1 && <button onClick={() => { setLightboxIndex(i => i !== null ? (i > 0 ? i - 1 : imageAttachments.length - 1) : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="15 18 9 12 15 6"/></svg></button>}
            <div onClick={(e) => { if (e.target === e.currentTarget) { setLightboxIndex(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) } }} onDoubleClick={() => { 
                if (lightboxZoom > 1) { 
                  setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) 
                } else { 
                  setLightboxZoom(2.5)
                } 
              }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: lightboxZoom > 1 ? 'grab' : 'zoom-in', height: '100%' }}>
              <img src={lightboxUrl} alt="Full size" draggable={false} style={{ maxWidth: lightboxZoom === 1 ? '90vw' : 'none', maxHeight: lightboxZoom === 1 ? '80vh' : 'none', transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`, transition: 'transform 0.1s ease-out', borderRadius: '4px' }} />
            </div>
            {imageAttachments.length > 1 && <button onClick={() => { setLightboxIndex(i => i !== null ? (i < imageAttachments.length - 1 ? i + 1 : 0) : null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) }} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><polyline points="9 18 15 12 9 6"/></svg></button>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', gap: '20px' }}>
            <a href={lightboxUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#d71cd1', textDecoration: 'none', fontSize: '14px' }}>Open in New Tab</a>
            <a href={lightboxUrl} download style={{ color: '#d71cd1', textDecoration: 'none', fontSize: '14px' }}>Download</a>
          </div>
        </div>
      )}

      {/* Garment Mockup Builder Modal */}
      {mockupBuilderOpen && (
        <GarmentMockupBuilder
          garmentImageUrl={mockupGarmentUrl}
          garmentName={mockupGarmentName}
          colorName={mockupColorName}
          onSave={handleSaveMockup}
          onClose={() => {
            setMockupBuilderOpen(false)
            setMockupLineItemId(null)
          }}
        />
      )}
    </div>
  )
}