import { supabase } from '../../lib/supabase'

export default async function SubmissionsPage() {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Submissions</h1>
          <p style={{ color: '#94a3b8' }}>{submissions?.length || 0} from website estimator</p>
        </div>
      </div>

      <div style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>ID</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Customer</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Vehicle</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Project</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Est. Range</th>
            </tr>
          </thead>
          <tbody>
            {submissions && submissions.length > 0 ? (
              submissions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)', cursor: 'pointer' }}>
                  <td style={{ padding: '16px', color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>
                    SUB-{sub.submission_number}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{sub.customer_name || '-'}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{sub.customer_email}</div>
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {sub.project_type?.replace(/_/g, ' ') || '-'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: sub.status === 'new' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                      color: sub.status === 'new' ? '#f59e0b' : '#94a3b8'
                    }}>
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'right' }}>
                    ${sub.price_range_min?.toLocaleString()} - ${sub.price_range_max?.toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No submissions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}