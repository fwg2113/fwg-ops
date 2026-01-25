import { supabase } from '../lib/supabase'

export default async function Home() {
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  const { count: documentCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  const { count: submissionCount } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '8px' }}>Dashboard</h1>
      <p style={{ color: '#94a3b8', marginBottom: '32px' }}>Welcome back, Joe</p>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Customers</p>
          <p style={{ color: '#f1f5f9', fontSize: '36px', fontWeight: 'bold' }}>{customerCount || 0}</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Documents</p>
          <p style={{ color: '#f1f5f9', fontSize: '36px', fontWeight: 'bold' }}>{documentCount || 0}</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Submissions</p>
          <p style={{ color: '#f1f5f9', fontSize: '36px', fontWeight: 'bold' }}>{submissionCount || 0}</p>
        </div>
      </div>
    </div>
  )
}