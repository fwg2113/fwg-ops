'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Document = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  customer_name: string
  total: number
  created_at: string
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

export default function DocumentList({ initialDocuments, customers }: { initialDocuments: Document[], customers: Customer[] }) {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [projectDescription, setProjectDescription] = useState('')

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const customer = customers.find(c => c.id === selectedCustomer)
    
    const { data, error } = await supabase
      .from('documents')
      .insert([{
        doc_type: 'quote',
        status: 'draft',
        customer_id: selectedCustomer || null,
        customer_name: customer?.display_name || customer?.first_name + ' ' + customer?.last_name || '',
        customer_email: customer?.email || '',
        customer_phone: customer?.phone || '',
        company_name: customer?.company || '',
        project_description: projectDescription
      }])
      .select()
      .single()

    if (!error && data) {
      router.push(`/documents/${data.id}`)
    }
    
    setSaving(false)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Documents</h1>
          <p style={{ color: '#94a3b8' }}>{documents.length} total</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{
            background: '#d71cd1',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          + New Quote
        </button>
      </div>

      {/* Documents Table */}
      <div style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Doc #</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Customer</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {documents.length > 0 ? (
              documents.map((doc) => (
                <tr 
                  key={doc.id} 
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)', cursor: 'pointer' }}
                >
                  <td style={{ padding: '16px', color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>
                    {doc.doc_number}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: doc.doc_type === 'quote' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      color: doc.doc_type === 'quote' ? '#3b82f6' : '#22c55e'
                    }}>
                      {doc.doc_type === 'quote' ? 'Quote' : 'Invoice'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {doc.customer_name || '-'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: 'rgba(148, 163, 184, 0.1)',
                      color: '#94a3b8'
                    }}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    ${(doc.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No documents yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Quote Modal */}
      {showModal && (
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
            <h2 style={{ color: '#f1f5f9', fontSize: '20px', marginBottom: '24px' }}>New Quote</h2>
            
            <form onSubmit={handleCreateQuote}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Customer</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
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
                  <option value="">Select a customer...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.display_name || `${customer.first_name} ${customer.last_name}`}
                      {customer.company ? ` (${customer.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Project Description</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
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
                  onClick={() => setShowModal(false)}
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
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '12px 20px',
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving ? 'Creating...' : 'Create Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}