'use client'

import { useState } from 'react'

type Message = {
  id: string
  direction: string
  message_body: string
  created_at: string
}

type Conversation = {
  phone: string
  customer_name: string
  messages: Message[]
  lastMessage: string
  lastMessageAt: string
  unread: number
}

export default function MessageList({ conversations }: { conversations: Conversation[] }) {
  const [selected, setSelected] = useState<Conversation | null>(conversations[0] || null)

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '24px' }}>Messages</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', height: 'calc(100vh - 140px)' }}>
        {/* Conversation List */}
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#282a30',
                border: '1px solid #3f4451',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <div
                  key={conv.phone}
                  onClick={() => setSelected(conv)}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                    cursor: 'pointer',
                    background: selected?.phone === conv.phone ? 'rgba(215, 28, 209, 0.1)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '500' }}>
                      {conv.customer_name || conv.phone}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{
                      color: '#94a3b8',
                      fontSize: '13px',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '240px'
                    }}>
                      {conv.lastMessage}
                    </p>
                    {conv.unread > 0 && (
                      <span style={{
                        background: '#d71cd1',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div style={{
          background: '#1d1d1d',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {selected ? (
            <>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>
                    {selected.customer_name || selected.phone}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                    {selected.phone}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[...selected.messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                      maxWidth: '70%'
                    }}
                  >
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      background: msg.direction === 'outbound' ? '#d71cd1' : '#282a30',
                      color: msg.direction === 'outbound' ? 'white' : '#f1f5f9',
                      fontSize: '14px',
                      lineHeight: '1.5'
                    }}>
                      {msg.message_body}
                    </div>
                    <p style={{
                      color: '#64748b',
                      fontSize: '11px',
                      margin: '4px 8px 0',
                      textAlign: msg.direction === 'outbound' ? 'right' : 'left'
                    }}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: '#282a30',
                      border: '1px solid #3f4451',
                      borderRadius: '24px',
                      color: '#f1f5f9',
                      fontSize: '14px'
                    }}
                  />
                  <button style={{
                    padding: '12px 24px',
                    background: '#d71cd1',
                    border: 'none',
                    borderRadius: '24px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}