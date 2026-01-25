export default function SettingsPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Settings</h1>
      <p style={{ color: '#94a3b8', marginBottom: '32px' }}>System configuration</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '8px' }}>Categories</h3>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Manage service categories and pricing</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '8px' }}>Materials</h3>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Configure materials and costs</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '8px' }}>Team</h3>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Manage users and permissions</p>
        </div>

        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: '16px', marginBottom: '8px' }}>Integrations</h3>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Twilio, Stripe, Google Calendar</p>
        </div>
      </div>
    </div>
  )
}