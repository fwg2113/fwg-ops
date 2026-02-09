'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

// ─── Icons ───────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
)
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
)
const ComposeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
)
const ReplyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
)
const ArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
)
const UnreadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
)
const AttachmentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
)
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
)
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
)
const ExpandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
)
const CollapseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
)
const InboxEmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
)

// ─── Label colors ────────────────────────────────────────
const LABEL_COLORS: Record<string, { bg: string; color: string }> = {
  INBOX: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
  SENT: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  DRAFT: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  STARRED: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
  IMPORTANT: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
  SPAM: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  TRASH: { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' },
  UNREAD: { bg: 'rgba(215, 28, 209, 0.15)', color: '#d71cd1' },
}

const SYSTEM_LABELS = ['INBOX', 'SENT', 'DRAFT', 'STARRED', 'IMPORTANT', 'SPAM', 'TRASH', 'UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']

// ─── Helpers ─────────────────────────────────────────────
const parseEmailAddress = (raw: string) => {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] }
  return { name: raw.split('@')[0], email: raw }
}

const getInitials = (name: string) => {
  const parts = name.split(' ').filter(p => p && !p.includes('@'))
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase()
  return '??'
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0 && date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' })
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatFullDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const getDisplayLabels = (labelIds: string[]) => {
  return labelIds.filter(l => !SYSTEM_LABELS.includes(l) || l === 'DRAFT' || l === 'STARRED')
}

// ─── Component ───────────────────────────────────────────
export default function EmailInbox() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
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
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>()
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>()
  const [composeReferences, setComposeReferences] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredThread, setHoveredThread] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Load aliases
  useEffect(() => {
    const loadAliases = async () => {
      try {
        const res = await fetch('/api/gmail/aliases')
        const data = await res.json()
        if (data.aliases) {
          setAliases(data.aliases)
          const primary = data.aliases.find((a: Alias) => a.isPrimary)
          if (primary) setComposeFrom(primary.email)
        }
      } catch (err) { console.error('Failed to load aliases:', err) }
    }
    loadAliases()
  }, [])

  // Load threads
  const loadThreads = useCallback(async (pageToken?: string, append = false) => {
    if (!append) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ label, maxResults: '25' })
      if (pageToken) params.set('pageToken', pageToken)
      if (searchQuery) params.set('q', searchQuery)
      const res = await fetch(`/api/gmail/threads?${params}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      if (append) setThreads(prev => [...prev, ...(data.threads || [])])
      else setThreads(data.threads || [])
      setNextPageToken(data.nextPageToken)
    } catch (err: any) { setError(err.message) }
    setLoading(false)
    setRefreshing(false)
  }, [label, searchQuery])

  useEffect(() => { loadThreads() }, [loadThreads])

  // Select thread
  const selectThread = async (threadId: string) => {
    setSelectedThreadId(threadId)
    setLoadingThread(true)
    setShowReply(false)
    setShowCompose(false)
    try {
      const res = await fetch(`/api/gmail/threads/${threadId}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setThreadDetail(data)
      // Expand only the last message
      if (data.messages?.length) {
        setExpandedMessages(new Set([data.messages[data.messages.length - 1].id]))
      }
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isUnread: false } : t))
    } catch (err: any) { setError(err.message) }
    setLoadingThread(false)
  }

  // Scroll to bottom when thread loads
  useEffect(() => {
    if (threadDetail) {
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [threadDetail])

  // Search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(search)
    setSelectedThreadId(null)
    setThreadDetail(null)
  }

  // Refresh
  const handleRefresh = () => {
    setRefreshing(true)
    loadThreads()
  }

  // Compose
  const openCompose = () => {
    setComposeTo(''); setComposeCc(''); setComposeSubject(''); setComposeBody('')
    setComposeThreadId(undefined); setComposeInReplyTo(undefined); setComposeReferences(undefined)
    setShowCompose(true); setShowReply(false)
    setSelectedThreadId(null); setThreadDetail(null)
  }

  // Reply
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
    setShowReply(true); setShowCompose(false)
  }

  // Send
  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo, from: composeFrom || undefined,
          subject: composeSubject, body: composeBody.replace(/\n/g, '<br>'),
          cc: composeCc || undefined, threadId: composeThreadId,
          inReplyTo: composeInReplyTo, references: composeReferences,
        }),
      })
      const data = await res.json()
      if (data.error) { alert('Failed to send: ' + data.error) }
      else {
        setShowCompose(false); setShowReply(false)
        if (composeThreadId && selectedThreadId) selectThread(selectedThreadId)
        loadThreads()
      }
    } catch (err: any) { alert('Failed to send: ' + err.message) }
    setSending(false)
  }

  // Mark as unread
  const markAsUnread = async (threadId: string) => {
    try {
      // We need to mark the last message as unread via the API
      // First get thread detail if we don't have it
      let msgId: string | null = null
      if (threadDetail && threadDetail.id === threadId) {
        msgId = threadDetail.messages[threadDetail.messages.length - 1]?.id
      } else {
        const res = await fetch(`/api/gmail/threads/${threadId}`)
        const data = await res.json()
        if (data.messages?.length) msgId = data.messages[data.messages.length - 1].id
      }
      if (!msgId) return

      await fetch(`/api/gmail/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, addLabelIds: ['UNREAD'] }),
      })

      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isUnread: true } : t))
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null)
        setThreadDetail(null)
      }
    } catch (err) { console.error('Mark unread failed:', err) }
  }

  // Archive
  const archiveThread = async (threadId: string) => {
    try {
      let messageIds: string[] = []
      if (threadDetail && threadDetail.id === threadId) {
        messageIds = threadDetail.messages.map(m => m.id)
      } else {
        const res = await fetch(`/api/gmail/threads/${threadId}`)
        const data = await res.json()
        if (data.messages) messageIds = data.messages.map((m: any) => m.id)
      }

      for (const msgId of messageIds) {
        await fetch(`/api/gmail/threads/${threadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: msgId, removeLabelIds: ['INBOX'] }),
        })
      }

      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null)
        setThreadDetail(null)
      }
    } catch (err) { console.error('Archive failed:', err) }
  }

  // Trash
  const trashThread = async (threadId: string) => {
    try {
      let messageIds: string[] = []
      if (threadDetail && threadDetail.id === threadId) {
        messageIds = threadDetail.messages.map(m => m.id)
      } else {
        const res = await fetch(`/api/gmail/threads/${threadId}`)
        const data = await res.json()
        if (data.messages) messageIds = data.messages.map((m: any) => m.id)
      }

      for (const msgId of messageIds) {
        await fetch(`/api/gmail/threads/${threadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: msgId, addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] }),
        })
      }

      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null)
        setThreadDetail(null)
      }
    } catch (err) { console.error('Trash failed:', err) }
  }

  // Toggle message expansion
  const toggleMessage = (msgId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  const labels = [
    { key: 'INBOX', label: 'Inbox' },
    { key: 'SENT', label: 'Sent' },
    { key: 'STARRED', label: 'Starred' },
    { key: 'DRAFT', label: 'Drafts' },
    { key: 'TRASH', label: 'Trash' },
  ]

  // ─── Thread List View ──────────────────────────────────
  const renderThreadList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={openCompose} style={{
          padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '10px',
          color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <ComposeIcon /> Compose
        </button>
        <div style={{ flex: 1 }} />
        <form onSubmit={handleSearch} style={{ position: 'relative', width: '260px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}><SearchIcon /></div>
          <input type="text" placeholder="Search emails..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 38px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', color: '#f1f5f9', fontSize: '13px' }} />
        </form>
        <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
          style={{ padding: '9px', background: '#1d1d1d', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <RefreshIcon />
        </button>
      </div>

      {/* Label tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
        {labels.map(l => (
          <button key={l.key} onClick={() => { setLabel(l.key); setSelectedThreadId(null); setThreadDetail(null); setSearchQuery(''); setSearch('') }}
            style={{
              padding: '6px 14px', background: label === l.key ? 'rgba(215, 28, 209, 0.15)' : 'transparent',
              border: label === l.key ? '1px solid rgba(215, 28, 209, 0.3)' : '1px solid transparent',
              borderRadius: '8px', color: label === l.key ? '#d71cd1' : '#64748b',
              fontSize: '13px', fontWeight: label === l.key ? 600 : 400, cursor: 'pointer',
            }}>
            {l.label}
          </button>
        ))}
      </div>

      {/* Thread rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444', fontSize: '14px' }}>{error}</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <InboxEmptyIcon />
            <p style={{ marginTop: '12px' }}>{searchQuery ? 'No results' : 'No emails'}</p>
          </div>
        ) : (
          <>
            {threads.map(thread => {
              const sender = parseEmailAddress(thread.from)
              const isHovered = hoveredThread === thread.id
              const displayLabels = getDisplayLabels(thread.labelIds)
              return (
                <div key={thread.id}
                  onMouseEnter={() => setHoveredThread(thread.id)}
                  onMouseLeave={() => setHoveredThread(null)}
                  onClick={() => selectThread(thread.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0',
                    padding: '0', cursor: 'pointer',
                    background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                    position: 'relative',
                  }}>
                  {/* Unread indicator */}
                  <div style={{ width: '4px', height: '100%', minHeight: '58px', background: thread.isUnread ? '#d71cd1' : 'transparent', borderRadius: '0 2px 2px 0', flexShrink: 0 }} />

                  {/* Sender */}
                  <div style={{ width: '180px', padding: '10px 12px', flexShrink: 0, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: '13px', fontWeight: thread.isUnread ? 700 : 400,
                      color: thread.isUnread ? '#f1f5f9' : '#94a3b8',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block'
                    }}>
                      {sender.name}
                    </span>
                  </div>

                  {/* Subject + snippet */}
                  <div style={{ flex: 1, padding: '10px 8px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '13px', fontWeight: thread.isUnread ? 600 : 400,
                      color: thread.isUnread ? '#f1f5f9' : '#c8ccd0',
                      whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                      {thread.subject}
                    </span>
                    {thread.messageCount > 1 && (
                      <span style={{ fontSize: '12px', color: '#64748b', flexShrink: 0 }}>({thread.messageCount})</span>
                    )}
                    {/* Labels */}
                    {displayLabels.map(l => {
                      const style = LABEL_COLORS[l] || { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }
                      return (
                        <span key={l} style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                          background: style.bg, color: style.color, whiteSpace: 'nowrap', flexShrink: 0
                        }}>
                          {l.replace('Label_', '').replace(/_/g, ' ')}
                        </span>
                      )
                    })}
                    <span style={{
                      fontSize: '13px', color: '#64748b', fontWeight: 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {thread.snippet ? ` - ${thread.snippet}` : ''}
                    </span>
                  </div>

                  {/* Attachment icon */}
                  {thread.hasAttachments && (
                    <div style={{ padding: '0 4px', color: '#64748b', flexShrink: 0 }}><AttachmentIcon /></div>
                  )}

                  {/* Date or hover actions */}
                  <div style={{ width: '120px', padding: '10px 12px', textAlign: 'right', flexShrink: 0, position: 'relative' }}>
                    {isHovered ? (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                        <button title="Archive" onClick={() => archiveThread(thread.id)}
                          style={{ padding: '6px', background: 'rgba(148,163,184,0.1)', border: 'none', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                          <ArchiveIcon />
                        </button>
                        <button title="Trash" onClick={() => trashThread(thread.id)}
                          style={{ padding: '6px', background: 'rgba(148,163,184,0.1)', border: 'none', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                          <TrashIcon />
                        </button>
                        <button title="Mark as unread" onClick={() => markAsUnread(thread.id)}
                          style={{ padding: '6px', background: 'rgba(148,163,184,0.1)', border: 'none', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                          <UnreadIcon />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: thread.isUnread ? '#f1f5f9' : '#64748b', fontWeight: thread.isUnread ? 600 : 400 }}>
                        {formatDate(thread.date)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {nextPageToken && (
              <button onClick={() => loadThreads(nextPageToken, true)}
                style={{ width: '100%', padding: '14px', background: 'transparent', border: 'none', color: '#d71cd1', fontSize: '14px', cursor: 'pointer' }}>
                Load more...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  // ─── Thread Detail View ────────────────────────────────
  const renderThreadDetail = () => {
    if (!threadDetail) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <button onClick={() => { setSelectedThreadId(null); setThreadDetail(null); setShowReply(false) }}
            style={{ padding: '8px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', borderRadius: '8px' }}
            title="Back to inbox">
            <BackIcon />
          </button>
          <h2 style={{
            color: '#f1f5f9', fontSize: '16px', fontWeight: 600, margin: 0,
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {threadDetail.subject}
          </h2>
          {/* Thread-level labels */}
          {threadDetail.messages[0] && getDisplayLabels(threadDetail.messages[0].labelIds).map(l => {
            const s = LABEL_COLORS[l] || { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }
            return <span key={l} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', background: s.bg, color: s.color }}>{l.replace('Label_', '').replace(/_/g, ' ')}</span>
          })}
          <span style={{ color: '#64748b', fontSize: '13px', flexShrink: 0 }}>
            {threadDetail.messages.length} message{threadDetail.messages.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => archiveThread(threadDetail.id)} title="Archive"
              style={{ padding: '8px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
              <ArchiveIcon />
            </button>
            <button onClick={() => trashThread(threadDetail.id)} title="Trash"
              style={{ padding: '8px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
              <TrashIcon />
            </button>
            <button onClick={() => markAsUnread(threadDetail.id)} title="Mark as unread"
              style={{ padding: '8px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
              <UnreadIcon />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {threadDetail.messages.map((msg, idx) => {
            const sender = parseEmailAddress(msg.from)
            const recipients = parseEmailAddress(msg.to)
            const isExpanded = expandedMessages.has(msg.id)
            const isFromFWG = sender.email.includes('frederickwraps')
            const isLast = idx === threadDetail.messages.length - 1

            return (
              <div key={msg.id} style={{
                marginBottom: isLast ? '8px' : '2px',
                borderRadius: isExpanded ? '12px' : '8px',
                background: isExpanded ? '#1a1a1a' : 'transparent',
                border: isExpanded ? '1px solid rgba(148,163,184,0.1)' : '1px solid transparent',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
              }}>
                {/* Collapsed row / Header */}
                <div
                  onClick={() => toggleMessage(msg.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: isExpanded ? '14px 16px' : '10px 16px',
                    cursor: 'pointer',
                    borderBottom: isExpanded ? '1px solid rgba(148,163,184,0.08)' : 'none',
                  }}>
                  {/* Avatar */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: isFromFWG ? '#d71cd1' : '#3b82f6',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 600, flexShrink: 0,
                  }}>
                    {getInitials(sender.name)}
                  </div>

                  {/* Name and snippet/to */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>{sender.name}</span>
                      {!isExpanded && (
                        <span style={{ color: '#64748b', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          - {msg.body?.replace(/<[^>]*>/g, '').substring(0, 100)}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                        to {recipients.name || recipients.email}
                        {msg.cc && <span>, cc: {msg.cc}</span>}
                      </div>
                    )}
                  </div>

                  {/* Attachment indicator + Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {msg.attachments.length > 0 && <AttachmentIcon />}
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{formatFullDate(msg.date)}</span>
                    <span style={{ color: '#64748b' }}>{isExpanded ? <CollapseIcon /> : <ExpandIcon />}</span>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <>
                    <div
                      style={{
                        padding: '20px',
                        color: '#d1d5db',
                        fontSize: '14px',
                        lineHeight: '1.7',
                        overflowX: 'auto',
                      }}
                      dangerouslySetInnerHTML={{ __html: msg.body }}
                    />

                    {/* Attachments */}
                    {msg.attachments.length > 0 && (
                      <div style={{
                        padding: '12px 20px 16px',
                        borderTop: '1px solid rgba(148,163,184,0.08)',
                      }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
                          {msg.attachments.length} attachment{msg.attachments.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {msg.attachments.map((att, i) => {
                            const isImage = att.mimeType.startsWith('image/')
                            const url = `/api/gmail/attachment/${msg.id}?attachmentId=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`
                            return (
                              <div key={i}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isImage) setLightboxUrl(url)
                                  else window.open(url, '_blank')
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  padding: '10px 14px', background: '#282a30', borderRadius: '10px',
                                  cursor: 'pointer', border: '1px solid rgba(148,163,184,0.1)',
                                  maxWidth: '260px',
                                }}>
                                {isImage ? (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#1d1d1d', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                ) : (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#d71cd1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 700 }}>
                                    {att.filename.split('.').pop()?.toUpperCase().slice(0, 4)}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
                                  <div style={{ color: '#64748b', fontSize: '11px' }}>{formatSize(att.size)}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
          <div ref={threadEndRef} />

          {/* Reply area */}
          {showReply ? (
            <div style={{ background: '#1a1a1a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>Reply to {composeTo}</span>
                <button onClick={() => setShowReply(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>x</button>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <label style={{ color: '#64748b', fontSize: '13px' }}>From</label>
                  <select value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', background: '#282a30', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px' }}>
                    {aliases.map(a => <option key={a.email} value={a.email}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email}</option>)}
                  </select>
                </div>
                <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your reply..." autoFocus
                  style={{ width: '100%', minHeight: '150px', padding: '12px', background: '#282a30', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', marginBottom: '12px' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleSend} disabled={sending || !composeBody.trim()}
                    style={{ padding: '10px 20px', background: sending || !composeBody.trim() ? '#64748b' : '#d71cd1', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: sending || !composeBody.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SendIcon /> {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button onClick={openReply}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ReplyIcon /> Reply
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Compose View ──────────────────────────────────────
  const renderCompose = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 600, margin: 0 }}>New Email</h2>
        <button onClick={() => setShowCompose(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px' }}>x</button>
      </div>
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        {[
          { label: 'From', type: 'select', value: composeFrom, onChange: setComposeFrom },
          { label: 'To', value: composeTo, onChange: setComposeTo, placeholder: 'recipient@example.com' },
          { label: 'Cc', value: composeCc, onChange: setComposeCc, placeholder: 'cc@example.com' },
          { label: 'Subject', value: composeSubject, onChange: setComposeSubject, placeholder: 'Subject' },
        ].map((field, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ color: '#64748b', fontSize: '13px', width: '60px' }}>{field.label}</label>
            {field.type === 'select' ? (
              <select value={field.value} onChange={(e) => field.onChange(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }}>
                {aliases.map(a => <option key={a.email} value={a.email}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email}</option>)}
              </select>
            ) : (
              <input type="text" value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder={field.placeholder}
                style={{ flex: 1, padding: '10px 14px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
            )}
          </div>
        ))}
        <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your message..."
          style={{ flex: 1, minHeight: '200px', padding: '14px', background: '#1d1d1d', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px', lineHeight: '1.6', resize: 'none' }} />
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSend} disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
          style={{ padding: '10px 24px', background: sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim() ? '#64748b' : '#d71cd1', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SendIcon /> {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )

  // ─── Main Render ───────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: 'calc(100vh - 90px)' }}>
      <div style={{
        height: '100%', background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '16px',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        {showCompose ? renderCompose() :
         selectedThreadId && threadDetail ? renderThreadDetail() :
         loadingThread ? (
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading thread...</div>
         ) : renderThreadList()}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', gap: '12px' }}>
            <a href={lightboxUrl} download onClick={(e) => e.stopPropagation()}
              style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', textDecoration: 'none', fontSize: '13px' }}>
              Download
            </a>
            <button onClick={() => setLightboxUrl(null)}
              style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '18px' }}>
              x
            </button>
          </div>
          <div onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <img src={lightboxUrl} alt="Attachment" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '8px', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </div>
  )
}
