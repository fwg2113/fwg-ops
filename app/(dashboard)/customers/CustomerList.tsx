'use client'

import { useState, useEffect } from 'react'
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
}

export default function CustomerList({ initialCustomers, totalCount }: { initialCustomers: Customer[], totalCount: number }) {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [page, setPage] = useState(1)
  const perPage = 50
  const totalPages = Math.ceil(totalCount / perPage)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: ''
  })

  useEffect(() => {
    if (page === 1 && !search) return
    
    const fetchPage = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1)
      
      if (data) setCustomers(data)
      setLoading(false)
    }
    
    fetchPage()
  }, [page])

  const handleSearch = async () => {
    setLoading(true)
    setPage(1)
    
    if (!search.trim()) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setCustomers(data)
    } else {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`display_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setCustomers(data)
    }
    
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const display_name = `${form.first_name} ${form.last_name}`.trim()
    
    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...form, display_name }])
      .select()
      .single()

    if (!error && data) {
      setCustomers([data, ...customers])
      setForm({ first_name: '', last_name: '', email: '', phone: '', company: '' })
      setShowModal(false)
    }
    
    setSaving(false)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Customers</h1>
          <p style={{ color: '#94a3b8' }}>{totalCount.toLocaleString()} total</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              padding: '12px 16px',
              background: '#282a30',
              border: '1px solid #3f4451',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              width: '250px'
            }}
          />
          <button 
            onClick={handleSearch}
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
            Search
          </button>
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
            + Add Customer
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Name</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Company</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Loading...
                </td>
              </tr>
            ) : customers.length > 0 ? (
              customers.map((customer) => (
                <tr 
                  key={customer.id} 
                  onClick={() => router.push(`/customers/${customer.id}`)}
                  style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)', cursor: 'pointer' }}
                >
                  <td style={{ padding: '16px', color: '#f1f5f9', fontSize: '14px' }}>
                    {customer.display_name || `${customer.first_name} ${customer.last_name}`}
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {customer.company || '-'}
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {customer.email || '-'}
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {customer.phone || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && !search && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              background: '#1d1d1d',
              border: '1px solid #3f4451',
              borderRadius: '6px',
              color: page === 1 ? '#64748b' : '#f1f5f9',
              cursor: page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 16px',
              background: '#1d1d1d',
              border: '1px solid #3f4451',
              borderRadius: '6px',
              color: page === totalPages ? '#64748b' : '#f1f5f9',
              cursor: page === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Add Customer Modal */}
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
            <h2 style={{ color: '#f1f5f9', fontSize: '20px', marginBottom: '24px' }}>Add Customer</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>First Name</label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
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
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Last Name</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
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
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
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
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                  />
                </div>
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
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
