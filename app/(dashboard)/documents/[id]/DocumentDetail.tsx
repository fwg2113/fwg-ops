'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

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
  variant?: 'primary' | 'secondary' | 'success'
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
type Attachment = { url: string; key: string; filename: string; contentType: string; size: number; uploadedAt: string }
type Customer = { id: string; display_name: string; first_name: string; last_name: string; email: string; phone: string; company: string }

type Document = {
  id: string; doc_number: number; doc_type: string; status: string; bucket: string; customer_id: string
  customer_name: string; customer_email: string; customer_phone: string; company_name: string
  vehicle_description: string; project_description: string; category: string
  subtotal: number; discount_amount: number; discount_percent: number; tax_amount: number; total: number
  deposit_required: number; deposit_paid: number; amount_paid: number; balance_due: number
  notes: string; created_at: string; sent_at: string; viewed_at: string; approved_at: string; paid_at: string
  valid_until: string | null; attachments?: Attachment[]; in_production: boolean; fees?: Fee[] | string
  followup_count?: number; last_followup_at?: string
}

type LineItem = {
  id: string; document_id: string; group_id: string; category: string; line_type: string; package_key: string
  description: string; quantity: number; sqft: number; unit_price: number; rate: number; line_total: number
  sort_order: number; attachments?: Attachment[]; custom_fields?: Record<string, any>
}

type LineItemGroup = { group_id: string; category_key: string }

type Category = {
  category_key: string; parent_category: string; label: string; calendar_color: string
  line_template: string; has_types: boolean; has_packages: boolean
  unit_label: string; default_rate: number; sort_order: number; active: boolean
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
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  
  // Fees state - load from document
  const [fees, setFees] = useState<Fee[]>(() => {
    try {
      return Array.isArray(initialDoc.fees) ? initialDoc.fees : JSON.parse(initialDoc.fees || '[]')
    } catch { return [] }
  })
  
  // Discount/Tax/Notes state
  const [discountAmountInput, setDiscountAmountInput] = useState(initialDoc.discount_amount || 0)
  const [discountPercentInput, setDiscountPercentInput] = useState(initialDoc.discount_percent || 0)
  const [taxAmountInput, setTaxAmountInput] = useState(initialDoc.tax_amount || 0)
  const [depositRequired, setDepositRequired] = useState(initialDoc.deposit_required || 0)
  const [validUntil, setValidUntil] = useState(initialDoc.valid_until ? initialDoc.valid_until.split('T')[0] : '')
  const [notes, setNotes] = useState(initialDoc.notes || '')

  // Payments state
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Modals
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveBucket, setArchiveBucket] = useState<'won' | 'lost'>('lost')
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveOtherReason, setArchiveOtherReason] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  
  // Send modal state
  const [sendEmail, setSendEmail] = useState(true)
  const [sendSms, setSendSms] = useState(true)
  const [sendingDocument, setSendingDocument] = useState(false)
  const [approvalType, setApprovalType] = useState('both')
  const [customApprovalText, setCustomApprovalText] = useState('')
  const [includeLineAttachments, setIncludeLineAttachments] = useState(true)
  const [includeProjectAttachments, setIncludeProjectAttachments] = useState(false)
  const [paymentTerms, setPaymentTerms] = useState('deposit_50')
  const [customPaymentAmount, setCustomPaymentAmount] = useState(0)
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

  const imageAttachments = attachments.filter(a => a.contentType?.startsWith('image/'))
  const lightboxUrl = lightboxIndex !== null ? imageAttachments[lightboxIndex]?.url : null

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
  const feesTotal = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  const discountAmount = doc.discount_percent ? (subtotal * doc.discount_percent / 100) : (doc.discount_amount || 0)
  const taxAmount = doc.tax_amount || 0
  const total = subtotal + feesTotal - discountAmount + taxAmount
  const balanceDue = total - (doc.amount_paid || 0)

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
      alert('Please enter a message')
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
      alert('Follow-up sent!')

    } catch (err) {
      console.error('Follow-up error:', err)
      alert('Failed to send follow-up')
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
    if (!sendEmail && !sendSms) { alert('Select at least one delivery method'); return }
    setSendingDocument(true)
    
    try {
      const customerLink = window.location.origin + '/view/' + doc.id
      const docLabel = (doc.doc_type === 'quote' ? 'Quote' : 'Invoice') + ' #' + doc.doc_number
      const firstName = customerName.split(' ')[0] || 'there'
      
      // Determine deposit amount based on payment terms
      let depositAmount = 0
      if (paymentTerms === 'deposit_50') depositAmount = total * 0.5
      else if (paymentTerms === 'full') depositAmount = total
      else if (paymentTerms === 'custom') depositAmount = customPaymentAmount
      
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
          alert('Email failed: ' + emailData.error)
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
            alert('SMS failed: ' + (smsData.error || JSON.stringify(smsData)))
          } else {
            console.log('SMS sent successfully!')
          }
        } catch (smsErr) {
          console.error('SMS fetch error:', smsErr)
          alert('SMS error: ' + smsErr)
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
      alert('Sent successfully!')
      
    } catch (err) {
      alert('Failed to send')
    }
    setSendingDocument(false)
  }

  const handleConvertToInvoice = async () => {
    if (!confirm('Convert to invoice?')) return
    setSaving(true)
    await supabase.from('documents').update({ doc_type: 'invoice', status: 'pending' }).eq('id', doc.id)
    setDoc({ ...doc, doc_type: 'invoice', status: 'pending' })
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
    router.push(doc.doc_type === 'quote' ? '/quotes' : '/invoices')
    setSaving(false)
  }

  const handleMoveToCold = async () => {
    if (!confirm(`Move this ${doc.doc_type} to Cold?`)) return
    setSaving(true)
    await supabase.from('documents').update({ bucket: 'COLD' }).eq('id', doc.id)
    setDoc({ ...doc, bucket: 'COLD' })
    router.push(doc.doc_type === 'quote' ? '/quotes' : '/invoices')
    setSaving(false)
  }

  const handleMoveToProduction = async () => {
    if (!confirm('Move this invoice to Production? This will generate production tasks based on line item categories.')) return
    setSaving(true)
    
    try {
      // Update document
      await supabase.from('documents').update({ 
        in_production: true,
        bucket: 'IN_PRODUCTION'
      }).eq('id', doc.id)
      
      // Generate production tasks for each line item category
      const categories = [...new Set(lineItems.map(item => item.category).filter(Boolean))]
      let tasksCreated = 0
      
      for (const category of categories) {
        // Create basic production tasks
        const tasks = [
          { task_name: 'Print', step_order: 1 },
          { task_name: 'Laminate', step_order: 2 },
          { task_name: 'Cut', step_order: 3 },
          { task_name: 'Install', step_order: 4 }
        ]
        
        for (const task of tasks) {
          await supabase.from('production_tasks').insert({
            invoice_id: doc.id,
            category: category,
            task_name: task.task_name,
            step_order: task.step_order,
            status: 'pending'
          })
          tasksCreated++
        }
      }
      
      setDoc({ ...doc, in_production: true, bucket: 'IN_PRODUCTION' })
      alert(`Moved to Production! ${tasksCreated} tasks created.`)
      
    } catch (err) {
      console.error('Error moving to production:', err)
      alert('Failed to move to production')
    }
    
    setSaving(false)
  }

  const handleMarkPaid = async () => {
    setSaving(true)
    await supabase.from('documents').update({ status: 'paid', paid_at: new Date().toISOString(), amount_paid: total, balance_due: 0 }).eq('id', doc.id)
    setDoc({ ...doc, status: 'paid', paid_at: new Date().toISOString(), amount_paid: total, balance_due: 0 })
    setSaving(false)
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
          notes: paymentNotes || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (paymentError) throw paymentError
      
      // Update document totals
      const newAmountPaid = (doc.amount_paid || 0) + paymentAmount
      const newBalanceDue = total - newAmountPaid
      const isPaidInFull = newBalanceDue <= 0
      
      const { error: docError } = await supabase
        .from('documents')
        .update({
          status: isPaidInFull ? 'paid' : 'partial',
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalanceDue),
          paid_at: isPaidInFull ? new Date().toISOString() : null
        })
        .eq('id', doc.id)
      
      if (docError) throw docError
      
      // Update local state
      setPayments([newPayment, ...payments])
      setDoc({ 
        ...doc, 
        status: isPaidInFull ? 'paid' : 'partial',
        amount_paid: newAmountPaid, 
        balance_due: Math.max(0, newBalanceDue),
        paid_at: isPaidInFull ? new Date().toISOString() : doc.paid_at
      })
      setShowRecordPaymentModal(false)
      
    } catch (err) {
      console.error('Error recording payment:', err)
      alert('Failed to record payment')
    }
    
    setRecordingPayment(false)
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
    const newItem = {
      document_id: doc.id,
      group_id: groupId,
      category: categoryKey,
      line_type: '',
      package_key: '',
      description: '',
      quantity: 1,
      sqft: 0,
      unit_price: category?.default_rate || 0,
      rate: category?.default_rate || 0,
      line_total: 0,
      sort_order: lineItems.length,
    }
    
    const { data, error } = await supabase.from('line_items').insert(newItem).select().single()
    if (data) {
      setLineItems([...lineItems, data as LineItem])
    }
  }

  const deleteGroup = (groupId: string) => {
    if (!confirm('Delete this section and all its items?')) return
    setLineItemGroups(lineItemGroups.filter(g => g.group_id !== groupId))
    const newItems = lineItems.filter(i => i.group_id !== groupId)
    setLineItems(newItems)
    updateDocumentTotals(newItems)
  }

  const addLineItemToGroup = async (groupId: string, categoryKey: string) => {
    const category = getCategoryByKey(categoryKey)
    const newItem = {
      document_id: doc.id,
      group_id: groupId,
      category: categoryKey,
      line_type: '',
      package_key: '',
      description: '',
      quantity: 1,
      sqft: 0,
      unit_price: category?.default_rate || 0,
      rate: category?.default_rate || 0,
      line_total: 0,
      sort_order: lineItems.length,
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
        line_total: updatedItem.line_total
      }).eq('id', itemId)
    }
    
    updateDocumentTotals(newItems)
  }

  const deleteLineItem = async (itemId: string) => {
    await supabase.from('line_items').delete().eq('id', itemId)
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
      total: newTotal 
    }).eq('id', doc.id)
    setDoc({ ...doc, discount_amount: discountAmountInput, discount_percent: discountPercentInput, total: newTotal })
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
      alert('Save failed: ' + error.message)
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
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
              
              if (isQuote) {
                // Send (unless declined/expired/archived)
                if (doc.status !== 'declined' && doc.status !== 'expired' && !isArchived) {
                  buttons.push(<ActionButton key="send" onClick={handleOpenSendModal} disabled={saving || (!customerEmail && !customerPhone)} variant="secondary">Send</ActionButton>)
                }
                // Follow Up (if sent, not approved/declined/expired/archived)
                if (hasBeenSent && !isArchived && doc.status !== 'approved' && doc.status !== 'declined' && doc.status !== 'expired') {
                  buttons.push(<ActionButton key="followup" onClick={handleOpenFollowUpModal} variant="secondary">Follow Up{doc.followup_count ? ` (${doc.followup_count})` : ''}</ActionButton>)
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
                // Schedule It (unless archived)
                if (!isArchived) {
                  buttons.push(<ActionButton key="schedule" onClick={() => setShowScheduleModal(true)} variant="primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Schedule It</ActionButton>)
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
              
              return buttons
            })()}
          </div>
        </div>
      </div>

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

      {/* Line Items */}
      <div style={cardStyle}>
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
                
                {/* Group Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#161616' }}>
                      {showPackages && <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '150px' }}>Package</th>}
                      {showTypes && <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '150px' }}>Type</th>}
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '80px' }}>{category?.unit_label || 'Qty'}</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '90px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', width: '100px' }}>Total</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
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
                          <button onClick={() => deleteLineItem(item.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
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
      </div>

      {/* Discount, Tax & Notes */}
      <div style={cardStyle}>
        <h3 style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0' }}>Adjustments & Notes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Discount ($)</label>
            <input type="number" step="0.01" value={discountAmountInput} onChange={(e) => setDiscountAmountInput(parseFloat(e.target.value) || 0)} onBlur={handleDiscountChange} style={inputStyle} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Discount (%)</label>
            <input type="number" step="0.1" value={discountPercentInput} onChange={(e) => setDiscountPercentInput(parseFloat(e.target.value) || 0)} onBlur={handleDiscountChange} style={inputStyle} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Tax ($)</label>
            <input type="number" step="0.01" value={taxAmountInput} onChange={(e) => setTaxAmountInput(parseFloat(e.target.value) || 0)} onBlur={handleTaxChange} style={inputStyle} placeholder="0.00" />
          </div>
        </div>
        {isInvoice && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Deposit Required</label>
              <input type="number" step="0.01" value={depositRequired} onChange={(e) => setDepositRequired(parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}
        <div>
          <label style={labelStyle}>Internal Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for internal use only..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      {/* Payments Section - Invoice Only */}
      {isInvoice && (
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
                      {payment.payment_method === 'card' ? 'Credit Card' : payment.payment_method === 'cash' ? 'Cash' : payment.payment_method === 'check' ? 'Check' : 'Other'}
                      {payment.processor && ` via ${payment.processor.charAt(0).toUpperCase() + payment.processor.slice(1)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#22c55e', fontSize: '12px', fontWeight: 500 }}>{payment.status}</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{formatDate(payment.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {payments.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '14px' }}>Total Paid</span>
              <span style={{ color: '#22c55e', fontSize: '16px', fontWeight: 600 }}>${(doc.amount_paid || 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div style={cardStyle}>
        <div style={{ maxWidth: '300px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#94a3b8', fontSize: '14px' }}>Subtotal</span><span style={{ color: '#f1f5f9', fontSize: '14px' }}>${subtotal.toFixed(2)}</span></div>
          {feesTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#94a3b8', fontSize: '14px' }}>Fees</span><span style={{ color: '#f1f5f9', fontSize: '14px' }}>${feesTotal.toFixed(2)}</span></div>}
          {discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#94a3b8', fontSize: '14px' }}>Discount</span><span style={{ color: '#ef4444', fontSize: '14px' }}>-${discountAmount.toFixed(2)}</span></div>}
          {taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#94a3b8', fontSize: '14px' }}>Tax</span><span style={{ color: '#f1f5f9', fontSize: '14px' }}>${taxAmount.toFixed(2)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.1)' }}><span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600 }}>Total</span><span style={{ color: '#22c55e', fontSize: '20px', fontWeight: 700 }}>${total.toFixed(2)}</span></div>
          {isInvoice && (doc.amount_paid || 0) > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}><span style={{ color: '#94a3b8', fontSize: '14px' }}>Amount Paid</span><span style={{ color: '#22c55e', fontSize: '14px' }}>-${(doc.amount_paid || 0).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}><span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600 }}>Balance Due</span><span style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 700 }}>${balanceDue.toFixed(2)}</span></div>
            </>
          )}
        </div>
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
                    <input type="number" value={customPaymentAmount} onChange={(e) => setCustomPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ ...inputStyle, width: '120px' }} />
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

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <ActionButton onClick={() => setShowSendModal(false)} variant="secondary">Cancel</ActionButton>
              <ActionButton onClick={handleSendDocument} disabled={sendingDocument || (!sendEmail && !sendSms)} variant="primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {sendingDocument ? 'Sending...' : 'Send'}
              </ActionButton>
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
            <div onClick={(e) => { if (e.target === e.currentTarget) { setLightboxIndex(null); setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) } }} onDoubleClick={() => { if (lightboxZoom > 1) { setLightboxZoom(1); setLightboxPan({ x: 0, y: 0 }) } else { setLightboxZoom(2.5) } }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: lightboxZoom > 1 ? 'grab' : 'zoom-in', height: '100%' }}>
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
    </div>
  )
}