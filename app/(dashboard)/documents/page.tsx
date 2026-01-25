import { supabase } from '../../lib/supabase'

export default async function DocumentsPage() {
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Documents</h1>
          <p style={{ color: '#94a3b8' }}>{documents?.length || 0} total</p>
        </div>
        <button style={{
          background: '#d71cd1',
          color: 'white',
          border: 'none',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          + New Quote
        </button>
      </div>

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
            {documents && documents.length > 0 ? (
              documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)', cursor: 'pointer' }}>
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
    </div>
  )
}