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

type GmailLabel = {
  id: string
  name: string
  type: string
  color: string | null
  textColor: string | null
}

// ─── Gmail Material Icons (outlined style) ───────────────
const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
)

// Gmail's actual material icon paths
const ICONS = {
  inbox: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z',
  send: 'M3.4 20.4l17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z',
  compose: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  archive: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
  trash: 'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
  markUnread: 'M18.83 7h-2.6L10.5 4 4.77 7H2v2h2v13h16V9h2V7h-3.17zM10.5 6.12L13.36 7H7.64l2.86-1.88zM18 20H6V9h12v11zm-8-9H8v2h2v-2zm0 4H8v2h2v-2zm4-4h-2v2h2v-2zm0 4h-2v2h2v-2z',
  star: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  draft: 'M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 13L3.74 7.84 12 3l8.26 4.84L12 13z',
  label: 'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  expand: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  collapse: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  attachment: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  checkbox: 'M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  checkboxChecked: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  selectAll: 'M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z',
}

const SYSTEM_LABELS = new Set(['INBOX', 'SENT', 'DRAFT', 'STARRED', 'IMPORTANT', 'SPAM', 'TRASH', 'UNREAD',
  'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'])

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
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diff === 0 && date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'short' })
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatFullDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const getCustomLabels = (labelIds: string[]) => labelIds.filter(l => !SYSTEM_LABELS.has(l))

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
  const [labelMap, setLabelMap] = useState<Record<string, GmailLabel>>({})
  const [allLabels, setAllLabels] = useState<GmailLabel[]>([])
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
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Load aliases + labels
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/gmail/aliases')
        const data = await res.json()
        if (data.aliases) {
          setAliases(data.aliases)
          const primary = data.aliases.find((a: Alias) => a.isPrimary)
          if (primary) setComposeFrom(primary.email)
        }
      } catch (err) { console.error('Failed to load aliases:', err) }
    })()
    ;(async () => {
      try {
        const res = await fetch('/api/gmail/labels')
        const data = await res.json()
        if (data.labels) {
          const map: Record<string, GmailLabel> = {}
          const userLabels: GmailLabel[] = []
          data.labels.forEach((l: GmailLabel) => {
            map[l.id] = l
            if (l.type === 'user') userLabels.push(l)
          })
          setLabelMap(map)
          setAllLabels(userLabels.sort((a, b) => a.name.localeCompare(b.name)))
        }
      } catch (err) { console.error('Failed to load labels:', err) }
    })()
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
      else { setThreads(data.threads || []); setSelected(new Set()) }
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
    setShowReply(false); setShowCompose(false)
    try {
      const res = await fetch(`/api/gmail/threads/${threadId}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setThreadDetail(data)
      if (data.messages?.length) {
        setExpandedMessages(new Set([data.messages[data.messages.length - 1].id]))
      }
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isUnread: false } : t))
    } catch (err: any) { setError(err.message) }
    setLoadingThread(false)
  }

  useEffect(() => {
    if (threadDetail) setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [threadDetail])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearchQuery(search); setSelectedThreadId(null); setThreadDetail(null) }
  const handleRefresh = () => { setRefreshing(true); loadThreads() }

  const openCompose = () => {
    setComposeTo(''); setComposeCc(''); setComposeSubject(''); setComposeBody('')
    setComposeThreadId(undefined); setComposeInReplyTo(undefined); setComposeReferences(undefined)
    setShowCompose(true); setShowReply(false); setSelectedThreadId(null); setThreadDetail(null)
  }

  const openReply = () => {
    if (!threadDetail) return
    const lastMsg = threadDetail.messages[threadDetail.messages.length - 1]
    const sender = parseEmailAddress(lastMsg.from)
    setComposeTo(sender.email); setComposeCc('')
    setComposeSubject(lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`)
    setComposeBody(''); setComposeThreadId(threadDetail.id)
    setComposeInReplyTo(lastMsg.messageId)
    setComposeReferences(lastMsg.references ? `${lastMsg.references} ${lastMsg.messageId}` : lastMsg.messageId)
    setShowReply(true); setShowCompose(false)
  }

  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo, from: composeFrom || undefined, subject: composeSubject,
          body: composeBody.replace(/\n/g, '<br>'), cc: composeCc || undefined,
          threadId: composeThreadId, inReplyTo: composeInReplyTo, references: composeReferences,
        }),
      })
      const data = await res.json()
      if (data.error) alert('Failed to send: ' + data.error)
      else {
        setShowCompose(false); setShowReply(false)
        if (composeThreadId && selectedThreadId) selectThread(selectedThreadId)
        loadThreads()
      }
    } catch (err: any) { alert('Failed to send: ' + err.message) }
    setSending(false)
  }

  // Bulk + single actions
  const modifyThread = async (threadId: string, add?: string[], remove?: string[]) => {
    await fetch(`/api/gmail/threads/${threadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
    })
  }

  const markAsUnread = async (threadId: string) => {
    await modifyThread(threadId, ['UNREAD'])
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isUnread: true } : t))
    if (selectedThreadId === threadId) { setSelectedThreadId(null); setThreadDetail(null) }
  }

  const archiveThread = async (threadId: string) => {
    await modifyThread(threadId, undefined, ['INBOX'])
    setThreads(prev => prev.filter(t => t.id !== threadId))
    setSelected(prev => { const n = new Set(prev); n.delete(threadId); return n })
    if (selectedThreadId === threadId) { setSelectedThreadId(null); setThreadDetail(null) }
  }

  const trashThread = async (threadId: string) => {
    await modifyThread(threadId, ['TRASH'], ['INBOX'])
    setThreads(prev => prev.filter(t => t.id !== threadId))
    setSelected(prev => { const n = new Set(prev); n.delete(threadId); return n })
    if (selectedThreadId === threadId) { setSelectedThreadId(null); setThreadDetail(null) }
  }

  const bulkArchive = async () => {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => modifyThread(id, undefined, ['INBOX'])))
    setThreads(prev => prev.filter(t => !selected.has(t.id)))
    setSelected(new Set())
  }

  const bulkTrash = async () => {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => modifyThread(id, ['TRASH'], ['INBOX'])))
    setThreads(prev => prev.filter(t => !selected.has(t.id)))
    setSelected(new Set())
  }

  const bulkMarkUnread = async () => {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => modifyThread(id, ['UNREAD'])))
    setThreads(prev => prev.map(t => selected.has(t.id) ? { ...t, isUnread: true } : t))
    setSelected(new Set())
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const toggleSelectAll = () => {
    if (selected.size === threads.length) setSelected(new Set())
    else setSelected(new Set(threads.map(t => t.id)))
  }

  const toggleMessage = (msgId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId)
      return next
    })
  }

  const resolveLabelName = (id: string) => labelMap[id]?.name || id

  // Nav items
  const navItems = [
    { key: 'INBOX', label: 'Inbox', icon: ICONS.inbox },
    { key: 'SENT', label: 'Sent', icon: ICONS.send },
    { key: 'STARRED', label: 'Starred', icon: ICONS.star },
    { key: 'DRAFT', label: 'Drafts', icon: ICONS.draft },
    { key: 'TRASH', label: 'Trash', icon: ICONS.trash },
  ]

  // ─── RENDER ────────────────────────────────────────────

  // Thread list
  const renderThreadList = () => (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', borderBottom: '1px solid #e0e0e0', minHeight: '48px' }}>
        {/* Select all checkbox */}
        <button onClick={toggleSelectAll} title={selected.size === threads.length ? 'Deselect all' : 'Select all'}
          style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}>
          <Icon d={selected.size > 0 && selected.size === threads.length ? ICONS.checkboxChecked : selected.size > 0 ? ICONS.selectAll : ICONS.checkbox} size={20} />
        </button>

        {selected.size > 0 ? (
          /* Bulk actions */
          <>
            <span style={{ fontSize: '13px', color: '#5f6368', padding: '0 8px' }}>{selected.size} selected</span>
            <button onClick={bulkArchive} title="Archive" style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}><Icon d={ICONS.archive} /></button>
            <button onClick={bulkTrash} title="Delete" style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}><Icon d={ICONS.trash} /></button>
            <button onClick={bulkMarkUnread} title="Mark as unread" style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}><Icon d={ICONS.markUnread} /></button>
          </>
        ) : (
          <>
            <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
              style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}>
              <Icon d={ICONS.refresh} />
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />
        <form onSubmit={handleSearch} style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#5f6368' }}><Icon d={ICONS.search} size={18} /></div>
          <input type="text" placeholder="Search mail" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 40px', background: '#eaf1fb', border: 'none', borderRadius: '24px', color: '#202124', fontSize: '14px', outline: 'none' }} />
        </form>
      </div>

      {/* Threads */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#5f6368' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#d93025' }}>{error}</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#5f6368' }}>
            {searchQuery ? 'No results' : 'Nothing here'}
          </div>
        ) : (
          <>
            {threads.map(thread => {
              const sender = parseEmailAddress(thread.from)
              const isHovered = hoveredThread === thread.id
              const isSelected = selected.has(thread.id)
              const customLabels = getCustomLabels(thread.labelIds)
              const hasDraft = thread.labelIds.includes('DRAFT')

              return (
                <div key={thread.id}
                  onMouseEnter={() => setHoveredThread(thread.id)}
                  onMouseLeave={() => setHoveredThread(null)}
                  onClick={() => selectThread(thread.id)}
                  style={{
                    display: 'flex', alignItems: 'center', height: '40px',
                    cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                    background: isSelected ? '#c2dbff' : isHovered ? '#f2f6fc' : thread.isUnread ? '#f2f6fc' : '#fff',
                    overflow: 'hidden',
                  }}>
                  {/* Checkbox */}
                  <div onClick={(e) => toggleSelect(thread.id, e)}
                    style={{ width: '40px', display: 'flex', justifyContent: 'center', flexShrink: 0, color: '#5f6368' }}>
                    <Icon d={isSelected ? ICONS.checkboxChecked : ICONS.checkbox} size={18} />
                  </div>

                  {/* Sender - fixed width, truncated */}
                  <div style={{
                    width: '180px', flexShrink: 0, fontSize: '14px', paddingRight: '12px',
                    fontWeight: thread.isUnread ? 700 : 400, color: thread.isUnread ? '#202124' : '#5f6368',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {sender.name}
                  </div>

                  {/* Subject + labels + snippet - MUST truncate */}
                  <div style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '4px',
                    overflow: 'hidden',
                  }}>
                    {customLabels.slice(0, 2).map(l => (
                      <span key={l} style={{
                        fontSize: '11px', padding: '1px 5px', borderRadius: '3px',
                        background: '#e8eaed', color: '#5f6368', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {resolveLabelName(l)}
                      </span>
                    ))}
                    {hasDraft && (
                      <span style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', whiteSpace: 'nowrap', flexShrink: 0 }}>Draft</span>
                    )}
                    <span style={{
                      fontSize: '14px', fontWeight: thread.isUnread ? 700 : 400, color: '#202124',
                      whiteSpace: 'nowrap', flexShrink: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {thread.subject}
                    </span>
                    {thread.messageCount > 1 && (
                      <span style={{ fontSize: '12px', color: '#5f6368', flexShrink: 0 }}>({thread.messageCount})</span>
                    )}
                    <span style={{ color: '#5f6368', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      &nbsp;- {thread.snippet}
                    </span>
                  </div>

                  {/* Right side: date or hover actions */}
                  <div style={{ width: '100px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '8px' }}>
                    {isHovered ? (
                      <div style={{ display: 'flex', gap: '0' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => archiveThread(thread.id)} title="Archive"
                          style={{ padding: '6px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}>
                          <Icon d={ICONS.archive} size={18} />
                        </button>
                        <button onClick={() => trashThread(thread.id)} title="Delete"
                          style={{ padding: '6px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}>
                          <Icon d={ICONS.trash} size={18} />
                        </button>
                        <button onClick={() => markAsUnread(thread.id)} title="Mark as unread"
                          style={{ padding: '6px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}>
                          <Icon d={ICONS.markUnread} size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {thread.hasAttachments && <span style={{ color: '#5f6368', marginRight: '6px', display: 'flex' }}><Icon d={ICONS.attachment} size={16} /></span>}
                        <span style={{ fontSize: '12px', fontWeight: thread.isUnread ? 700 : 400, color: thread.isUnread ? '#202124' : '#5f6368', whiteSpace: 'nowrap' }}>
                          {formatDate(thread.date)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {nextPageToken && (
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <button onClick={() => loadThreads(nextPageToken, true)}
                  style={{ padding: '8px 24px', background: '#fff', border: '1px solid #dadce0', borderRadius: '20px', color: '#1a73e8', fontSize: '14px', cursor: 'pointer' }}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )

  // Thread detail
  const renderThreadDetail = () => {
    if (!threadDetail) return null
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', borderBottom: '1px solid #e0e0e0', minHeight: '48px' }}>
          <button onClick={() => { setSelectedThreadId(null); setThreadDetail(null); setShowReply(false) }}
            style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }} title="Back">
            <Icon d={ICONS.back} />
          </button>
          <button onClick={() => archiveThread(threadDetail.id)} style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }} title="Archive"><Icon d={ICONS.archive} /></button>
          <button onClick={() => trashThread(threadDetail.id)} style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }} title="Delete"><Icon d={ICONS.trash} /></button>
          <button onClick={() => markAsUnread(threadDetail.id)} style={{ padding: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }} title="Mark as unread"><Icon d={ICONS.markUnread} /></button>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#5f6368', fontSize: '12px', paddingRight: '8px' }}>
            {threadDetail.messages.length} message{threadDetail.messages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Subject */}
        <div style={{ padding: '14px 60px 6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ color: '#202124', fontSize: '22px', fontWeight: 400, margin: 0 }}>{threadDetail.subject}</h1>
          {threadDetail.messages[0] && getCustomLabels(threadDetail.messages[0].labelIds).map(l => (
            <span key={l} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#e8eaed', color: '#5f6368' }}>{resolveLabelName(l)}</span>
          ))}
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#e8eaed', color: '#5f6368' }}>Inbox</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {threadDetail.messages.map((msg, idx) => {
            const sender = parseEmailAddress(msg.from)
            const recipients = parseEmailAddress(msg.to)
            const isExpanded = expandedMessages.has(msg.id)
            const isFromFWG = sender.email.includes('frederickwraps')
            const isMsgHovered = hoveredMsg === msg.id

            if (!isExpanded) {
              return (
                <div key={msg.id}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                  onClick={() => toggleMessage(msg.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 20px 10px 60px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', background: isMsgHovered ? '#f5f5f5' : '#fff' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isFromFWG ? '#d71cd1' : '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
                    {getInitials(sender.name)}
                  </div>
                  <span style={{ fontWeight: 600, color: '#202124', fontSize: '14px', width: '160px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender.name}</span>
                  <span style={{ color: '#5f6368', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {msg.body?.replace(/<[^>]*>/g, '').substring(0, 140)}
                  </span>
                  {msg.attachments.length > 0 && <span style={{ color: '#5f6368', flexShrink: 0, display: 'flex' }}><Icon d={ICONS.attachment} size={16} /></span>}
                  <span style={{ color: '#5f6368', fontSize: '12px', flexShrink: 0 }}>{formatFullDate(msg.date)}</span>
                </div>
              )
            }

            return (
              <div key={msg.id} style={{ borderBottom: '1px solid #e0e0e0', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 20px 12px 60px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isFromFWG ? '#d71cd1' : '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
                    {getInitials(sender.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#202124', fontSize: '14px' }}>{sender.name}</span>
                        <span style={{ color: '#5f6368', fontSize: '12px', marginLeft: '6px' }}>&lt;{sender.email}&gt;</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ color: '#5f6368', fontSize: '12px' }}>{formatFullDate(msg.date)}</span>
                        <button onClick={(e) => { e.stopPropagation(); toggleMessage(msg.id) }}
                          style={{ padding: '4px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}>
                          <Icon d={ICONS.collapse} size={18} />
                        </button>
                      </div>
                    </div>
                    <div style={{ color: '#5f6368', fontSize: '12px', marginTop: '2px' }}>
                      to {recipients.name || recipients.email}{msg.cc && <span>, cc: {msg.cc}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 20px 20px 114px', color: '#202124', fontSize: '14px', lineHeight: '1.6', overflowX: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: msg.body }} />

                {msg.attachments.length > 0 && (
                  <div style={{ padding: '0 20px 16px 114px' }}>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginBottom: '8px' }}>
                      {msg.attachments.length} attachment{msg.attachments.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {msg.attachments.map((att, i) => {
                        const isImage = att.mimeType.startsWith('image/')
                        const url = `/api/gmail/attachment/${msg.id}?attachmentId=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`
                        return (
                          <div key={i} onClick={(e) => { e.stopPropagation(); if (isImage) setLightboxUrl(url); else window.open(url, '_blank') }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8f9fa', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e0e0e0', maxWidth: '240px' }}>
                            {isImage ? (
                              <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ) : (
                              <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                                {att.filename.split('.').pop()?.toUpperCase().slice(0, 4)}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#202124', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
                              <div style={{ color: '#5f6368', fontSize: '11px' }}>{formatSize(att.size)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div ref={threadEndRef} />

          <div style={{ padding: '16px 20px 24px 114px' }}>
            {showReply ? (
              <div style={{ border: '1px solid #dadce0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#202124', fontSize: '14px' }}>Reply to {composeTo}</span>
                  <button onClick={() => setShowReply(false)} style={{ background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', fontSize: '16px' }}>x</button>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <label style={{ color: '#5f6368', fontSize: '13px' }}>From</label>
                    <select value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', fontSize: '13px', background: '#fff' }}>
                      {aliases.map(a => <option key={a.email} value={a.email}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email}</option>)}
                    </select>
                  </div>
                  <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your reply..." autoFocus
                    style={{ width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', background: '#fff' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button onClick={handleSend} disabled={sending || !composeBody.trim()}
                      style={{ padding: '10px 24px', background: sending || !composeBody.trim() ? '#ccc' : '#0b57d0', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: sending || !composeBody.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon d={ICONS.send} size={16} /> {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={openReply}
                style={{ padding: '10px 24px', border: '1px solid #dadce0', borderRadius: '20px', background: '#fff', color: '#202124', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon d={ICONS.reply} size={18} /> Reply
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  // Compose
  const renderCompose = () => (
    <>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: '#202124', fontSize: '18px', fontWeight: 400, margin: 0 }}>New Message</h2>
        <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', fontSize: '20px' }}>x</button>
      </div>
      {[
        { label: 'From', type: 'select', value: composeFrom, onChange: setComposeFrom },
        { label: 'To', value: composeTo, onChange: setComposeTo, placeholder: 'Recipients' },
        { label: 'Cc', value: composeCc, onChange: setComposeCc, placeholder: '' },
        { label: 'Subject', value: composeSubject, onChange: setComposeSubject, placeholder: '' },
      ].map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e0e0e0', padding: '10px 20px' }}>
          <label style={{ color: '#5f6368', fontSize: '14px', width: '50px' }}>{f.label}</label>
          {f.type === 'select' ? (
            <select value={f.value} onChange={(e) => f.onChange(e.target.value)}
              style={{ flex: 1, padding: '6px 0', background: 'transparent', border: 'none', color: '#202124', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
              {aliases.map(a => <option key={a.email} value={a.email}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email}</option>)}
            </select>
          ) : (
            <input type="text" value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder}
              style={{ flex: 1, padding: '6px 0', background: 'transparent', border: 'none', color: '#202124', fontSize: '14px', outline: 'none' }} />
          )}
        </div>
      ))}
      <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder=""
        style={{ flex: 1, padding: '16px 20px', color: '#202124', fontSize: '14px', lineHeight: '1.6', border: 'none', outline: 'none', resize: 'none', background: 'transparent' }} />
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSend} disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
          style={{ padding: '10px 24px', background: sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim() ? '#ccc' : '#0b57d0', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon d={ICONS.send} size={16} /> {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </>
  )

  // ─── MAIN RENDER ───────────────────────────────────────
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', height: 'calc(100vh - 90px)', display: 'flex', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
      {/* Sidebar */}
      <div style={{ width: '220px', background: '#f6f8fc', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 8px' }}>
          <button onClick={openCompose}
            style={{ width: '100%', padding: '12px 20px', background: '#c2e7ff', border: 'none', borderRadius: '16px', color: '#001d35', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <Icon d={ICONS.compose} size={18} /> Compose
          </button>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', paddingTop: '4px' }}>
          {navItems.map(item => {
            const isActive = label === item.key && !searchQuery
            return (
              <button key={item.key} onClick={() => {
                setLabel(item.key); setSelectedThreadId(null); setThreadDetail(null)
                setSearchQuery(''); setSearch(''); setShowCompose(false); setSelected(new Set())
              }} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '6px 16px', margin: '1px 8px', borderRadius: '20px', cursor: 'pointer',
                background: isActive ? '#d3e3fd' : 'transparent',
                color: isActive ? '#001d35' : '#444746', fontSize: '14px', fontWeight: isActive ? 700 : 400,
                border: 'none', width: 'calc(100% - 16px)', textAlign: 'left',
              }}>
                <span style={{ display: 'flex', color: isActive ? '#001d35' : '#444746' }}><Icon d={item.icon} /></span>
                {item.label}
              </button>
            )
          })}

          {/* ALL user labels */}
          {allLabels.length > 0 && (
            <>
              <div style={{ padding: '16px 16px 6px', fontSize: '11px', fontWeight: 600, color: '#444746', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Labels</div>
              {allLabels.map(l => {
                const isActive = searchQuery === `label:${l.name}`
                return (
                  <button key={l.id} onClick={() => {
                    setSearchQuery(`label:${l.name}`); setSearch(`label:${l.name}`)
                    setSelectedThreadId(null); setThreadDetail(null); setSelected(new Set())
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '4px 16px', margin: '0 8px', borderRadius: '20px', cursor: 'pointer',
                    background: isActive ? '#d3e3fd' : 'transparent',
                    color: isActive ? '#001d35' : '#444746', fontSize: '13px', fontWeight: isActive ? 600 : 400,
                    border: 'none', width: 'calc(100% - 16px)', textAlign: 'left',
                    overflow: 'hidden',
                  }}>
                    <span style={{ display: 'flex', color: '#444746', flexShrink: 0 }}><Icon d={ICONS.label} size={18} /></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </nav>
      </div>

      {/* Main */}
      <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {showCompose ? renderCompose() :
         selectedThreadId && threadDetail ? renderThreadDetail() :
         loadingThread ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368' }}>Loading...</div> :
         renderThreadList()}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', gap: '12px' }}>
            <a href={lightboxUrl} download onClick={(e) => e.stopPropagation()}
              style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', color: '#fff', textDecoration: 'none', fontSize: '14px' }}>
              Download
            </a>
            <button onClick={() => setLightboxUrl(null)}
              style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '20px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>
              Close
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
