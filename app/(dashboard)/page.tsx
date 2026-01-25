import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default async function DashboardPage() {
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  const { count: quoteCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('doc_type', 'quote')

  const { count: invoiceCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('doc_type', 'invoice')

  const { count: productionCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('in_production', true)

  const { data: recentQuotes } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'quote')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: unpaidInvoices } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'invoice')
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: paidInvoices } = await supabase
    .from('documents')
    .select('total')
    .eq('doc_type', 'invoice')
    .eq('status', 'paid')

  const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

  const { data: pendingQuotes } = await supabase
    .from('documents')
    .select('total')
    .eq('doc_type', 'quote')
    .in('status', ['sent', 'viewed'])

  const pipelineValue = pendingQuotes?.reduce((sum, q) => sum + (q.total || 0), 0) || 0

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '24px' }}>Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Total Revenue</p>
          <p style={{ color: '#22c55e', fontSize: '32px', fontWeight: '700' }}>${totalRevenue.toLocaleString()}</p>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Pipeline Value</p>
          <p style={{ color: '#d71cd1', fontSize: '32px', fontWeight: '700' }}>${pipelineValue.toLocaleString()}</p>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>In Production</p>
          <p style={{ color: '#8b5cf6', fontSize: '32px', fontWeight: '700' }}>{productionCount || 0}</p>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Customers</p>
          <p style={{ color: '#f1f5f9', fontSize: '32px', fontWeight: '700' }}>{customerCount?.toLocaleString() || 0}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Active Quotes</span>
          <span style={{ color: '#3b82f6', fontSize: '20px', fontWeight: '600' }}>{quoteCount || 0}</span>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Total Invoices</span>
          <span style={{ color: '#22c55e', fontSize: '20px', fontWeight: '600' }}>{invoiceCount || 0}</span>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Need Follow-up</span>
          <span style={{ color: '#f59e0b', fontSize: '20px', fontWeight: '600' }}>0</span>
        </div>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Unpaid Invoices</span>
          <span style={{ color: '#ef4444', fontSize: '20px', fontWeight: '600' }}>{unpaidInvoices?.length || 0}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Recent Quotes</h3>
          {recentQuotes && recentQuotes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentQuotes.map((quote: any) => (
                <Link key={quote.id} href={`/documents/${quote.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#282a30', borderRadius: '8px', textDecoration: 'none' }}>
                  <div>
                    <p style={{ color: '#f1f5f9', fontSize: '14px', marginBottom: '2px' }}>Quote #{quote.doc_number}</p>
                    <p style={{ color: '#64748b', fontSize: '12px' }}>{quote.customer_name || 'No customer'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#d71cd1', fontSize: '14px', fontWeight: '600' }}>${(quote.total || 0).toLocaleString()}</p>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>{quote.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '14px' }}>No quotes yet</p>
          )}
        </div>

        <div style={{ background: '#1d1d1d', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '16px' }}>Action Items</h3>
          {unpaidInvoices && unpaidInvoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unpaidInvoices.map((invoice: any) => (
                <Link key={invoice.id} href={`/documents/${invoice.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#282a30', borderRadius: '8px', borderLeft: '3px solid #ef4444', textDecoration: 'none' }}>
                  <div>
                    <p style={{ color: '#f1f5f9', fontSize: '14px', marginBottom: '2px' }}>Invoice #{invoice.doc_number}</p>
                    <p style={{ color: '#64748b', fontSize: '12px' }}>{invoice.customer_name} - ${(invoice.total || 0).toLocaleString()}</p>
                  </div>
                  <span style={{ color: '#ef4444', fontSize: '12px' }}>Unpaid</span>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: '#22c55e', fontSize: '16px', marginBottom: '4px' }}>All caught up!</p>
              <p style={{ color: '#64748b', fontSize: '14px' }}>No pending action items</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}