'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
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
  archived?: boolean
}

type Call = {
  id: string
  direction: string
  caller_phone: string
  caller_name: string | null
  receiver_phone: string | null
  answered_by: string | null
  status: string
  duration: number
  recording_url: string | null
  voicemail_url: string | null
  call_sid: string | null
  created_at: string
}

type Conversation = {
  phone: string
  name: string | null
  lastMessage: string
  lastTime: string
  unreadCount: number
  messages: Message[]
  linkedCustomerId?: string
  linkedCustomerName?: string
  contactName?: string
  isFullyArchived?: boolean
}

type Customer = {
  id: string
  display_name: string
  email: string | null
  phone: string | null
  company: string | null
}

type CustomerPhone = {
  id: string
  customer_id: string
  phone: string
  contact_name: string | null
  customer?: Customer
}

// Icons
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const ArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const MessageIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const UserPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
)

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 5L2 7" />
  </svg>
)

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// Helper functions
const getInitials = (name: string | null, phone: string) => {
  if (name) {
    const parts = name.split(' ').filter(p => p)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return phone.slice(-2)
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays <= 1 && date.getDate() === now.getDate() - 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const formatDateDivider = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return 'Today'
  } else if (diffDays <= 1 && date.getDate() === now.getDate() - 1) {
    return 'Yesterday'
  }
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Extract potential name from messages
const extractNameFromMessages = (messages: Message[]): string | null => {
  const inboundMessages = messages.filter(m => m.direction === 'inbound')
  for (const msg of inboundMessages) {
    const text = msg.message_body.toLowerCase()
    // Patterns like "this is John", "my name is John", "I'm John", "it's John"
    const patterns = [
      /(?:this is|my name is|i'm|i am|it's|its)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      /^([a-z]+(?:\s+[a-z]+)?)\s+here/i,
      /^hey,?\s+(?:this is\s+)?([a-z]+)/i
    ]
    for (const pattern of patterns) {
      const match = msg.message_body.match(pattern)
      if (match && match[1] && match[1].length > 1 && match[1].length < 30) {
        // Capitalize first letter of each word
        return match[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      }
    }
  }
  return null
}

// Extract potential email from messages
const extractEmailFromMessages = (messages: Message[]): string | null => {
  for (const msg of messages) {
    const emailMatch = msg.message_body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (emailMatch) {
      return emailMatch[0].toLowerCase()
    }
  }
  return null
}

export default function MessageList({ initialMessages, initialCalls = [] }: { initialMessages: Message[], initialCalls?: Call[] }) {
  const searchParams = useSearchParams()
  const phoneParam = searchParams.get('phone')
  
  const [activeView, setActiveView] = useState<'messages' | 'calls'>('messages')
  const [calls, setCalls] = useState<Call[]>(initialCalls)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactModalMode, setContactModalMode] = useState<'new' | 'link'>('new')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', contactName: '' })
  const [saving, setSaving] = useState(false)
  const [phoneLinks, setPhoneLinks] = useState<Record<string, { customerId: string, customerName: string, contactName?: string }>>({})
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [newMessagePhone, setNewMessagePhone] = useState('')
  const [newMessageCustomerName, setNewMessageCustomerName] = useState('')
  const [newMessageCustomerSearch, setNewMessageCustomerSearch] = useState('')
  const [newMessageCustomerResults, setNewMessageCustomerResults] = useState<Array<{ phone: string, name: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load phone links on mount
  useEffect(() => {
    const loadPhoneLinks = async () => {
      const { data } = await supabase
        .from('customer_phones')
        .select('phone, contact_name, customer_id, customers(id, display_name)')
      
      if (data) {
        const links: Record<string, { customerId: string, customerName: string, contactName?: string }> = {}
        data.forEach((p: any) => {
          if (p.customers) {
            links[p.phone] = {
              customerId: p.customer_id,
              customerName: p.customers.display_name,
              contactName: p.contact_name || undefined
            }
          }
        })
        setPhoneLinks(links)
      }
    }
    loadPhoneLinks()
  }, [])

  // Build conversations from messages
  const buildConversations = (messages: Message[]) => {
    const grouped: Record<string, Message[]> = {}

    // Group ALL messages by phone (including archived)
    messages.forEach(msg => {
      const phone = msg.customer_phone
      if (!grouped[phone]) grouped[phone] = []
      grouped[phone].push(msg)
    })

    const convos: Conversation[] = Object.entries(grouped).map(([phone, msgs]) => {
      const sorted = msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const unread = msgs.filter(m => m.direction === 'inbound' && !m.read && !m.archived).length
      const hasUnarchived = msgs.some(m => !m.archived)
      const link = phoneLinks[phone]
      return {
        phone,
        name: sorted[0]?.customer_name || null,
        lastMessage: sorted[0]?.message_body || '',
        lastTime: sorted[0]?.created_at || '',
        unreadCount: unread,
        messages: sorted.reverse(),
        linkedCustomerId: link?.customerId,
        linkedCustomerName: link?.customerName,
        contactName: link?.contactName,
        isFullyArchived: !hasUnarchived
      }
    })
    
    // Filter out fully archived conversations (no unarchived messages)
    // but keep them if there's a URL param requesting that phone
    const filtered = convos.filter(c => !c.isFullyArchived)

    filtered.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
    return { filtered, all: convos }
  }

  // Initial load and when phoneLinks change
  useEffect(() => {
    const { filtered: convos, all: allConvos } = buildConversations(initialMessages)
    
    // If phone param in URL, select that conversation or create new one
    if (phoneParam) {
      const cleanPhone = phoneParam.replace(/\D/g, '')
      // Try to match with or without leading 1
      const phoneVariants = [cleanPhone]
      if (cleanPhone.length === 10) {
        phoneVariants.push('1' + cleanPhone)
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
        phoneVariants.push(cleanPhone.slice(1))
      }
      
      // Search in ALL conversations (including archived) for URL param
      const matchingConvo = allConvos.find(c => {
        const convoPhone = c.phone.replace(/\D/g, '')
        return phoneVariants.some(v => convoPhone === v || convoPhone.endsWith(v) || v.endsWith(convoPhone))
      })
      
      if (matchingConvo) {
        // If it's archived, unarchive it and add to list
        if (matchingConvo.isFullyArchived) {
          setConversations([{ ...matchingConvo, isFullyArchived: false }, ...convos])
        } else {
          setConversations(convos)
        }
        setSelectedPhone(matchingConvo.phone)
        if (matchingConvo.unreadCount > 0) {
          markAsRead(matchingConvo.phone)
        }
      } else {
        // No existing conversation - create a new empty one
        // Check if this phone is linked to a customer
        const link = phoneLinks[cleanPhone] || phoneLinks['1' + cleanPhone]
        const newConvo: Conversation = {
          phone: cleanPhone,
          name: null,
          lastMessage: '',
          lastTime: new Date().toISOString(),
          unreadCount: 0,
          messages: [],
          linkedCustomerId: link?.customerId,
          linkedCustomerName: link?.customerName,
          contactName: link?.contactName
        }
        setConversations([newConvo, ...convos])
        setSelectedPhone(cleanPhone)
      }
      return
    }
    
    setConversations(convos)
    // Otherwise select first conversation
    if (convos.length > 0 && !selectedPhone) {
      setSelectedPhone(convos[0].phone)
    }
  }, [initialMessages, phoneLinks, phoneParam])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message
          console.log('New message received:', newMsg)

          setConversations(prevConvos => {
            const existingConvo = prevConvos.find(c => c.phone === newMsg.customer_phone)

            if (existingConvo) {
              return prevConvos.map(c => {
                if (c.phone === newMsg.customer_phone) {
                  return {
                    ...c,
                    messages: [...c.messages, newMsg],
                    lastMessage: newMsg.message_body,
                    lastTime: newMsg.created_at,
                    unreadCount: newMsg.direction === 'inbound' && !newMsg.read 
                      ? c.unreadCount + 1 
                      : c.unreadCount
                  }
                }
                return c
              }).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
            } else {
              const link = phoneLinks[newMsg.customer_phone]
              const newConvo: Conversation = {
                phone: newMsg.customer_phone,
                name: newMsg.customer_name,
                lastMessage: newMsg.message_body,
                lastTime: newMsg.created_at,
                unreadCount: newMsg.direction === 'inbound' ? 1 : 0,
                messages: [newMsg],
                linkedCustomerId: link?.customerId,
                linkedCustomerName: link?.customerName,
                contactName: link?.contactName
              }
              return [newConvo, ...prevConvos]
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [phoneLinks])

  // Realtime subscription for calls
  useEffect(() => {
    const callsChannel = supabase
      .channel('calls-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls' },
        (payload) => {
          const newCall = payload.new as Call
          console.log('New call received:', newCall)
          setCalls(prevCalls => [newCall, ...prevCalls])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls' },
        (payload) => {
          const updatedCall = payload.new as Call
          setCalls(prevCalls => prevCalls.map(c => c.id === updatedCall.id ? updatedCall : c))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(callsChannel)
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, selectedPhone])

  const selectedConvo = conversations.find(c => c.phone === selectedPhone)

  // Filter conversations by search
  const filteredConversations = conversations.filter(c => {
    if (!search.trim()) return true
    const searchLower = search.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(searchLower) ||
      (c.linkedCustomerName || '').toLowerCase().includes(searchLower) ||
      (c.contactName || '').toLowerCase().includes(searchLower) ||
      c.phone.includes(search) ||
      formatPhone(c.phone).includes(search)
    )
  })

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
      } else {
        const data = await response.json()
        alert('Failed to send: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to send:', error)
      alert('Failed to send message')
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

  const markAsUnread = async () => {
    if (!selectedPhone || !selectedConvo) return
    
    // Mark the most recent inbound message as unread
    const lastInbound = [...selectedConvo.messages].reverse().find(m => m.direction === 'inbound')
    if (lastInbound) {
      await supabase
        .from('messages')
        .update({ read: false })
        .eq('id', lastInbound.id)

      setConversations(convos => convos.map(c => {
        if (c.phone === selectedPhone) {
          return { ...c, unreadCount: 1 }
        }
        return c
      }))
    }
  }

  const archiveConversation = async () => {
    if (!selectedPhone) return
    const name = selectedConvo?.linkedCustomerName || selectedConvo?.name || formatPhone(selectedPhone)
    if (!confirm(`Archive conversation with ${name}?\n\nThis will hide it from the list.`)) return

    await supabase
      .from('messages')
      .update({ archived: true })
      .eq('customer_phone', selectedPhone)

    setConversations(convos => convos.filter(c => c.phone !== selectedPhone))
    setSelectedPhone(conversations.find(c => c.phone !== selectedPhone)?.phone || null)
  }

  const callCustomer = () => {
    if (selectedPhone) {
      window.open(`tel:${selectedPhone}`)
    }
  }

  // Open contact modal
  const openContactModal = () => {
    if (!selectedConvo) return
    
    // Extract info from messages
    const extractedName = extractNameFromMessages(selectedConvo.messages)
    const extractedEmail = extractEmailFromMessages(selectedConvo.messages)
    
    setContactForm({
      name: extractedName || '',
      email: extractedEmail || '',
      company: '',
      contactName: extractedName || ''
    })
    setCustomerSearch('')
    setCustomerResults([])
    setSelectedCustomer(null)
    setContactModalMode('new')
    setShowContactModal(true)
  }

  // Search customers
  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([])
      return
    }
    
    const { data } = await supabase
      .from('customers')
      .select('id, display_name, email, phone, company')
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10)
    
    setCustomerResults(data || [])
  }

  // Link phone to existing customer
  const linkToCustomer = async () => {
    if (!selectedCustomer || !selectedPhone) return
    setSaving(true)
    
    try {
      await supabase
        .from('customer_phones')
        .insert({
          customer_id: selectedCustomer.id,
          phone: selectedPhone.replace(/\D/g, ''),
          contact_name: contactForm.contactName || null,
          is_primary: false
        })
      
      // Update local state
      setPhoneLinks(prev => ({
        ...prev,
        [selectedPhone]: {
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.display_name,
          contactName: contactForm.contactName || undefined
        }
      }))
      
      setShowContactModal(false)
    } catch (error: any) {
      if (error.code === '23505') {
        alert('This phone number is already linked to a customer.')
      } else {
        alert('Failed to link contact: ' + error.message)
      }
    }
    
    setSaving(false)
  }

  // Create new customer and link phone
  const createAndLinkCustomer = async () => {
    if (!selectedPhone || !contactForm.name.trim()) {
      alert('Please enter a name')
      return
    }
    setSaving(true)
    
    try {
      // Create customer
      const nameParts = contactForm.name.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')
      
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          first_name: firstName,
          last_name: lastName,
          display_name: contactForm.name.trim(),
          email: contactForm.email || null,
          company: contactForm.company || null,
          phone: selectedPhone.replace(/\D/g, ''),
          lifetime_value: 0
        })
        .select()
        .single()
      
      if (customerError) throw customerError
      
      // Add to customer_phones
      await supabase
        .from('customer_phones')
        .insert({
          customer_id: newCustomer.id,
          phone: selectedPhone.replace(/\D/g, ''),
          contact_name: contactForm.contactName || null,
          is_primary: true
        })
      
      // Update local state
      setPhoneLinks(prev => ({
        ...prev,
        [selectedPhone]: {
          customerId: newCustomer.id,
          customerName: newCustomer.display_name,
          contactName: contactForm.contactName || undefined
        }
      }))
      
      setShowContactModal(false)
    } catch (error: any) {
      alert('Failed to create contact: ' + error.message)
    }
    
    setSaving(false)
  }

  // Group messages by date for dividers
  const getMessagesWithDividers = (messages: Message[]) => {
    const result: { type: 'divider' | 'message'; date?: string; message?: Message }[] = []
    let lastDate = ''

    messages.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString()
      if (msgDate !== lastDate) {
        result.push({ type: 'divider', date: msg.created_at })
        lastDate = msgDate
      }
      result.push({ type: 'message', message: msg })
    })

    return result
  }

  // Get display name for conversation
  const getConvoDisplayName = (convo: Conversation) => {
    if (convo.contactName && convo.linkedCustomerName) {
      return `${convo.contactName} (${convo.linkedCustomerName})`
    }
    if (convo.linkedCustomerName) {
      return convo.linkedCustomerName
    }
    return convo.name || formatPhone(convo.phone)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: 'calc(100vh - 140px)' }}>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveView('messages')}
          style={{
            padding: '10px 24px',
            background: activeView === 'messages' ? '#d71cd1' : '#1d1d1d',
            border: activeView === 'messages' ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '10px',
            color: activeView === 'messages' ? 'white' : '#94a3b8',
            fontSize: '14px',
            fontWeight: activeView === 'messages' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <MessageIcon /> Messages
        </button>
        <button
          onClick={() => setActiveView('calls')}
          style={{
            padding: '10px 24px',
            background: activeView === 'calls' ? '#d71cd1' : '#1d1d1d',
            border: activeView === 'calls' ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '10px',
            color: activeView === 'calls' ? 'white' : '#94a3b8',
            fontSize: '14px',
            fontWeight: activeView === 'calls' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <PhoneIcon /> Calls
          {calls.filter(c => c.status === 'missed' || c.status === 'voicemail').length > 0 && (
            <span style={{
              background: '#ef4444',
              color: 'white',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 600
            }}>
              {calls.filter(c => c.status === 'missed' || c.status === 'voicemail').length}
            </span>
          )}
        </button>
      </div>

      {activeView === 'messages' ? (
      <div style={{ display: 'flex', gap: '16px', height: 'calc(100% - 52px)' }}>
        {/* Conversation List */}
        <div style={{
          width: '340px',
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {/* Search Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={() => {
                  setNewMessagePhone('')
                  setNewMessageCustomerName('')
                  setNewMessageCustomerSearch('')
                  setNewMessageCustomerResults([])
                  setShowNewMessageModal(true)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Message
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 40px',
                  background: '#1d1d1d',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConversations.length > 0 ? filteredConversations.map((convo) => (
              <div
                key={convo.phone}
                onClick={() => {
                  setSelectedPhone(convo.phone)
                  if (convo.unreadCount > 0) markAsRead(convo.phone)
                }}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                  cursor: 'pointer',
                  background: selectedPhone === convo.phone ? 'rgba(215, 28, 209, 0.1)' : 'transparent',
                  borderLeft: selectedPhone === convo.phone ? '3px solid #d71cd1' : '3px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: convo.linkedCustomerId ? '#10b981' : convo.unreadCount > 0 ? '#d71cd1' : '#1d1d1d',
                  color: convo.linkedCustomerId || convo.unreadCount > 0 ? 'white' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {getInitials(convo.contactName || convo.linkedCustomerName || convo.name, convo.phone)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      color: '#f1f5f9',
                      fontSize: '14px',
                      fontWeight: convo.unreadCount > 0 ? 600 : 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {getConvoDisplayName(convo)}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0 }}>
                      {formatTime(convo.lastTime)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      color: convo.unreadCount > 0 ? '#f1f5f9' : '#64748b',
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: convo.unreadCount > 0 ? 500 : 400
                    }}>
                      {convo.lastMessage}
                    </span>
                    {convo.unreadCount > 0 && (
                      <span style={{
                        background: '#d71cd1',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        marginLeft: '8px',
                        flexShrink: 0
                      }}>
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                {search ? 'No conversations match your search' : 'No conversations yet'}
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div style={{
          flex: 1,
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {selectedConvo ? (
            <>
              {/* Chat Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: selectedConvo.linkedCustomerId ? '#10b981' : '#d71cd1',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600
                  }}>
                    {getInitials(selectedConvo.contactName || selectedConvo.linkedCustomerName || selectedConvo.name, selectedConvo.phone)}
                  </div>
                  <div>
                    <div style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600 }}>
                      {getConvoDisplayName(selectedConvo)}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>
                      {formatPhone(selectedConvo.phone)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedConvo.unreadCount === 0 && (
                    <button
                      onClick={markAsUnread}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <MailIcon /> Unread
                    </button>
                  )}
                  <button
                    onClick={callCustomer}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px'
                    }}
                  >
                    <PhoneIcon /> Call
                  </button>
                  {!selectedConvo.linkedCustomerId ? (
                    <button
                      onClick={openContactModal}
                      style={{
                        padding: '8px 12px',
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 500
                      }}
                    >
                      <UserPlusIcon /> Add Contact
                    </button>
                  ) : (
                    <button
                      onClick={() => window.open(`/customers?id=${selectedConvo.linkedCustomerId}`, '_blank')}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: '1px solid #10b981',
                        borderRadius: '8px',
                        color: '#10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <CheckIcon /> Linked
                    </button>
                  )}
                  <button
                    onClick={archiveConversation}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px'
                    }}
                  >
                    <ArchiveIcon /> Archive
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {getMessagesWithDividers(selectedConvo.messages).map((item, index) => {
                  if (item.type === 'divider') {
                    return (
                      <div key={`divider-${index}`} style={{
                        textAlign: 'center',
                        margin: '16px 0'
                      }}>
                        <span style={{
                          background: '#1d1d1d',
                          padding: '6px 14px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          color: '#64748b'
                        }}>
                          {formatDateDivider(item.date!)}
                        </span>
                      </div>
                    )
                  }

                  const msg = item.message!
                  const isOutbound = msg.direction === 'outbound'

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isOutbound ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        maxWidth: '70%',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        borderBottomRightRadius: isOutbound ? '4px' : '16px',
                        borderBottomLeftRadius: isOutbound ? '16px' : '4px',
                        background: isOutbound ? '#d71cd1' : '#1d1d1d',
                        color: isOutbound ? 'white' : '#f1f5f9'
                      }}>
                        <p style={{ fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                          {msg.message_body}
                        </p>
                        <p style={{
                          fontSize: '11px',
                          opacity: 0.7,
                          textAlign: 'right',
                          margin: '6px 0 0 0'
                        }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)'
              }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '24px',
                      color: '#f1f5f9',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    style={{
                      padding: '12px 20px',
                      background: sending || !newMessage.trim() ? '#64748b' : '#d71cd1',
                      border: 'none',
                      borderRadius: '24px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <SendIcon />
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b'
            }}>
              <MessageIcon />
              <p style={{ marginTop: '16px', fontSize: '16px' }}>Select a conversation</p>
              <p style={{ fontSize: '13px', opacity: 0.7 }}>Choose from the list to view messages</p>
            </div>
          )}
        </div>
      </div>
      ) : (
      /* Calls View */
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        height: 'calc(100% - 52px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>Call History</h2>
          <span style={{ color: '#64748b', fontSize: '13px' }}>{calls.length} calls</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {calls.length > 0 ? calls.map((call) => (
            <div
              key={call.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                cursor: 'pointer'
              }}
              onClick={() => {
                // Switch to messages and open conversation with this phone
                setActiveView('messages')
                const cleanPhone = call.caller_phone.replace(/\D/g, '')
                const existingConvo = conversations.find(c => {
                  const convoPhone = c.phone.replace(/\D/g, '')
                  return convoPhone.includes(cleanPhone.slice(-10)) || cleanPhone.includes(convoPhone.slice(-10))
                })
                if (existingConvo) {
                  setSelectedPhone(existingConvo.phone)
                } else {
                  const newConvo: Conversation = {
                    phone: cleanPhone,
                    name: call.caller_name,
                    lastMessage: '',
                    lastTime: new Date().toISOString(),
                    unreadCount: 0,
                    messages: []
                  }
                  setConversations([newConvo, ...conversations])
                  setSelectedPhone(cleanPhone)
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: call.status === 'completed' ? '#22c55e' : 
                              call.status === 'voicemail' ? '#f59e0b' : '#ef4444',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {call.status === 'voicemail' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="5.5" cy="11.5" r="4.5"/>
                      <circle cx="18.5" cy="11.5" r="4.5"/>
                      <line x1="5.5" y1="16" x2="18.5" y2="16"/>
                    </svg>
                  ) : call.status === 'completed' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 500 }}>
                    {call.caller_name || formatPhone(call.caller_phone)}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      color: call.status === 'completed' ? '#22c55e' : 
                             call.status === 'voicemail' ? '#f59e0b' : '#ef4444',
                      fontWeight: 500
                    }}>
                      {call.status === 'completed' ? 'Answered' : 
                       call.status === 'voicemail' ? 'Voicemail' : 
                       call.status === 'missed' ? 'Missed' : call.status}
                    </span>
                    {call.answered_by && <span>• {call.answered_by}</span>}
                    {call.duration > 0 && <span>• {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                  {new Date(call.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>
                  {new Date(call.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <PhoneIcon />
              <p style={{ marginTop: '12px' }}>No calls yet</p>
              <p style={{ fontSize: '13px', opacity: 0.7 }}>Incoming calls will appear here</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Add/Link Contact Modal */}
      {showContactModal && selectedConvo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1d1d1d',
            borderRadius: '16px',
            width: '500px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                Add Contact
              </h2>
              <button
                onClick={() => setShowContactModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '24px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto' }}>
              {/* Phone Display */}
              <div style={{
                background: '#111111',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <PhoneIcon />
                <span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 500 }}>
                  {formatPhone(selectedConvo.phone)}
                </span>
              </div>

              {/* Mode Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                  onClick={() => setContactModalMode('new')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: contactModalMode === 'new' ? '#d71cd1' : 'transparent',
                    border: '1px solid ' + (contactModalMode === 'new' ? '#d71cd1' : 'rgba(148, 163, 184, 0.2)'),
                    borderRadius: '8px',
                    color: contactModalMode === 'new' ? 'white' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Create New Customer
                </button>
                <button
                  onClick={() => setContactModalMode('link')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: contactModalMode === 'link' ? '#d71cd1' : 'transparent',
                    border: '1px solid ' + (contactModalMode === 'link' ? '#d71cd1' : 'rgba(148, 163, 184, 0.2)'),
                    borderRadius: '8px',
                    color: contactModalMode === 'link' ? 'white' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Link to Existing
                </button>
              </div>

              {contactModalMode === 'new' ? (
                /* New Customer Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="e.g. John Smith"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="e.g. john@company.com"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>
                      Company
                    </label>
                    <input
                      type="text"
                      value={contactForm.company}
                      onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                      placeholder="e.g. Trail Grid Pro"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Link to Existing */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>
                      Search Customers
                    </label>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        searchCustomers(e.target.value)
                      }}
                      placeholder="Search by name, email, company..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#111111',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Customer Results */}
                  {customerResults.length > 0 && (
                    <div style={{
                      background: '#111111',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {customerResults.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => setSelectedCustomer(customer)}
                          style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                            cursor: 'pointer',
                            background: selectedCustomer?.id === customer.id ? 'rgba(215, 28, 209, 0.1)' : 'transparent'
                          }}
                        >
                          <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>
                            {customer.display_name}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                            {[customer.company, customer.email, customer.phone].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCustomer && (
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>
                        Contact Name (optional)
                      </label>
                      <input
                        type="text"
                        value={contactForm.contactName}
                        onChange={(e) => setContactForm({ ...contactForm, contactName: e.target.value })}
                        placeholder="e.g. Bryan, Casey, Joey..."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: '#111111',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: '14px'
                        }}
                      />
                      <p style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>
                        This helps identify who from {selectedCustomer.display_name} is messaging
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowContactModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={contactModalMode === 'new' ? createAndLinkCustomer : linkToCustomer}
                disabled={saving || (contactModalMode === 'new' ? !contactForm.name.trim() : !selectedCustomer)}
                style={{
                  padding: '10px 20px',
                  background: saving || (contactModalMode === 'new' ? !contactForm.name.trim() : !selectedCustomer) ? '#64748b' : '#d71cd1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: saving || (contactModalMode === 'new' ? !contactForm.name.trim() : !selectedCustomer) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                {saving ? 'Saving...' : contactModalMode === 'new' ? 'Create Customer' : 'Link to Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1d1d1d',
            borderRadius: '16px',
            width: '450px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                New Message
              </h2>
              <button
                onClick={() => setShowNewMessageModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '24px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto' }}>
              {/* Phone Number Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Enter Phone Number
                </label>
                <input
                  type="tel"
                  value={newMessagePhone}
                  onChange={(e) => setNewMessagePhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#111111',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '10px',
                    color: '#f1f5f9',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ 
                textAlign: 'center', 
                color: '#64748b', 
                fontSize: '13px',
                margin: '20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(148, 163, 184, 0.2)' }} />
                OR
                <div style={{ flex: 1, height: '1px', background: 'rgba(148, 163, 184, 0.2)' }} />
              </div>

              {/* Search Customers */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Search Customers
                </label>
                <input
                  type="text"
                  value={newMessageCustomerSearch}
                  onChange={async (e) => {
                    setNewMessageCustomerSearch(e.target.value)
                    if (e.target.value.trim()) {
                      const { data } = await supabase
                        .from('customer_phones')
                        .select('phone, contact_name, customers(display_name)')
                        .ilike('customers.display_name', `%${e.target.value}%`)
                        .limit(10)
                      
                      const results: Array<{ phone: string, name: string }> = []
                      data?.forEach((p: any) => {
                        if (p.customers) {
                          results.push({
                            phone: p.phone,
                            name: p.contact_name ? `${p.contact_name} (${p.customers.display_name})` : p.customers.display_name
                          })
                        }
                      })
                      
                      // Also search customers directly
                      const { data: customers } = await supabase
                        .from('customers')
                        .select('phone, display_name')
                        .ilike('display_name', `%${e.target.value}%`)
                        .not('phone', 'is', null)
                        .limit(10)
                      
                      customers?.forEach((c: any) => {
                        if (c.phone && !results.find(r => r.phone === c.phone)) {
                          results.push({ phone: c.phone, name: c.display_name })
                        }
                      })
                      
                      setNewMessageCustomerResults(results)
                    } else {
                      setNewMessageCustomerResults([])
                    }
                  }}
                  placeholder="Search by name..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#111111',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '10px',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                />
                
                {/* Customer Results */}
                {newMessageCustomerResults.length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    background: '#111111',
                    borderRadius: '10px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {newMessageCustomerResults.map((result, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setNewMessagePhone(result.phone)
                          setNewMessageCustomerName(result.name)
                          setNewMessageCustomerSearch('')
                          setNewMessageCustomerResults([])
                        }}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 500 }}>
                          {result.name}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '12px' }}>
                          {formatPhone(result.phone)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowNewMessageModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cleanPhone = newMessagePhone.replace(/\D/g, '')
                  if (cleanPhone.length < 10) {
                    alert('Please enter a valid phone number')
                    return
                  }
                  
                  // Try to match with or without leading 1
                  const phoneVariants = [cleanPhone]
                  if (cleanPhone.length === 10) {
                    phoneVariants.push('1' + cleanPhone)
                  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
                    phoneVariants.push(cleanPhone.slice(1))
                  }
                  
                  // Check if conversation exists
                  const existingConvo = conversations.find(c => {
                    const convoPhone = c.phone.replace(/\D/g, '')
                    return phoneVariants.some(v => convoPhone === v || convoPhone.endsWith(v) || v.endsWith(convoPhone))
                  })
                  
                  if (existingConvo) {
                    setSelectedPhone(existingConvo.phone)
                  } else {
                    // Create a new empty conversation with customer name if selected
                    const newConvo: Conversation = {
                      phone: cleanPhone,
                      name: newMessageCustomerName || null,
                      lastMessage: '',
                      lastTime: new Date().toISOString(),
                      unreadCount: 0,
                      messages: [],
                      linkedCustomerName: newMessageCustomerName || undefined
                    }
                    setConversations([newConvo, ...conversations])
                    setSelectedPhone(cleanPhone)
                  }
                  
                  setShowNewMessageModal(false)
                }}
                disabled={!newMessagePhone.trim()}
                style={{
                  padding: '10px 20px',
                  background: !newMessagePhone.trim() ? '#64748b' : '#d71cd1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: !newMessagePhone.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Start Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
