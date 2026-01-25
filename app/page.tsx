import { supabase } from './lib/supabase'

export default async function Home() {
  // Fetch counts from database
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
    <main style={{
      minHeight: '100vh',
      background: '#111111',
      color: '#f1f5f9',
      padding: '40px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>FWG Operations</h1>
      <p style={{ color: '#94a3b8', marginBottom: '40px' }}>Dashboard</p>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Customers</p>
          <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{customerCount || 0}</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Documents</p>
          <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{documentCount || 0}</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Submissions</p>
          <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{submissionCount || 0}</p>
        </div>
      </div>
    </main>
  )
}