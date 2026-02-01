'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Document = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  bucket: string
  customer_name: string
  company_name: string
  vehicle_description: string
  project_description: string
  category: string
  total: number
  created_at: string
  sent_at: string
  viewed_at: string
  approved_at: string
  paid_at: string
}

type Customer = {
  id: string
  display_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
}

export default function DocumentList({ 
  initialDocuments, 
  customers, 
  docType 
}: { 
  initialDocuments: Document[]
  customers: Customer[]
  docType?: 'quote' | 'invoice' 
}) {
  const router = useRouter()
  const [documents] = useState<Document[]>(initialDocuments)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // New document form state
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [vehicleDescription, setVehicleDescription] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [category, setCategory] = useState('')

  const pageTitle = docType === 'quote' ? 'Quotes' : docType === 'invoice' ? 'Invoices' : 'Documents'

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchesSearch = 
        doc.customer_name?.toLowerCase().includes(term) ||
        doc.company_name?.toLowerCase().includes(term) ||
        doc.vehicle_description?.toLowerCase().includes(term) ||
        doc.project_description?.toLowerCase().includes(term) ||
        String(doc.doc_number).includes(term)
      if (!matchesSearch) return false
    }

    // Active filter
    if (activeFilter === 'active') {
      const archivedStatuses = ['archived', 'declined', 'void', 'lost']
      if (archivedStatuses.includes(doc.status?.toLowerCase())) return false
      if (doc.bucket === 'ARCHIVED') return false
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (doc.status?.toLowerCase() !== statusFilter.toLowerCase()) return false
    }

    return true
  })

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customerId)
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      setCustomerName(customer.display_name || `${customer.first_name} ${customer.last_name}`)
      setCompanyName(customer.company || '')
      setCustomerEmail(customer.email || '')
      setCustomerPhone(customer.phone || '')
    }
  }

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: maxDoc } = await supabase
      .from('documents')
      .select('doc_number')
      .order('doc_number', { ascending: false })
      .limit(1)
      .single()
    
    const nextDocNumber = Math.max((maxDoc?.doc_number || 0) + 1, 1001)

    const { data, error } = await supabase
      .from('documents')
      .insert([{
        doc_number: nextDocNumber,
        doc_type: docType || 'quote',
        status: 'draft',
        bucket: 'READY_FOR_ACTION',
        customer_id: selectedCustomer || null,
        customer_name: customerName,
        company_name: companyName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        vehicle_description: vehicleDescription,
        project_description: projectDescription,
        category: category
      }])
      .select()
      .single()

    if (!error && data) {
      router.push(`/documents/${data.id}`)
    }
    
    setSaving(false)
  }

  const resetForm = () => {
    setSelectedCustomer('')
    setCustomerName('')
    setCompanyName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setVehicleDescription('')
    setProjectDescription('')
    setCategory('')
  }

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase() || ''
    switch (s) {
      case 'draft': return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
      case 'sent': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }
      case 'viewed': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }
      case 'approved': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }
      case 'declined': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
      case 'pending': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }
      case 'partial': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }
      case 'paid': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }
      case 'overdue': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
      default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
    }
  }

  const getBucketStyle = (bucket: string) => {
    const b = bucket?.toUpperCase() || ''
    switch (b) {
      case 'READY_FOR_ACTION': 
      case 'ACTION_NEEDED': 
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', label: 'Action Needed' }
      case 'WAITING_ON_CUSTOMER': 
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Waiting' }
      case 'IN_PRODUCTION': 
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'In Production' }
      case 'COLD': 
        return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', label: 'Cold' }
      case 'LOST': 
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Lost' }
      default: 
        return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', label: bucket || '-' }
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Icons
  const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )

  const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 600, margin: 0 }}>{pageTitle}</h1>
        <button
          onClick={handleRefresh}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: '#282a30',
            border: 'none',
            borderRadius: '8px',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <span style={{ 
            display: 'flex',
            transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
            transition: 'transform 0.5s ease'
          }}>
            <RefreshIcon />
          </span>
          Refresh
        </button>
      </div>

      {/* Controls Row */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', maxWidth: '400px', minWidth: '200px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search by name, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 42px',
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Active Filter */}
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            background: '#1d1d1d',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="active">Active</option>
          <option value="all">All</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            background: '#1d1d1d',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="approved">Approved</option>
          {docType === 'invoice' && <option value="paid">Paid</option>}
          {docType === 'invoice' && <option value="partial">Partial</option>}
          {docType === 'invoice' && <option value="overdue">Overdue</option>}
        </select>

        {/* Spacer */}
        <div style={{ flex: '1' }} />

        {/* New Button */}
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            background: '#d71cd1',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + New {docType === 'invoice' ? 'Invoice' : 'Quote'}
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {docType === 'invoice' ? 'INVOICE #' : 'QUOTE #'}
              </th>
              <th style={{ padding: '14px 16px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CUSTOMER</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJECT</th>
              <th style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>BUCKET</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CREATED</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map((doc) => {
                const statusStyle = getStatusStyle(doc.status)
                const bucketStyle = getBucketStyle(doc.bucket)
                const isViewed = !!doc.viewed_at && doc.status !== 'approved' && doc.status !== 'paid'

                return (
                  <tr 
                    key={doc.id}
                    style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}
                  >
                    <td style={{ padding: '14px 16px', color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>
                      {doc.doc_number}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>
                            {doc.customer_name || '-'}
                            {isViewed && (
                              <span style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#a855f7',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}>
                                VIEWED
                              </span>
                            )}
                          </div>
                          {doc.company_name && (
                            <div style={{ color: '#64748b', fontSize: '12px' }}>{doc.company_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '14px' }}>
                      {doc.vehicle_description || doc.project_description || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {doc.total ? (
                        <span style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600 }}>
                          ${doc.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        textTransform: 'capitalize'
                      }}>
                        {doc.status || 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: bucketStyle.bg,
                        color: bucketStyle.color
                      }}>
                        {bucketStyle.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      {formatDate(doc.created_at)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => router.push(`/documents/${doc.id}`)}
                        style={{
                          padding: '6px 14px',
                          background: '#282a30',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#94a3b8',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#3f4451'
                          e.currentTarget.style.color = '#f1f5f9'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#282a30'
                          e.currentTarget.style.color = '#94a3b8'
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  {searchTerm || statusFilter !== 'all' ? 'No documents match your filters' : 'No documents yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Document Modal */}
      {showModal && (
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
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div 
            style={{
              background: '#111111',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                New {docType === 'invoice' ? 'Invoice' : 'Quote'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateDocument} style={{ padding: '24px' }}>
              {/* Customer Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Select Existing Customer
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#1d1d1d',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Or enter new customer below --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.display_name || `${customer.first_name} ${customer.last_name}`}
                      {customer.company ? ` (${customer.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Company
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(240) 555-1234"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Vehicle / Subject */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                  Vehicle / Subject
                </label>
                <input
                  type="text"
                  value={vehicleDescription}
                  onChange={(e) => setVehicleDescription(e.target.value)}
                  placeholder="e.g., 2024 Ford Transit - White"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#1d1d1d',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Project Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                  Project Description
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe the project scope..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#1d1d1d',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Category */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#1d1d1d',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select a category...</option>
                  <optgroup label="Automotive">
                    <option value="FULL_WRAP">Full Vehicle Wrap</option>
                    <option value="PARTIAL_WRAP">Partial Wrap</option>
                    <option value="COMMERCIAL_WRAP">Commercial/Fleet Wrap</option>
                    <option value="COLOR_CHANGE">Color Change Wrap</option>
                    <option value="PPF">Paint Protection Film</option>
                    <option value="TINT">Window Tint</option>
                  </optgroup>
                  <optgroup label="Signage">
                    <option value="SIGNAGE">Signage</option>
                    <option value="WALL_GRAPHICS">Wall Graphics</option>
                    <option value="WINDOW_GRAPHICS">Window Graphics</option>
                  </optgroup>
                  <optgroup label="Apparel">
                    <option value="APPAREL">Apparel/Merchandise</option>
                  </optgroup>
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !customerName}
                  style={{
                    padding: '10px 24px',
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: saving || !customerName ? 0.6 : 1
                  }}
                >
                  {saving ? 'Creating...' : `Create ${docType === 'invoice' ? 'Invoice' : 'Quote'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
