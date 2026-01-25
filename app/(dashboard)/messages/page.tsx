import { supabase } from '../../lib/supabase'

export default async function MessagesPage() {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '4px' }}>Messages</h1>
      <p style={{ color: '#94a3b8', marginBottom: '32px' }}>{messages?.length || 0} conversations</p>
      
      <div style={{
        background: '#1d1d1d',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {messages && messages.length > 0 ? (
          messages.map((msg) => (
            <div key={msg.id} style={{
              padding: '16px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>
                  {msg.customer_name || msg.customer_phone}
                </span>
                <span style={{ color: '#64748b', fontSize: '12px' }}>
                  {new Date(msg.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                {msg.message_body?.substring(0, 80)}...
              </p>
            </div>
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No messages yet
          </div>
        )}
      </div>
    </div>
  )
}