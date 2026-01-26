'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Customer = {
  id: string
  first_name: string
  last_name: string
  display_name: string
  email: string
  phone: string
  company: string
  address: string
  city: string
  state: string
  zip: string
  tags: string
  notes: string
  lifetime_value: number
  created_at: string
  project_files_json: string
  drive_folder_url: string
}

type Document = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  total: number
  created_at: string
  project_description: string
}

type Submission = {
  id: string
  project_type: string
  status: string
  created_at: string
}

type CustomerDetail = {
  customer: Customer
  quotes: Document[]
  invoices: Document[]
  submissions: Submission[]
}

type Attachment = {
  url: string
  key: string
  filename: string
  contentType: string
  size: number
  uploadedAt: string
}

type CustomerPhone = {
  id: string
  customer_id: string
  phone: string
  contact_name: string | null
  is_primary: boolean
}

// Icons
const SpinnerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d71cd1" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
)

const EmailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
)

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)

// Helper functions
const getInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.split(' ').filter(p => p)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const formatPhone = (phone: string) => {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'new': '#d71cd1',
    'contacted': '#3b82f6',
    'quoted': '#8b5cf6',
    'draft': '#64748b',
    'sent': '#3b82f6',
    'viewed': '#8b5cf6',
    'approved': '#22c55e',
    'pending': '#f59e0b',
    'paid': '#22c55e',
    'cancelled': '#ef4444',
    'archived': '#64748b'
  }
  return colors[status] || '#64748b'
}

export default function CustomerList({ initialCustomers, totalCount }: { initialCustomers: Customer[], totalCount: number }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  
  // Stats
  const [totalLTV, setTotalLTV] = useState(0)
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [activeTab, setActiveTab] = useState<'submissions' | 'quotes' | 'invoices'>('quotes')
  
  // File upload
  const [uploading, setUploading] = useState(false)

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxFilename, setLightboxFilename] = useState<string>('')

  // Linked contacts
  const [linkedContacts, setLinkedContacts] = useState<CustomerPhone[]>([])
  const [showAddContactModal, setShowAddContactModal] = useState(false)
  const [newContactForm, setNewContactForm] = useState({ phone: '', contact_name: '' })

  // Duplicates
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{ key: string, type: 'phone' | 'email', customers: Customer[] }>>([])
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({})
  const [merging, setMerging] = useState(false)
  
  // Forms
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    tags: '',
    notes: ''
  })

  // Calculate stats on load
  useEffect(() => {
    const ltv = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
    setTotalLTV(ltv)
  }, [customers])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    
    const timeout = setTimeout(() => {
      performSearch(value)
    }, 300)
    setSearchTimeout(timeout)
  }

  const performSearch = async (searchTerm: string) => {
    setLoading(true)
    
    if (!searchTerm.trim()) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('display_name', { ascending: true })
        .limit(100)
      if (data) setCustomers(data)
    } else {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`display_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
        .order('display_name', { ascending: true })
        .limit(100)
      if (data) setCustomers(data)
    }
    
    setLoading(false)
  }

  // View customer detail
  const viewCustomerDetail = async (customerId: string) => {
    setDetailLoading(true)
    setShowDetailModal(true)
    setActiveTab('quotes')
    
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()
    
    const { data: quotes } = await supabase
      .from('documents')
      .select('*')
      .eq('doc_type', 'quote')
      .or(`customer_email.eq.${customer?.email},customer_phone.eq.${customer?.phone}`)
      .order('created_at', { ascending: false })
    
    const { data: invoices } = await supabase
      .from('documents')
      .select('*')
      .eq('doc_type', 'invoice')
      .or(`customer_email.eq.${customer?.email},customer_phone.eq.${customer?.phone}`)
      .order('created_at', { ascending: false })
    
    const { data: submissions } = await supabase
      .from('submissions')
      .select('*')
      .or(`customer_email.eq.${customer?.email},customer_phone.eq.${customer?.phone}`)
      .order('created_at', { ascending: false })
    
    // Fetch linked phone numbers
    const { data: phones } = await supabase
      .from('customer_phones')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
    
    setLinkedContacts(phones || [])
    
    setCustomerDetail({
      customer: customer || {} as Customer,
      quotes: quotes || [],
      invoices: invoices || [],
      submissions: submissions || []
    })
    
    setDetailLoading(false)
  }

  // Add customer
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name && !form.last_name && !form.email && !form.phone) {
      alert('Please enter at least a name, email, or phone')
      return
    }
    
    setSaving(true)
    const display_name = `${form.first_name} ${form.last_name}`.trim() || form.company || form.email
    
    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...form, display_name, lifetime_value: 0 }])
      .select()
      .single()

    if (!error && data) {
      setCustomers([data, ...customers])
      resetForm()
      setShowAddModal(false)
    } else {
      alert('Error creating customer: ' + error?.message)
    }
    
    setSaving(false)
  }

  // Edit customer
  const openEditModal = () => {
    if (!customerDetail) return
    const c = customerDetail.customer
    setForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zip: c.zip || '',
      tags: c.tags || '',
      notes: c.notes || ''
    })
    setShowDetailModal(false)
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerDetail) return
    
    setSaving(true)
    const display_name = `${form.first_name} ${form.last_name}`.trim() || form.company || form.email
    
    const { error } = await supabase
      .from('customers')
      .update({ ...form, display_name })
      .eq('id', customerDetail.customer.id)

    if (!error) {
      setCustomers(customers.map(c => 
        c.id === customerDetail.customer.id 
          ? { ...c, ...form, display_name } 
          : c
      ))
      resetForm()
      setShowEditModal(false)
    } else {
      alert('Error updating customer: ' + error.message)
    }
    
    setSaving(false)
  }

  const resetForm = () => {
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      tags: '',
      notes: ''
    })
  }

  // File upload for customer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!customerDetail || !e.target.files?.length) return
    
    setUploading(true)
    const file = e.target.files[0]
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('customerId', customerDetail.customer.id)
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success) {
        const existingFiles: Attachment[] = customerDetail.customer.project_files_json 
          ? JSON.parse(customerDetail.customer.project_files_json) 
          : []
        
        const newFile: Attachment = {
          url: data.url,
          key: data.key,
          filename: data.filename,
          contentType: data.contentType,
          size: data.size,
          uploadedAt: new Date().toISOString()
        }
        
        const updatedFiles = [...existingFiles, newFile]
        
        await supabase
          .from('customers')
          .update({ project_files_json: JSON.stringify(updatedFiles) })
          .eq('id', customerDetail.customer.id)
        
        setCustomerDetail({
          ...customerDetail,
          customer: {
            ...customerDetail.customer,
            project_files_json: JSON.stringify(updatedFiles)
          }
        })
      }
    } catch (error) {
      console.error('Upload failed:', error)
    }
    
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Delete attachment
  const deleteAttachment = async (key: string) => {
    if (!customerDetail || !confirm('Remove this file?')) return
    
    const existingFiles: Attachment[] = customerDetail.customer.project_files_json 
      ? JSON.parse(customerDetail.customer.project_files_json) 
      : []
    
    const updatedFiles = existingFiles.filter(f => f.key !== key)
    
    await supabase
      .from('customers')
      .update({ project_files_json: JSON.stringify(updatedFiles) })
      .eq('id', customerDetail.customer.id)
    
    setCustomerDetail({
      ...customerDetail,
      customer: {
        ...customerDetail.customer,
        project_files_json: JSON.stringify(updatedFiles)
      }
    })
  }

  // Navigate to document
  const goToDocument = (docId: string) => {
    setShowDetailModal(false)
    router.push(`/documents/${docId}`)
  }

  // Create quote for customer
  const createQuoteForCustomer = () => {
    if (!customerDetail) return
    const c = customerDetail.customer
    sessionStorage.setItem('newQuoteCustomer', JSON.stringify({
      name: c.display_name,
      email: c.email,
      phone: c.phone,
      company: c.company
    }))
    setShowDetailModal(false)
    router.push('/documents/new?type=quote')
  }

  // Render attachments
  const renderAttachments = () => {
    if (!customerDetail) return null
    
    const files: Attachment[] = customerDetail.customer.project_files_json 
      ? JSON.parse(customerDetail.customer.project_files_json) 
      : []
    
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {files.map((file) => {
          const isImage = file.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.filename)
          const ext = file.filename?.split('.').pop()?.toUpperCase() || 'FILE'
          
          return (
            <div
              key={file.key}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                background: '#1d1d1d'
              }}
              onClick={() => {
                if (isImage) {
                  setLightboxUrl(file.url)
                  setLightboxFilename(file.filename)
                } else {
                  window.open(file.url, '_blank')
                }
              }}
            >
              {isImage ? (
                <img src={file.url} alt={file.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px', textAlign: 'center' }}>
                  <FileIcon />
                  <span style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>{ext}</span>
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); deleteAttachment(file.key) }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >x</button>
            </div>
          )
        })}
        
        <label style={{
          width: '80px',
          height: '80px',
          borderRadius: '8px',
          border: '2px dashed rgba(148, 163, 184, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#64748b',
          fontSize: '10px',
          gap: '4px'
        }}>
          <UploadIcon />
          {uploading ? 'Uploading...' : 'Upload'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '500px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '14px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '10px',
                background: '#111111',
                color: '#f1f5f9'
              }}
            />
          </div>
          {loading && <SpinnerIcon />}
          <button
            onClick={async () => {
              // Find duplicates
              const { data: allCustomers } = await supabase
                .from('customers')
                .select('*')
                .eq('archived', false)
              
              if (!allCustomers) return
              
              const phoneGroups: Record<string, Customer[]> = {}
              const emailGroups: Record<string, Customer[]> = {}
              
              allCustomers.forEach((c: Customer) => {
                if (c.phone) {
                  const cleanPhone = c.phone.replace(/\D/g, '')
                  if (cleanPhone.length >= 10) {
                    const key = cleanPhone.slice(-10)
                    if (!phoneGroups[key]) phoneGroups[key] = []
                    phoneGroups[key].push(c)
                  }
                }
                if (c.email) {
                  const key = c.email.toLowerCase().trim()
                  if (!emailGroups[key]) emailGroups[key] = []
                  emailGroups[key].push(c)
                }
              })
              
              const groups: Array<{ key: string, type: 'phone' | 'email', customers: Customer[] }> = []
              
              Object.entries(phoneGroups).forEach(([key, customers]) => {
                if (customers.length > 1) {
                  groups.push({ key, type: 'phone', customers })
                }
              })
              
              Object.entries(emailGroups).forEach(([key, customers]) => {
                if (customers.length > 1) {
                  // Don't add if already in phone groups
                  const phoneIds = groups.flatMap(g => g.customers.map(c => c.id))
                  const newCustomers = customers.filter(c => !phoneIds.includes(c.id))
                  if (newCustomers.length > 1) {
                    groups.push({ key, type: 'email', customers })
                  }
                }
              })
              
              if (groups.length === 0) {
                alert('No duplicate customers found!')
                return
              }
              
              // Pre-select the customer with highest lifetime value as primary
              const defaults: Record<string, string> = {}
              groups.forEach(g => {
                const sorted = [...g.customers].sort((a, b) => (b.lifetime_value || 0) - (a.lifetime_value || 0))
                defaults[g.key] = sorted[0].id
              })
              
              setSelectedPrimary(defaults)
              setDuplicateGroups(groups)
              setShowDuplicatesModal(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '10px',
              color: '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Find Duplicates
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <PlusIcon /> Add Customer
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Total:</span>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{customers.length.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Lifetime Value:</span>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>${totalLTV.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr 100px',
          gap: '12px',
          padding: '12px 16px',
          background: '#1d1d1d',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          <div>Customer</div>
          <div>Email</div>
          <div>Phone</div>
          <div>Lifetime Value</div>
          <div>Tags</div>
        </div>

        {customers.length > 0 ? (
          customers.map((customer) => {
            const tags = customer.tags?.split(',').filter(t => t.trim()).slice(0, 3) || []
            
            return (
              <div
                key={customer.id}
                onClick={() => viewCustomerDetail(customer.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 100px',
                  gap: '12px',
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                  cursor: 'pointer',
                  alignItems: 'center',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1d1d1d'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontWeight: 500, color: '#f1f5f9' }}>{customer.display_name}</div>
                  {customer.company && customer.company !== customer.display_name && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{customer.company}</div>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>{customer.email || '-'}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>{formatPhone(customer.phone) || '-'}</div>
                <div style={{ fontWeight: 600, color: '#22c55e' }}>${(customer.lifetime_value || 0).toLocaleString()}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {tags.length > 0 ? tags.map((tag, i) => (
                    <span key={i} style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: 'rgba(215, 28, 209, 0.15)',
                      color: '#d71cd1',
                      borderRadius: '4px'
                    }}>{tag.trim()}</span>
                  )) : '-'}
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            {loading ? 'Loading...' : 'No customers found'}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt={lightboxFilename}
            style={{
              maxWidth: '90%',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <a
              href={lightboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Open Full Size
            </a>
            <a
              href={lightboxUrl}
              download={lightboxFilename}
              style={{
                padding: '10px 20px',
                background: '#d71cd1',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showDetailModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            style={{
              background: '#111111',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <SpinnerIcon />
                <div style={{ marginTop: '16px', color: '#64748b' }}>Loading customer...</div>
              </div>
            ) : customerDetail && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Customer Details</div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: '#d71cd1',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      {getInitials(customerDetail.customer.display_name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>
                        {customerDetail.customer.display_name}
                      </div>
                      {customerDetail.customer.company && (
                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                          {customerDetail.customer.company}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {customerDetail.customer.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8' }}>
                            <EmailIcon />
                            <a href={`mailto:${customerDetail.customer.email}`} style={{ color: '#d71cd1', textDecoration: 'none' }}>
                              {customerDetail.customer.email}
                            </a>
                          </div>
                        )}
                        {customerDetail.customer.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8' }}>
                            <PhoneIcon />
                            <a href={`tel:${customerDetail.customer.phone}`} style={{ color: '#d71cd1', textDecoration: 'none' }}>
                              {formatPhone(customerDetail.customer.phone)}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Lifetime Value</div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>
                        ${(customerDetail.customer.lifetime_value || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '16px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    {(['submissions', 'quotes', 'invoices'] as const).map((tab) => {
                      const count = tab === 'submissions' 
                        ? customerDetail.submissions.length 
                        : tab === 'quotes' 
                          ? customerDetail.quotes.length 
                          : customerDetail.invoices.length
                      
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: activeTab === tab ? '#d71cd1' : '#64748b',
                            background: activeTab === tab ? 'rgba(215, 28, 209, 0.15)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '10px'
                          }}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                          <span style={{
                            marginLeft: '6px',
                            fontSize: '11px',
                            padding: '2px 6px',
                            background: activeTab === tab ? '#d71cd1' : '#1d1d1d',
                            color: activeTab === tab ? 'white' : '#64748b',
                            borderRadius: '10px'
                          }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
                    {activeTab === 'submissions' && (
                      customerDetail.submissions.length > 0 ? (
                        customerDetail.submissions.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px',
                              background: '#1d1d1d',
                              borderRadius: '10px',
                              marginBottom: '8px',
                              cursor: 'pointer'
                            }}
                            onClick={() => { setShowDetailModal(false); router.push(`/submissions?id=${s.id}`) }}
                          >
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '13px', color: '#f1f5f9' }}>{s.project_type || 'Submission'}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                            </div>
                            <span style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 500,
                              borderRadius: '4px',
                              background: `${getStatusColor(s.status)}20`,
                              color: getStatusColor(s.status)
                            }}>{s.status}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No submissions found</div>
                      )
                    )}
                    
                    {activeTab === 'quotes' && (
                      customerDetail.quotes.length > 0 ? (
                        customerDetail.quotes.map((q) => (
                          <div
                            key={q.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px',
                              background: '#1d1d1d',
                              borderRadius: '10px',
                              marginBottom: '8px',
                              cursor: 'pointer'
                            }}
                            onClick={() => goToDocument(q.id)}
                          >
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '13px', color: '#f1f5f9' }}>Quote #{q.doc_number}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(q.created_at).toLocaleDateString()}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>${(q.total || 0).toLocaleString()}</div>
                              <span style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 500,
                                borderRadius: '4px',
                                background: `${getStatusColor(q.status)}20`,
                                color: getStatusColor(q.status)
                              }}>{q.status}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No quotes found</div>
                      )
                    )}
                    
                    {activeTab === 'invoices' && (
                      customerDetail.invoices.length > 0 ? (
                        customerDetail.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px',
                              background: '#1d1d1d',
                              borderRadius: '10px',
                              marginBottom: '8px',
                              cursor: 'pointer'
                            }}
                            onClick={() => goToDocument(inv.id)}
                          >
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '13px', color: '#f1f5f9' }}>Invoice #{inv.doc_number}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>${(inv.total || 0).toLocaleString()}</div>
                              <span style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 500,
                                borderRadius: '4px',
                                background: `${getStatusColor(inv.status)}20`,
                                color: getStatusColor(inv.status)
                              }}>{inv.status}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No invoices found</div>
                      )
                    )}
                  </div>

                  {customerDetail.customer.notes && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{customerDetail.customer.notes}</div>
                    </div>
                  )}

                  {customerDetail.customer.address && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Address</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {customerDetail.customer.address}
                        {customerDetail.customer.city && `, ${customerDetail.customer.city}`}
                        {customerDetail.customer.state && `, ${customerDetail.customer.state}`}
                        {customerDetail.customer.zip && ` ${customerDetail.customer.zip}`}
                      </div>
                    </div>
                  )}

                  {/* Linked Contacts Section */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Linked Phone Numbers ({linkedContacts.length})
                      </div>
                      <button
                        onClick={() => {
                          setNewContactForm({ phone: '', contact_name: '' })
                          setShowAddContactModal(true)
                        }}
                        style={{
                          padding: '4px 10px',
                          background: 'transparent',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          borderRadius: '6px',
                          color: '#94a3b8',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add
                      </button>
                    </div>
                    {linkedContacts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {linkedContacts.map((contact) => (
                          <div
                            key={contact.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              background: '#1d1d1d',
                              borderRadius: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: contact.is_primary ? '#d71cd1' : '#282a30',
                                color: contact.is_primary ? 'white' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <PhoneIcon />
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 500 }}>
                                  {formatPhone(contact.phone)}
                                  {contact.is_primary && (
                                    <span style={{
                                      marginLeft: '8px',
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      background: '#d71cd120',
                                      color: '#d71cd1',
                                      borderRadius: '4px'
                                    }}>Primary</span>
                                  )}
                                </div>
                                {contact.contact_name && (
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>{contact.contact_name}</div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => window.open(`/messages?phone=${contact.phone}`, '_blank')}
                                style={{
                                  padding: '6px 10px',
                                  background: 'transparent',
                                  border: '1px solid rgba(148, 163, 184, 0.2)',
                                  borderRadius: '6px',
                                  color: '#94a3b8',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                Message
                              </button>
                              {!contact.is_primary && (
                                <button
                                  onClick={async () => {
                                    if (confirm('Remove this phone number?')) {
                                      await supabase.from('customer_phones').delete().eq('id', contact.id)
                                      setLinkedContacts(linkedContacts.filter(c => c.id !== contact.id))
                                    }
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'transparent',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '6px',
                                    color: '#ef4444',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                        No additional phone numbers linked
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>Files & Assets</div>
                    {renderAttachments()}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderTop: '1px solid rgba(148, 163, 184, 0.2)'
                }}>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {customerDetail.customer.drive_folder_url ? (
                      <a
                        href={customerDetail.customer.drive_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '10px 16px',
                          background: 'transparent',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: '14px',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        Drive Folder
                      </a>
                    ) : (
                      <button
                        onClick={() => {
                          const url = prompt('Paste the Google Drive folder URL:')
                          if (url && url.includes('drive.google.com')) {
                            supabase.from('customers').update({ drive_folder_url: url }).eq('id', customerDetail.customer.id).then(() => {
                              setCustomerDetail({...customerDetail, customer: {...customerDetail.customer, drive_folder_url: url}})
                            })
                          } else if (url) { alert('Please enter a valid Google Drive URL') }
                        }}
                        style={{
                          padding: '10px 16px',
                          background: 'transparent',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          color: '#64748b',
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        Link Drive
                      </button>
                    )}
                    <button
                      onClick={createQuoteForCustomer}
                      style={{
                        padding: '10px 16px',
                        background: 'transparent',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      New Quote
                    </button>
                    <button
                      onClick={openEditModal}
                      style={{
                        padding: '10px 20px',
                        background: '#d71cd1',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      Edit Customer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: '#111111',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Add New Customer</div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <CloseIcon />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>First Name</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Last Name</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Company</label>
                <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>State</label>
                  <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>ZIP</label>
                  <input type="text" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, Commercial, Wrap" style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', resize: 'vertical' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <button type="button" onClick={() => { resetForm(); setShowAddModal(false) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && customerDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            style={{
              background: '#111111',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Edit Customer</div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}><CloseIcon /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>First Name</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Last Name</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Company</label>
                <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>State</label>
                  <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>ZIP</label>
                  <input type="text" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, Commercial, Wrap" style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', resize: 'vertical' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <button type="button" onClick={() => { resetForm(); setShowEditModal(false) }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && customerDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#1d1d1d',
            borderRadius: '16px',
            width: '400px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Add Phone Number
              </h3>
              <button
                onClick={() => setShowAddContactModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px' }}
              >×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Phone Number *</label>
                <input
                  type="tel"
                  value={newContactForm.phone}
                  onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#111111',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Contact Name (optional)</label>
                <input
                  type="text"
                  value={newContactForm.contact_name}
                  onChange={(e) => setNewContactForm({ ...newContactForm, contact_name: e.target.value })}
                  placeholder="e.g. Bryan, Casey, Front Desk..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#111111',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  Helps identify who from {customerDetail.customer.display_name} is contacting
                </p>
              </div>
            </div>
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowAddContactModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >Cancel</button>
              <button
                onClick={async () => {
                  if (!newContactForm.phone.trim()) {
                    alert('Please enter a phone number')
                    return
                  }
                  const cleanPhone = newContactForm.phone.replace(/\D/g, '')
                  if (cleanPhone.length < 10) {
                    alert('Please enter a valid phone number')
                    return
                  }
                  try {
                    const { data, error } = await supabase
                      .from('customer_phones')
                      .insert({
                        customer_id: customerDetail.customer.id,
                        phone: cleanPhone,
                        contact_name: newContactForm.contact_name || null,
                        is_primary: false
                      })
                      .select()
                      .single()
                    
                    if (error) {
                      if (error.code === '23505') {
                        alert('This phone number is already linked to a customer')
                      } else {
                        alert('Error: ' + error.message)
                      }
                      return
                    }
                    
                    setLinkedContacts([...linkedContacts, data])
                    setShowAddContactModal(false)
                  } catch (err: any) {
                    alert('Error adding contact: ' + err.message)
                  }
                }}
                style={{
                  padding: '10px 20px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >Add Phone</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Modal */}
      {showDuplicatesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#1d1d1d',
            borderRadius: '16px',
            width: '700px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                  Merge Duplicate Customers
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
                  Found {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} of duplicates. Select which profile to keep.
                </p>
              </div>
              <button
                onClick={() => setShowDuplicatesModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}
              >×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {duplicateGroups.map((group, gIdx) => (
                <div key={group.key} style={{
                  background: '#111111',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#64748b', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      background: group.type === 'phone' ? '#3b82f620' : '#8b5cf620',
                      color: group.type === 'phone' ? '#3b82f6' : '#8b5cf6',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500
                    }}>
                      {group.type === 'phone' ? 'Same Phone' : 'Same Email'}
                    </span>
                    {group.type === 'phone' ? formatPhone(group.key) : group.key}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.customers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => setSelectedPrimary({ ...selectedPrimary, [group.key]: customer.id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: selectedPrimary[group.key] === customer.id ? 'rgba(215, 28, 209, 0.1)' : '#1d1d1d',
                          border: selectedPrimary[group.key] === customer.id ? '2px solid #d71cd1' : '2px solid transparent',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: selectedPrimary[group.key] === customer.id ? '#d71cd1' : '#282a30',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {getInitials(customer.display_name)}
                          </div>
                          <div>
                            <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>
                              {customer.display_name}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>
                              {[customer.company, customer.email, formatPhone(customer.phone)].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                            ${(customer.lifetime_value || 0).toLocaleString()}
                          </div>
                          {selectedPrimary[group.key] === customer.id && (
                            <div style={{ 
                              color: '#d71cd1', 
                              fontSize: '11px', 
                              fontWeight: 500,
                              marginTop: '2px'
                            }}>
                              KEEP THIS ONE
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                Duplicates will be merged into selected profiles. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowDuplicatesModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >Cancel</button>
                <button
                  onClick={async () => {
                    if (!confirm(`Merge ${duplicateGroups.length} duplicate group(s)? This cannot be undone.`)) return
                    
                    setMerging(true)
                    
                    for (const group of duplicateGroups) {
                      const primaryId = selectedPrimary[group.key]
                      const primary = group.customers.find(c => c.id === primaryId)
                      const duplicates = group.customers.filter(c => c.id !== primaryId)
                      
                      if (!primary) continue
                      
                      // Combine lifetime values
                      const totalLTV = group.customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
                      
                      // Combine notes
                      const allNotes = group.customers
                        .filter(c => c.notes)
                        .map(c => c.id === primaryId ? c.notes : `[Merged from ${c.display_name}]: ${c.notes}`)
                        .join('\n\n')
                      
                      // Update primary with combined data
                      await supabase
                        .from('customers')
                        .update({
                          lifetime_value: totalLTV,
                          notes: allNotes || primary.notes
                        })
                        .eq('id', primaryId)
                      
                      // Move linked phones to primary
                      for (const dup of duplicates) {
                        await supabase
                          .from('customer_phones')
                          .update({ customer_id: primaryId })
                          .eq('customer_id', dup.id)
                      }
                      
                      // Update documents to point to primary
                      for (const dup of duplicates) {
                        if (dup.email) {
                          await supabase
                            .from('documents')
                            .update({ customer_email: primary.email })
                            .eq('customer_email', dup.email)
                        }
                        if (dup.phone) {
                          await supabase
                            .from('documents')
                            .update({ customer_phone: primary.phone })
                            .eq('customer_phone', dup.phone)
                        }
                      }
                      
                      // Archive duplicates (soft delete)
                      for (const dup of duplicates) {
                        await supabase
                          .from('customers')
                          .update({ archived: true, notes: `[MERGED INTO ${primary.display_name}]\n\n${dup.notes || ''}` })
                          .eq('id', dup.id)
                      }
                    }
                    
                    // Refresh customers list
                    const { data } = await supabase
                      .from('customers')
                      .select('*')
                      .eq('archived', false)
                      .order('created_at', { ascending: false })
                      .limit(100)
                    
                    if (data) setCustomers(data)
                    
                    setMerging(false)
                    setShowDuplicatesModal(false)
                    alert('Duplicates merged successfully!')
                  }}
                  disabled={merging}
                  style={{
                    padding: '10px 20px',
                    background: merging ? '#64748b' : '#d71cd1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: merging ? 'not-allowed' : 'pointer'
                  }}
                >{merging ? 'Merging...' : 'Merge All Duplicates'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
