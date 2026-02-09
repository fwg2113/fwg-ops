'use client'

import { useState, useEffect, useRef } from 'react'

type ThreadSummary = {
  id: string
  messageCount: number
  snippet: string
  isUnread: boolean
  subject: string
  from: string
  to: string
  date: string
  internalDate: string
  labelIds: string[]
  hasAttachments: boolean
}

type EmailMessage = {
  id: string
  threadId: string
  from: string
  to: string
  cc: string
  bcc: string
  subject: string
  date: string
  internalDate: string
  messageId: string
  references: string
  body: string
  labelIds: string[]
  attachments: Array<{
    filename: string
    mimeType: string
    attachmentId: string
    size: number
  }>
}

type ThreadDetail = {
  id: string
  messages: EmailMessage[]
  subject: string
}

type Alias = {
  email: string
  displayName: string
  isPrimary: boolean
  isDefault: boolean
}

// Icons
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const ComposeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const ReplyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
)

const ArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)

const AttachmentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
  </svg>
)

const InboxIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

// Helpers
const parseEmailAddress = (raw: string) => {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] }
  return { name: raw, email: raw }
}

const getInitials = (name: string) => {
  const parts = name.split(' ').filter(p => p && !p.includes('@'))
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const formatFullDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function EmailInbox() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [label, setLabel] = useState('INBOX')
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [aliases, setAliases] = useState<Alias[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeFrom, setComposeFrom] = useState('')
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined)
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined)
  const [composeReferences, setComposeReferences] = useState<string | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Load aliases on mount
  useEffect(() => {
    const loadAliases = async () => {
      try {
        const res = await fetch('/api/gmail/aliases')
        const data = await res.json()
        if (data.aliases) {
          setAliases(data.aliases)
          const defaultAlias = data.aliases.find((a: Alias) => a.isPrimary)
          if (defaultAlias) setComposeFrom(defaultAlias.email)
        }
      } catch (err) {
        console.error('Failed to load aliases:', err)
      }
    }
    loadAliases()
  }, [])

  // Load threads
  const loadThreads = async (pageToken?: string, append = false) => {
    if (!append) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ label, maxResults: '25' })
      if (pageToken) params.set('pageToken', pageToken)
      if (searchQuery) params.set('q', searchQuery)

      const res = await fetch(`/api/gmail/threads?${params.toString()}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      if (append) {
        setThreads(prev => [...prev, ...(data.threads || [])])
      } else {
        setThreads(data.threads || [])
      }
      setNextPageToken(data.nextPageToken)
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadThreads()
  }, [label, searchQuery])

  // Load thread detail
  const selectThread = async (threadId: string) => {
    setSelectedThreadId(threadId)
    setLoadingThread(true)
    setShowReply(false)

    try {
      const res = await fetch(`/api/gmail/threads/${threadId}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setThreadDetail(data)

      // Mark as read in local state
      setThreads(prev => prev.map(t =>
        t.id === threadId ? { ...t, isUnread: false } : t
      ))
    } catch (err: any) {
      setError(err.message)
    }

    setLoadingThread(false)
  }

  // Scroll to bottom of thread
  useEffect(() => {
    if (threadDetail) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [threadDetail])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(search)
    setSelectedThreadId(null)
    setThreadDetail(null)
  }

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true)
    setSelectedThreadId(null)
    setThreadDetail(null)
    loadThreads()
  }

  // Open compose
  const openCompose = () => {
    setComposeTo('')
    setComposeCc('')
    setComposeSubject('')
    setComposeBody('')
    setComposeThreadId(undefined)
    setComposeInReplyTo(undefined)
    setComposeReferences(undefined)
    setShowCompose(true)
    setShowReply(false)
  }

  // Open reply
  const openReply = () => {
    if (!threadDetail) return
    const lastMsg = threadDetail.messages[threadDetail.messages.length - 1]
    const sender = parseEmailAddress(lastMsg.from)

    setComposeTo(sender.email)
    setComposeCc('')
    setComposeSubject(lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`)
    setComposeBody('')
    setComposeThreadId(threadDetail.id)
    setComposeInReplyTo(lastMsg.messageId)
    setComposeReferences(lastMsg.references ? `${lastMsg.references} ${lastMsg.messageId}` : lastMsg.messageId)
    setShowReply(true)
    setShowCompose(false)
  }

  // Send email
  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return
    setSending(true)

    try {
      const htmlBody = composeBody.replace(/\n/g, '<br>')

      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          from: composeFrom || undefined,
          subject: composeSubject,
          body: htmlBody,
          cc: composeCc || undefined,
          threadId: composeThreadId,
          inReplyTo: composeInReplyTo,
          references: composeReferences,
        }),
      })

      const data = await res.json()

      if (data.error) {
        alert('Failed to send: ' + data.error)
      } else {
        setShowCompose(false)
        setShowReply(false)

        // Refresh thread if replying
        if (composeThreadId && selectedThreadId) {
          selectThread(selectedThreadId)
        }

        // Refresh thread list
        loadThreads()
      }
    } catch (err: any) {
      alert('Failed to send: ' + err.message)
    }

    setSending(false)
  }

  // Archive thread
  const archiveThread = async () => {
    if (!selectedThreadId || !threadDetail) return
    if (!confirm('Archive this thread?')) return

    try {
      // Archive all messages in the thread
      await Promise.all(
        threadDetail.messages.map(msg =>
          fetch(`/api/gmail/threads/${selectedThreadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
          })
        )
      )

      setThreads(prev => prev.filter(t => t.id !== selectedThreadId))
      setSelectedThreadId(null)
      setThreadDetail(null)
    } catch (err) {
      console.error('Archive failed:', err)
    }
  }

  const labels = [
    { key: 'INBOX', label: 'Inbox' },
    { key: 'SENT', label: 'Sent' },
    { key: 'STARRED', label: 'Starred' },
    { key: 'DRAFT', label: 'Drafts' },
    { key: 'TRASH', label: 'Trash' },
  ]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        {labels.map(l => (
          <button
            key={l.key}
            onClick={() => {
              setLabel(l.key)
              setSelectedThreadId(null)
              setThreadDetail(null)
              setSearchQuery('')
              setSearch('')
            }}
            style={{
              padding: '10px 20px',
              background: label === l.key ? '#d71cd1' : '#1d1d1d',
              border: label === l.key ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: label === l.key ? 'white' : '#94a3b8',
              fontSize: '14px',
              fontWeight: label === l.key ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {l.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '10px',
            background: '#1d1d1d',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '10px',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RefreshIcon />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', height: 'calc(100% - 52px)' }}>
        {/* Thread List */}
        <div style={{
          width: '400px',
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {/* Search + Compose */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <button
              onClick={openCompose}
              style={{
                width: '100%',
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
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <ComposeIcon /> Compose
            </button>
            <form onSubmit={handleSearch} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 40px',
                  background: '#1d1d1d',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '14px',
                }}
              />
            </form>
          </div>

          {/* Thread List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
            ) : error ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
            ) : threads.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                {searchQuery ? 'No emails match your search' : 'No emails'}
              </div>
            ) : (
              <>
                {threads.map(thread => {
                  const sender = parseEmailAddress(thread.from)
                  return (
                    <div
                      key={thread.id}
                      onClick={() => selectThread(thread.id)}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        cursor: 'pointer',
                        background: selectedThreadId === thread.id ? 'rgba(215, 28, 209, 0.1)' : 'transparent',
                        borderLeft: selectedThreadId === thread.id ? '3px solid #d71cd1' : '3px solid transparent',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: thread.isUnread ? '#d71cd1' : '#1d1d1d',
                        color: thread.isUnread ? 'white' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        {getInitials(sender.name)}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{
                            color: '#f1f5f9',
                            fontSize: '13px',
                            fontWeight: thread.isUnread ? 700 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {sender.name}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0, marginLeft: '8px' }}>
                            {formatDate(thread.date)}
                          </span>
                        </div>
                        <div style={{
                          color: thread.isUnread ? '#f1f5f9' : '#94a3b8',
                          fontSize: '13px',
                          fontWeight: thread.isUnread ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '2px',
                        }}>
                          {thread.subject}
                          {thread.messageCount > 1 && (
                            <span style={{ color: '#64748b', fontWeight: 400 }}> ({thread.messageCount})</span>
                          )}
                        </div>
                        <div style={{
                          color: '#64748b',
                          fontSize: '12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          {thread.hasAttachments && <AttachmentIcon />}
                          <span>{thread.snippet}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {nextPageToken && (
                  <button
                    onClick={() => loadThreads(nextPageToken, true)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'transparent',
                      border: 'none',
                      color: '#d71cd1',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Load more...
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Thread Detail / Compose */}
        <div style={{
          flex: 1,
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {showCompose ? (
            /* Compose New Email */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>New Email</h2>
                <button
                  onClick={() => setShowCompose(false)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}
                >x</button>
              </div>
              <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                {/* From */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ color: '#64748b', fontSize: '14px', width: '60px' }}>From</label>
                  <select
                    value={composeFrom}
                    onChange={(e) => setComposeFrom(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                    }}
                  >
                    {aliases.map(a => (
                      <option key={a.email} value={a.email}>
                        {a.displayName ? `${a.displayName} <${a.email}>` : a.email}
                      </option>
                    ))}
                  </select>
                </div>
                {/* To */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ color: '#64748b', fontSize: '14px', width: '60px' }}>To</label>
                  <input
                    type="text"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="recipient@example.com"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                    }}
                  />
                </div>
                {/* CC */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ color: '#64748b', fontSize: '14px', width: '60px' }}>Cc</label>
                  <input
                    type="text"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="cc@example.com"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                    }}
                  />
                </div>
                {/* Subject */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ color: '#64748b', fontSize: '14px', width: '60px' }}>Subject</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: '#1d1d1d',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '14px',
                    }}
                  />
                </div>
                {/* Body */}
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  style={{
                    flex: 1,
                    minHeight: '200px',
                    padding: '14px',
                    background: '#1d1d1d',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    resize: 'none',
                  }}
                />
              </div>
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={handleSend}
                  disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                  style={{
                    padding: '10px 24px',
                    background: sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim() ? '#64748b' : '#d71cd1',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <SendIcon />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          ) : threadDetail && !loadingThread ? (
            /* Thread Detail View */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Thread Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h2 style={{
                  color: '#f1f5f9',
                  fontSize: '18px',
                  fontWeight: 600,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {threadDetail.subject}
                </h2>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                  <button
                    onClick={openReply}
                    style={{
                      padding: '8px 14px',
                      background: '#d71cd1',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ReplyIcon /> Reply
                  </button>
                  <button
                    onClick={archiveThread}
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
                      fontSize: '13px',
                    }}
                  >
                    <ArchiveIcon /> Archive
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {threadDetail.messages.map((msg, idx) => {
                  const sender = parseEmailAddress(msg.from)
                  const recipients = parseEmailAddress(msg.to)
                  return (
                    <div key={msg.id} style={{
                      marginBottom: '20px',
                      background: '#1d1d1d',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}>
                      {/* Message Header */}
                      <div style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: msg.labelIds?.includes('SENT') || sender.email.includes('frederickwraps') ? '#d71cd1' : '#3b82f6',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}>
                          {getInitials(sender.name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                              {sender.name}
                            </span>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              {formatFullDate(msg.date)}
                            </span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                            to {recipients.name || recipients.email}
                            {msg.cc && <span> cc {msg.cc}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Message Body */}
                      <div
                        style={{
                          padding: '16px',
                          color: '#d1d5db',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          overflow: 'auto',
                          maxHeight: '500px',
                        }}
                        dangerouslySetInnerHTML={{ __html: msg.body }}
                      />

                      {/* Attachments */}
                      {msg.attachments.length > 0 && (
                        <div style={{
                          padding: '12px 16px',
                          borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}>
                          {msg.attachments.map((att, i) => (
                            <a
                              key={i}
                              href={`/api/gmail/attachment/${msg.id}?attachmentId=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                background: '#282a30',
                                borderRadius: '8px',
                                color: '#94a3b8',
                                textDecoration: 'none',
                                fontSize: '13px',
                              }}
                            >
                              <AttachmentIcon />
                              <span>{att.filename}</span>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>({formatSize(att.size)})</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={threadEndRef} />

                {/* Inline Reply */}
                {showReply && (
                  <div style={{
                    background: '#1d1d1d',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    marginTop: '8px',
                  }}>
                    <div style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>Reply to {composeTo}</span>
                      <button
                        onClick={() => setShowReply(false)}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}
                      >x</button>
                    </div>
                    <div style={{ padding: '16px' }}>
                      {/* From selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <label style={{ color: '#64748b', fontSize: '13px', width: '40px' }}>From</label>
                        <select
                          value={composeFrom}
                          onChange={(e) => setComposeFrom(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: '#282a30',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '8px',
                            color: '#f1f5f9',
                            fontSize: '13px',
                          }}
                        >
                          {aliases.map(a => (
                            <option key={a.email} value={a.email}>
                              {a.displayName ? `${a.displayName} <${a.email}>` : a.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Write your reply..."
                        autoFocus
                        style={{
                          width: '100%',
                          minHeight: '150px',
                          padding: '12px',
                          background: '#282a30',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          resize: 'vertical',
                          marginBottom: '12px',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleSend}
                          disabled={sending || !composeBody.trim()}
                          style={{
                            padding: '10px 20px',
                            background: sending || !composeBody.trim() ? '#64748b' : '#d71cd1',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: sending || !composeBody.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <SendIcon />
                          {sending ? 'Sending...' : 'Send Reply'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : loadingThread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Loading thread...
            </div>
          ) : (
            /* Empty State */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
            }}>
              <InboxIcon />
              <p style={{ marginTop: '16px', fontSize: '16px' }}>Select an email</p>
              <p style={{ fontSize: '13px', opacity: 0.7 }}>Choose from the list to read the conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
