'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  customer_phone: string
  customer_name: string | null
  message_body: string
  status: string
  read: boolean
  created_at: string
}

type Conversation = {
  phone: string
  name: string | null
  lastMessage: string
  lastTime: string
  unreadCount: number
  messages: Message[]
}

export default function MessageList({ initialMessages }: { initialMessages: Message[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    // Group messages by phone number
    const grouped: Record<string, Message[]> = {}
    
    initialMessages.forEach(msg => {
      const phone = msg.customer_phone
      if (!grouped[phone]) grouped[phone] = []
      grouped[phone].push(msg)
    })

    const convos: Conversation[] = Object.entries(grouped).map(([phone, msgs]) => {
      const sorted = msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const unread = msgs.filter(m => m.direction === 'inbound' && !m.read).length
      return {
        phone,
        name: sorted[0]?.customer_name || null,
        lastMessage: sorted[0]?.message_body || '',
        lastTime: sorted[0]?.created_at || '',
        unreadCount: unread,
        messages: sorted.reverse()
      }
    })

    // Sort by most recent
    convos.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
    setConversations(convos)

    // Auto-select first conversation
    if (convos.length > 0 && !selectedPhone) {
      setSelectedPhone(convos[0].phone)
    }
  }, [initialMessages])

  const selectedConvo = conversations.find(c => c.phone === selectedPhone)

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPhone) return
    
    setSending(true)

    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedPhone,
          message: newMessage
        })
      })

      if (response.ok) {
        // Add message to UI
        const newMsg: Message = {
          id: Date.now().toString(),
          direction: 'outbound',
          customer_phone: selectedPhone,
          customer_name: selectedConvo?.name || null,
          message_body: newMessage,
          status: 'sent',
          read: true,
          created_at: new Date().toISOString()
        }

        setConversations(convos => convos.map(c => {
          if (c.phone === selectedPhone) {
            return {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: newMessage,
              lastTime: newMsg.created_at
            }
          }
          return c
        }))

        setNewMessage('')
      }
    } catch (error) {
      console.error('Failed to send:', error)
    }

    setSending(false)
  }

  const markAsRead = async (phone: string) => {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('customer_phone', phone)
      .eq('direction', 'inbound')
      .eq('read', false)

    setConversations(convos => convos.map(c => {
      if (c.phone === phone) {
        return { ...c, unreadCount: 0 }
      }
      return c
    }))
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`
    } else if (cleaned.length === 11) {
      return `(${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: '28px', marginBottom: '24px' }}>Messages</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', height: 'calc(100vh - 180px)' }}>
        {/* Conversation List */}
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#282a30',
                border: '1px solid #3f4451',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length > 0 ? conversations.map((convo) => (
              <div
                key={convo.phone}
                onClick={() => {
                  setSelectedPhone(convo.phone)
                  if (convo.unreadCount > 0) markAsRead(convo.phone)
                }}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                  cursor: 'pointer',
                  background: selectedPhone === convo.phone ? 'rgba(215, 28, 209, 0.1)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: '600' }}>
                    {convo.name || formatPhone(convo.phone)}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{formatTime(convo.lastTime)}</span>
                </div>
                {convo.name && (
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>{formatPhone(convo.phone)}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                    {convo.lastMessage}
                  </span>
                  {convo.unreadCount > 0 && (
                    <span style={{
                      background: '#d71cd1',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {convo.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            )) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div style={{ background: '#1d1d1d', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selectedConvo ? (
            <>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <div style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }}>
                  {selectedConvo.name || formatPhone(selectedConvo.phone)}
                </div>
                {selectedConvo.name && (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>{formatPhone(selectedConvo.phone)}</div>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedConvo.messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: '16px',
                      background: msg.direction === 'outbound' ? '#d71cd1' : '#282a30',
                      color: msg.direction === 'outbound' ? 'white' : '#f1f5f9'
                    }}>
                      <p style={{ fontSize: '14px', marginBottom: '4px', lineHeight: '1.4' }}>{msg.message_body}</p>
                      <p style={{ fontSize: '11px', opacity: 0.7, textAlign: 'right' }}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
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
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    style={{
                      padding: '12px 24px',
                      background: '#d71cd1',
                      border: 'none',
                      borderRadius: '24px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: sending || !newMessage.trim() ? 0.5 : 1
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
