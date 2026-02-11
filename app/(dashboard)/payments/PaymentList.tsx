'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type PaymentDoc = {
  doc_number: number
  doc_type: string
  customer_name: string
  company_name: string | null
  category: string
  project_description: string | null
  vehicle_description: string | null
  total: number
  amount_paid: number
  balance_due: number
}

type Payment = {
  id: string
  document_id: string
  amount: number
  processing_fee: number
  payment_method: string
  processor: string | null
  processor_txn_id: string | null
  status: string
  notes: string | null
  synced_to_sheets: boolean
  created_at: string
  documents: PaymentDoc | PaymentDoc[]
}

type FilterMethod = 'all' | 'card' | 'cash' | 'check' | 'bank_transfer'
type FilterSource = 'all' | 'stripe' | 'manual'

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function getMethodLabel(method: string) {
  switch (method) {
    case 'card': case 'card_present': return 'Credit Card'
    case 'cash': return 'Cash'
    case 'check': return 'Check'
    case 'bank_transfer': case 'us_bank_account': return 'Bank Transfer'
    default: return method || 'Other'
  }
}

function getMethodColor(method: string) {
  switch (method) {
    case 'card': case 'card_present': return { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' }
    case 'cash': return { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' }
    case 'check': return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
    case 'bank_transfer': case 'us_bank_account': return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' }
    default: return { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' }
  }
}

function getDoc(payment: Payment): PaymentDoc {
  return Array.isArray(payment.documents) ? payment.documents[0] : payment.documents
}

export default function PaymentList({ initialPayments }: { initialPayments: Payment[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<FilterMethod>('all')
  const [sourceFilter, setSourceFilter] = useState<FilterSource>('all')
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all')

  const filtered = useMemo(() => {
    let list = initialPayments

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => {
        const doc = getDoc(p)
        return (
          doc.customer_name?.toLowerCase().includes(q) ||
          doc.company_name?.toLowerCase().includes(q) ||
          String(doc.doc_number).includes(q) ||
          p.amount.toFixed(2).includes(q) ||
          p.notes?.toLowerCase().includes(q) ||
          doc.project_description?.toLowerCase().includes(q) ||
          doc.vehicle_description?.toLowerCase().includes(q)
        )
      })
    }

    // Method filter
    if (methodFilter !== 'all') {
      list = list.filter(p => {
        if (methodFilter === 'bank_transfer') return p.payment_method === 'bank_transfer' || p.payment_method === 'us_bank_account'
        if (methodFilter === 'card') return p.payment_method === 'card' || p.payment_method === 'card_present'
        return p.payment_method === methodFilter
      })
    }

    // Source filter
    if (sourceFilter !== 'all') {
      list = list.filter(p => sourceFilter === 'stripe' ? p.processor === 'stripe' : p.processor !== 'stripe')
    }

    // Date range
    if (dateRange !== 'all') {
      const now = new Date()
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      list = list.filter(p => new Date(p.created_at) >= cutoff)
    }

    return list
  }, [initialPayments, search, methodFilter, sourceFilter, dateRange])

  // Summary stats
  const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0)
  const totalFees = filtered.reduce((sum, p) => sum + (p.processing_fee || 0), 0)

  // Method breakdown
  const methodCounts = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {}
    for (const p of filtered) {
      const method = getMethodLabel(p.payment_method)
      if (!counts[method]) counts[method] = { count: 0, amount: 0 }
      counts[method].count++
      counts[method].amount += p.amount
    }
    return counts
  }, [filtered])

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: '#111111',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: '8px',
    color: '#f1f5f9',
    fontSize: '13px',
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px', fontWeight: 700 }}>Payment History</h1>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>All payments across invoices and quotes</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Total Received</div>
          <div style={{ color: '#22c55e', fontSize: '24px', fontWeight: 700 }}>${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>{filtered.length} payment{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Processing Fees</div>
          <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: 700 }}>${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Net: ${(totalAmount - totalFees).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        {Object.entries(methodCounts).map(([method, data]) => (
          <div key={method} style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)' }}>
            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>{method}</div>
            <div style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700 }}>${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>{data.count} payment{data.count !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by customer, invoice #, amount..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '250px',
            padding: '10px 14px',
            background: '#111111',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: '14px',
          }}
        />
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value as FilterMethod)} style={selectStyle}>
          <option value="all">All Methods</option>
          <option value="card">Credit Card</option>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as FilterSource)} style={selectStyle}>
          <option value="all">All Sources</option>
          <option value="stripe">Stripe (Online)</option>
          <option value="manual">Manual Entry</option>
        </select>
        <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} style={selectStyle}>
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Payment Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <div style={{ fontSize: '16px', marginBottom: '4px' }}>No payments found</div>
          <div style={{ fontSize: '13px' }}>Adjust your filters or record a payment on an invoice</div>
        </div>
      ) : (
        <div style={{ background: '#1d1d1d', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 120px 100px 100px 80px',
            gap: '12px',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(148,163,184,0.1)',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <div>Customer / Invoice</div>
            <div>Date</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            <div>Method</div>
            <div>Source</div>
            <div>Sheet</div>
          </div>

          {/* Rows */}
          {filtered.map((payment) => {
            const doc = getDoc(payment)
            const methodColor = getMethodColor(payment.payment_method)
            return (
              <div
                key={payment.id}
                onClick={() => router.push(`/documents/${payment.document_id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 120px 100px 100px 80px',
                  gap: '12px',
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(148,163,184,0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Customer / Invoice */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.customer_name}
                    {doc.company_name && <span style={{ color: '#64748b', fontWeight: 400 }}> — {doc.company_name}</span>}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.doc_type === 'invoice' ? 'Invoice' : 'Quote'} #{doc.doc_number}
                    {(doc.project_description || doc.vehicle_description) && (
                      <span> — {doc.project_description || doc.vehicle_description}</span>
                    )}
                  </div>
                  {payment.notes && (
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {payment.notes}
                    </div>
                  )}
                </div>

                {/* Date */}
                <div>
                  <div style={{ color: '#f1f5f9', fontSize: '13px' }}>{formatDate(payment.created_at)}</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>{formatTime(payment.created_at)}</div>
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600 }}>${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  {(payment.processing_fee || 0) > 0 && (
                    <div style={{ color: '#64748b', fontSize: '11px' }}>-${(payment.processing_fee || 0).toFixed(2)} fee</div>
                  )}
                </div>

                {/* Method */}
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: methodColor.bg,
                    color: methodColor.text,
                    border: `1px solid ${methodColor.border}`,
                  }}>
                    {getMethodLabel(payment.payment_method)}
                  </span>
                </div>

                {/* Source */}
                <div>
                  <span style={{ color: payment.processor === 'stripe' ? '#a78bfa' : '#94a3b8', fontSize: '12px' }}>
                    {payment.processor === 'stripe' ? 'Stripe' : 'Manual'}
                  </span>
                </div>

                {/* Synced */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {payment.synced_to_sheets ? (
                    <span style={{ color: '#22c55e', fontSize: '12px' }} title="Synced to Google Sheets">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  ) : (
                    <span style={{ color: '#475569', fontSize: '12px' }} title="Not synced">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
