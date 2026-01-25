'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Customer = {
  id: string
  customer_number: number
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
  notes: string
  lifetime_value: number
  source: string
  created_at: string
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

const CATEGORIES = [
  { key: 'FULL_WRAP', label: 'Full Vehicle Wrap' },
  { key: 'PARTIAL_WRAP', label: 'Partial Wrap' },
  { key: 'COMMERCIAL_WRAP', label: 'Commercial/Fleet Wrap' },
  { key: 'COLOR_CHANGE', label: 'Color Change Wrap' },
  { key: 'PPF', label: 'Paint Protection Film' },
  { key: 'TINT', label: 'Window Tint' },
  { key: 'SIGNAGE', label: 'Signage' },
  { key: 'APPAREL', label: 'Apparel/Merchandise' }
]

export default function CustomerDetail({ customer, documents }: { customer: Customer, documents: Document[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [quoteCategory, setQuoteCategory] = useState('')
  const [quoteDescription, setQuoteDescription] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsStatus, setSmsStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [form, setForm] = useState({
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    company: customer.company || '',
    address: customer.address || '',
    city: customer.city || '',
    state: customer.state || '',
    zip: customer.zip || '',
    notes: customer.notes || ''
  })

  const handleSave = async () => {
    setSaving(true)
    const display_name = form.company || `${form.first_name} ${form.last_name}`.trim()
    
    await supabase
      .from('customers')
      .update({ ...form, display_name })
      .eq('id', customer.id)
    
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  const handleCreateQuote = async () => {
    if (!quoteCategory) return
    
    setSaving(true)
    const { data, error } = await supabase
      .from('documents')
      .insert([{
        doc_type: 'quote',
        status: 'draft',
        category: quoteCategory,
        customer_id: customer.id,
        customer_name: customer.display_name || `${customer.first_name} ${customer.last_name}`,
        customer_email: customer.email,
        customer_phone: customer.phone,
        company_name: customer.company,
        project_description: quoteDescription
      }])
      .select()
      .single()

    setSaving(false)
    if (!error && data) {
      router.push(`/documents/${data.id}`)
    }
  }

  const handleSendSms = async () => {
    if (!smsMessage.trim() || !customer.phone) return
    
    setSmsSending(true)
    setSmsStatus('idle')

    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.phone,
          message: smsMessage
        })
      })

      if (response.ok) {
        // Save message to database
        await supabase.from('messages').insert([{
          direction: 'outbound',
          channel: 'sms',
          customer_phone: customer.phone,
          customer_name: customer.display_name || `${customer.first_name} ${customer.last_name}`,
          message_body: smsMessage,
          status: 'sent'
        }])
        
        setSmsStatus('success')
        setSmsMessage('')
        setTimeout(() => {
          setShowSmsModal(false)
          setSmsStatus('idle')
        }, 1500)
      } else {
        setSmsStatus('error')
      }
    } catch (error) {
      setSmsStatus('error')
    }
    
    setSmsSending(false)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <button 
            onClick={() => router.push('/customers')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginBottom: '8px', padding: 0, fontSize: '14px' }}
          >
            ← Back to Customers
          </button>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>
            {customer.display_name || `${customer.first_name} ${customer.last_name}`}
          </h1>
          <p style={{ color: '#94a3b8' }}>Customer #{customer.customer_number}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {customer.phone && (
            <button
              onClick={() => setShowSmsModal(true)}
              style={{
                padding: '12px 20px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Send SMS
            </button>
          )}
          <button
            onClick={() => setShowQuoteModal(true)}
            style={{
              padding: '12px 20px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + New Quote
          </button>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              padding: '12px 20px',
              background: '#282a30',
              border: '1px solid #3f4451',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column - Customer Info */}
        <div>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Contact Information</h3>
            
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>First Name</label>
                    <input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Last Name</label>
                    <input
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Company</label>
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Email</label>
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px',
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Name</p>
                  <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{customer.first_name} {customer.last_name}</p>
                </div>
                <div>
                  <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Company</p>
                  <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{customer.company || '-'}</p>
                </div>
                <div>
                  <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Email</p>
                  <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{customer.email || '-'}</p>
                </div>
                <div>
                  <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Phone</p>
                  <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{customer.phone || '-'}</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Address</h3>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Street Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>City</label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>State</label>
                    <input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>ZIP</label>
                    <input
                      value={form.zip}
                      onChange={(e) => setForm({ ...form, zip: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#282a30', border: '1px solid #3f4451', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#f1f5f9', fontSize: '14px' }}>
                {customer.address ? (
                  <>
                    {customer.address}<br />
                    {customer.city}, {customer.state} {customer.zip}
                  </>
                ) : (
                  <span style={{ color: '#64748b' }}>No address on file</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Stats & Documents */}
        <div>
          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Lifetime Value</p>
                <p style={{ color: '#22c55e', fontSize: '24px', fontWeight: '700' }}>
                  ${(customer.lifetime_value || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Documents</p>
                <p style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: '700' }}>{documents.length}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Source</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{customer.source || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Customer Since</p>
                <p style={{ color: '#f1f5f9', fontSize: '14px' }}>
                  {new Date(customer.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Documents</h3>
            {documents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    style={{
                      padding: '12px',
                      background: '#282a30',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: doc.doc_type === 'quote' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: doc.doc_type === 'quote' ? '#3b82f6' : '#22c55e',
                          marginRight: '8px'
                        }}>
                          {doc.doc_type === 'quote' ? 'Quote' : 'Invoice'}
                        </span>
                        <span style={{ color: '#f1f5f9', fontSize: '14px' }}>#{doc.doc_number}</span>
                      </div>
                      <span style={{ color: '#d71cd1', fontSize: '14px', fontWeight: '600' }}>
                        ${(doc.total || 0).toLocaleString()}
                      </span>
                    </div>
                    {doc.project_description && (
                      <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                        {doc.project_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No documents yet</p>
            )}
          </div>
        </div>
      </div>

      {/* New Quote Modal */}
      {showQuoteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1d1d1d',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <h2 style={{ color: '#f1f5f9', fontSize: '20px', marginBottom: '24px' }}>New Quote for {customer.display_name || customer.first_name}</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Category *</label>
              <select
                value={quoteCategory}
                onChange={(e) => setQuoteCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#282a30',
                  border: '1px solid #3f4451',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select a category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Project Description</label>
              <textarea
                value={quoteDescription}
                onChange={(e) => setQuoteDescription(e.target.value)}
                rows={3}
                placeholder="e.g., Full wrap on 2024 Ford F-150"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#282a30',
                  border: '1px solid #3f4451',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowQuoteModal(false)
                  setQuoteCategory('')
                  setQuoteDescription('')
                }}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: '1px solid #3f4451',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuote}
                disabled={saving || !quoteCategory}
                style={{
                  padding: '12px 20px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: saving || !quoteCategory ? 0.7 : 1
                }}
              >
                {saving ? 'Creating...' : 'Create Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {showSmsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1d1d1d',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <h2 style={{ color: '#f1f5f9', fontSize: '20px', marginBottom: '8px' }}>Send SMS</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>To: {customer.phone}</p>
            
            {smsStatus === 'success' ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ color: '#22c55e', fontSize: '48px', marginBottom: '12px' }}>✓</div>
                <p style={{ color: '#22c55e', fontSize: '16px' }}>Message sent!</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    rows={4}
                    placeholder="Type your message..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#282a30',
                      border: '1px solid #3f4451',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                  <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>
                    {smsMessage.length}/160 characters
                  </p>
                </div>

                {smsStatus === 'error' && (
                  <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>
                    Failed to send message. Please try again.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSmsModal(false)
                      setSmsMessage('')
                      setSmsStatus('idle')
                    }}
                    style={{
                      padding: '12px 20px',
                      background: 'transparent',
                      border: '1px solid #3f4451',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendSms}
                    disabled={smsSending || !smsMessage.trim()}
                    style={{
                      padding: '12px 20px',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: smsSending || !smsMessage.trim() ? 0.7 : 1
                    }}
                  >
                    {smsSending ? 'Sending...' : 'Send SMS'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
