import { supabase } from '../../lib/supabase'

export default async function ProductionPage() {
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('in_production', true)
    .order('created_at', { ascending: false })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Production</h1>
      <p style={{ color: '#94a3b8', marginBottom: '32px' }}>{documents?.length || 0} jobs in production</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {documents && documents.length > 0 ? (
          documents.map((doc) => (
            <div key={doc.id} style={{
              background: '#1d1d1d',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }}>
                    Invoice #{doc.doc_number}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '12px' }}>
                    {doc.customer_name}
                  </span>
                </div>
                <span style={{ color: '#22c55e', fontSize: '14px' }}>
                  ${doc.total?.toLocaleString()}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                {doc.vehicle_description || doc.project_description || 'No description'}
              </p>
            </div>
          ))
        ) : (
          <div style={{
            background: '#1d1d1d',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            No jobs in production
          </div>
        )}
      </div>
    </div>
  )
}