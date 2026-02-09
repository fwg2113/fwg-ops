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

// ─── Icons (Gmail-style, thinner strokes) ────────────────
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
)
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
)
const ComposeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
)
const ReplyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
)
const ArchiveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
)
const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
)
const UnreadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
)
const AttachmentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
)
const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
)
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
)
const ExpandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
)
const CollapseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
)
const InboxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
)
const SentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
)
const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
)
const DraftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
)
const TrashNavIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
)
const LabelIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
)

// ─── Label colors ────────────────────────────────────────
const LABEL_COLORS: Record<string, string> = {
  DRAFT: '#f59e0b',
  STARRED: '#eab308',
}

const SYSTEM_LABELS = ['INBOX', 'SENT', 'DRAFT', 'STARRED', 'IMPORTANT', 'SPAM', 'TRASH', 'UNREAD',
  'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']

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
    ', ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const getCustomLabels = (labelIds: string[]) => {
  return labelIds.filter(l => !SYSTEM_LABELS.includes(l))
}

// ─── Styles ──────────────────────────────────────────────
const S = {
  page: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', height: 'calc(100vh - 90px)', display: 'flex' as const, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e0e0e0' },
  sidebar: { width: '200px', background: '#f6f8fc', borderRight: '1px solid #e0e0e0', display: 'flex' as const, flexDirection: 'column' as const, flexShrink: 0, overflowY: 'auto' as const },
  sidebarCompose: { padding: '16px 16px 8px' },
  composeBtn: { width: '100%', padding: '12px 24px', background: '#c2e7ff', border: 'none', borderRadius: '16px', color: '#001d35', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  navItem: (active: boolean) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: '12px',
    padding: '8px 16px', margin: '1px 8px', borderRadius: '20px', cursor: 'pointer',
    background: active ? '#d3e3fd' : 'transparent',
    color: active ? '#001d35' : '#444746', fontSize: '14px', fontWeight: active ? 600 : 400,
    border: 'none', width: 'calc(100% - 16px)', textAlign: 'left' as const,
  }),
  labelSection: { padding: '12px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#444746', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  main: { flex: 1, background: '#ffffff', display: 'flex' as const, flexDirection: 'column' as const, overflow: 'hidden' },
  toolbar: { display: 'flex' as const, alignItems: 'center' as const, gap: '8px', padding: '8px 16px', borderBottom: '1px solid #e0e0e0', background: '#ffffff' },
  toolbarBtn: { padding: '8px', background: 'transparent', border: 'none', borderRadius: '50%', color: '#5f6368', cursor: 'pointer', display: 'flex' as const, alignItems: 'center' as const },
  searchBar: { flex: 1, maxWidth: '720px', position: 'relative' as const },
  searchInput: { width: '100%', padding: '10px 14px 10px 42px', background: '#eaf1fb', border: 'none', borderRadius: '24px', color: '#202124', fontSize: '14px', outline: 'none' },
  threadRow: (isHovered: boolean, isUnread: boolean) => ({
    display: 'flex' as const, alignItems: 'center' as const,
    padding: '0', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
    background: isHovered ? '#f2f6fc' : isUnread ? '#f2f6fc' : '#ffffff',
  }),
  threadSender: (isUnread: boolean) => ({
    width: '200px', padding: '12px 8px 12px 16px', flexShrink: 0, overflow: 'hidden' as const,
    fontSize: '14px', fontWeight: isUnread ? 700 : 400,
    color: isUnread ? '#202124' : '#5f6368',
    whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const,
  }),
  threadSubject: (isUnread: boolean) => ({
    fontSize: '14px', fontWeight: isUnread ? 700 : 400, color: '#202124',
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  }),
  threadSnippet: { fontSize: '14px', color: '#5f6368', whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const },
  threadDate: (isUnread: boolean) => ({
    fontSize: '12px', fontWeight: isUnread ? 700 : 400,
    color: isUnread ? '#202124' : '#5f6368',
  }),
  hoverAction: { padding: '6px', background: 'transparent', border: 'none', borderRadius: '50%', color: '#5f6368', cursor: 'pointer', display: 'flex' as const, alignItems: 'center' as const },
  badge: (color: string) => ({
    fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
    background: color, color: '#fff', whiteSpace: 'nowrap' as const, flexShrink: 0,
  }),
  customLabel: { fontSize: '11px', fontWeight: 500, padding: '1px 6px', borderRadius: '4px', background: '#e8eaed', color: '#5f6368', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  // Thread detail
  detailHeader: { padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex' as const, alignItems: 'center' as const, gap: '8px', background: '#ffffff' },
  detailSubject: { color: '#202124', fontSize: '22px', fontWeight: 400, margin: 0, flex: 1 },
  detailToolBtn: { padding: '8px', background: 'transparent', border: 'none', borderRadius: '50%', color: '#5f6368', cursor: 'pointer', display: 'flex' as const, alignItems: 'center' as const },
  // Message
  msgCollapsed: (isHovered: boolean) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: '14px',
    padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
    background: isHovered ? '#f5f5f5' : '#ffffff',
  }),
  msgExpanded: { borderBottom: '1px solid #e0e0e0', background: '#ffffff' },
  msgAvatar: (isFWG: boolean) => ({
    width: '40px', height: '40px', borderRadius: '50%',
    background: isFWG ? '#d71cd1' : '#1a73e8',
    color: '#ffffff', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    fontSize: '14px', fontWeight: 600, flexShrink: 0,
  }),
  msgBody: { padding: '0 20px 20px 74px', color: '#202124', fontSize: '14px', lineHeight: '1.6' },
  attachmentCard: {
    display: 'flex' as const, alignItems: 'center' as const, gap: '10px',
    padding: '10px 14px', background: '#f8f9fa', borderRadius: '8px', cursor: 'pointer',
    border: '1px solid #e0e0e0', maxWidth: '240px',
  },
  // Compose
  composeField: { display: 'flex' as const, alignItems: 'center' as const, gap: '12px', borderBottom: '1px solid #e0e0e0', padding: '10px 20px' },
  composeLabel: { color: '#5f6368', fontSize: '14px', width: '50px' },
  composeInput: { flex: 1, padding: '6px 0', background: 'transparent', border: 'none', color: '#202124', fontSize: '14px', outline: 'none' },
  composeBody: { flex: 1, padding: '16px 20px', color: '#202124', fontSize: '14px', lineHeight: '1.6', border: 'none', outline: 'none', resize: 'none' as const, background: 'transparent' },
  sendBtn: (disabled: boolean) => ({
    padding: '10px 24px', background: disabled ? '#ccc' : '#0b57d0', border: 'none', borderRadius: '20px',
    color: '#ffffff', fontSize: '14px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex' as const, alignItems: 'center' as const, gap: '8px',
  }),
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
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Load aliases
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(search); setSelectedThreadId(null); setThreadDetail(null)
  }

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

  const markAsUnread = async (threadId: string) => {
    try {
      await fetch(`/api/gmail/threads/${threadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
      })
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isUnread: true } : t))
      if (selectedThreadId === threadId) { setSelectedThreadId(null); setThreadDetail(null) }
    } catch (err) { console.error('Mark unread failed:', err) }
  }

  const archiveThread = async (threadId: string) => {
    try {
      await fetch(`/api/gmail/threads/${threadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      })
      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selectedThreadId === threadId) { setSelectedThreadId(null); setThreadDetail(null) }
    } catch (err) { console.error('Archive failed:', err) }
  }

  const trashThread = async (threadId: string) => {
    try {
      await fetch(`/api/gmail/threads/${threadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] }),
      })
      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selectedThreadId === threadId) { setSelectedThreadId(null); setThreadDetail(null) }
    } catch (err) { console.error('Trash failed:', err) }
  }

  const toggleMessage = (msgId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId)
      return next
    })
  }

  // ─── Sidebar Nav Items ─────────────────────────────────
  const navItems = [
    { key: 'INBOX', label: 'Inbox', icon: <InboxIcon /> },
    { key: 'SENT', label: 'Sent', icon: <SentIcon /> },
    { key: 'STARRED', label: 'Starred', icon: <StarIcon /> },
    { key: 'DRAFT', label: 'Drafts', icon: <DraftIcon /> },
    { key: 'TRASH', label: 'Trash', icon: <TrashNavIcon /> },
  ]

  // Extract unique custom labels from threads
  const allCustomLabels = Array.from(new Set(threads.flatMap(t => getCustomLabels(t.labelIds)))).sort()

  // ─── Thread List ───────────────────────────────────────
  const renderThreadList = () => (
    <>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <button onClick={handleRefresh} disabled={refreshing} style={S.toolbarBtn} title="Refresh"><RefreshIcon /></button>
        <div style={{ flex: 1 }} />
        <form onSubmit={handleSearch} style={S.searchBar}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}><SearchIcon /></div>
          <input type="text" placeholder="Search mail" value={search} onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput} />
        </form>
        <div style={{ flex: 1 }} />
      </div>

      {/* Threads */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#5f6368' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#d93025' }}>{error}</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#5f6368' }}>
            <div style={{ marginBottom: '12px', opacity: 0.4 }}><InboxIcon /></div>
            {searchQuery ? 'No results for your search' : 'Nothing here'}
          </div>
        ) : (
          <>
            {threads.map(thread => {
              const sender = parseEmailAddress(thread.from)
              const isHovered = hoveredThread === thread.id
              const customLabels = getCustomLabels(thread.labelIds)
              const hasDraft = thread.labelIds.includes('DRAFT')
              return (
                <div key={thread.id}
                  onMouseEnter={() => setHoveredThread(thread.id)}
                  onMouseLeave={() => setHoveredThread(null)}
                  onClick={() => selectThread(thread.id)}
                  style={S.threadRow(isHovered, thread.isUnread)}>

                  {/* Sender */}
                  <div style={S.threadSender(thread.isUnread)}>
                    {sender.name}
                  </div>

                  {/* Subject + labels + snippet */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 0', minWidth: 0, overflow: 'hidden' }}>
                    {/* Custom labels */}
                    {customLabels.map(l => (
                      <span key={l} style={S.customLabel}>
                        {l.replace('Label_', '').replace(/_/g, '/')}
                      </span>
                    ))}
                    {hasDraft && (
                      <span style={{ ...S.badge('#f59e0b'), fontSize: '10px' }}>DRAFT</span>
                    )}
                    <span style={S.threadSubject(thread.isUnread)}>
                      {thread.subject}
                    </span>
                    {thread.messageCount > 1 && (
                      <span style={{ fontSize: '12px', color: '#5f6368', flexShrink: 0 }}>&nbsp;({thread.messageCount})</span>
                    )}
                    <span style={{ color: '#5f6368', flexShrink: 0 }}>&nbsp;-&nbsp;</span>
                    <span style={S.threadSnippet}>{thread.snippet}</span>
                  </div>

                  {/* Attachment + date / hover actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 12px', flexShrink: 0 }}>
                    {thread.hasAttachments && !isHovered && <AttachmentIcon />}
                    {isHovered ? (
                      <div style={{ display: 'flex', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => archiveThread(thread.id)} title="Archive" style={S.hoverAction}><ArchiveIcon /></button>
                        <button onClick={() => trashThread(thread.id)} title="Trash" style={S.hoverAction}><TrashIcon /></button>
                        <button onClick={() => markAsUnread(thread.id)} title="Mark as unread" style={S.hoverAction}><UnreadIcon /></button>
                      </div>
                    ) : (
                      <span style={S.threadDate(thread.isUnread)}>{formatDate(thread.date)}</span>
                    )}
                  </div>
                </div>
              )
            })}
            {nextPageToken && (
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <button onClick={() => loadThreads(nextPageToken, true)}
                  style={{ padding: '8px 24px', background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '20px', color: '#1a73e8', fontSize: '14px', cursor: 'pointer' }}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )

  // ─── Thread Detail ─────────────────────────────────────
  const renderThreadDetail = () => {
    if (!threadDetail) return null
    return (
      <>
        {/* Detail toolbar */}
        <div style={S.detailHeader}>
          <button onClick={() => { setSelectedThreadId(null); setThreadDetail(null); setShowReply(false) }}
            style={S.detailToolBtn} title="Back to inbox"><BackIcon /></button>
          <button onClick={() => archiveThread(threadDetail.id)} style={S.detailToolBtn} title="Archive"><ArchiveIcon /></button>
          <button onClick={() => trashThread(threadDetail.id)} style={S.detailToolBtn} title="Trash"><TrashIcon /></button>
          <button onClick={() => markAsUnread(threadDetail.id)} style={S.detailToolBtn} title="Mark as unread"><UnreadIcon /></button>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#5f6368', fontSize: '12px' }}>
            {threadDetail.messages.length} of {threadDetail.messages.length}
          </span>
        </div>

        {/* Subject */}
        <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={S.detailSubject}>{threadDetail.subject}</h1>
          {/* Labels */}
          {threadDetail.messages[0] && getCustomLabels(threadDetail.messages[0].labelIds).map(l => (
            <span key={l} style={{ ...S.customLabel, fontSize: '12px', padding: '2px 8px' }}>
              {l.replace('Label_', '').replace(/_/g, '/')}
            </span>
          ))}
          <span style={{ background: '#e8eaed', color: '#5f6368', fontSize: '12px', padding: '2px 8px', borderRadius: '4px' }}>Inbox</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {threadDetail.messages.map((msg, idx) => {
            const sender = parseEmailAddress(msg.from)
            const recipients = parseEmailAddress(msg.to)
            const isExpanded = expandedMessages.has(msg.id)
            const isFromFWG = sender.email.includes('frederickwraps')
            const isLast = idx === threadDetail.messages.length - 1
            const isMsgHovered = hoveredMsg === msg.id

            if (!isExpanded) {
              // Collapsed message row (like Gmail)
              return (
                <div key={msg.id}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                  onClick={() => toggleMessage(msg.id)}
                  style={S.msgCollapsed(isMsgHovered)}>
                  {/* Avatar */}
                  <div style={S.msgAvatar(isFromFWG)}>{getInitials(sender.name)}</div>
                  {/* Name */}
                  <span style={{ fontWeight: 600, color: '#202124', fontSize: '14px', width: '180px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sender.name}
                  </span>
                  {/* Snippet */}
                  <span style={{ color: '#5f6368', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {msg.body?.replace(/<[^>]*>/g, '').substring(0, 120)}
                  </span>
                  {/* Date */}
                  <span style={{ color: '#5f6368', fontSize: '12px', flexShrink: 0, marginLeft: '8px' }}>
                    {formatFullDate(msg.date)}
                  </span>
                </div>
              )
            }

            // Expanded message
            return (
              <div key={msg.id} style={S.msgExpanded}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 20px 12px' }}>
                  <div style={S.msgAvatar(isFromFWG)}>{getInitials(sender.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#202124', fontSize: '14px' }}>{sender.name}</span>
                        <span style={{ color: '#5f6368', fontSize: '12px', marginLeft: '8px' }}>&lt;{sender.email}&gt;</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#5f6368', fontSize: '12px' }}>{formatFullDate(msg.date)}</span>
                        <button onClick={(e) => { e.stopPropagation(); toggleMessage(msg.id) }} style={S.detailToolBtn}><CollapseIcon /></button>
                      </div>
                    </div>
                    <div style={{ color: '#5f6368', fontSize: '12px', marginTop: '2px' }}>
                      to {recipients.name || recipients.email}
                      {msg.cc && <span>, cc: {msg.cc}</span>}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={S.msgBody} dangerouslySetInnerHTML={{ __html: msg.body }} />

                {/* Attachments */}
                {msg.attachments.length > 0 && (
                  <div style={{ padding: '0 20px 16px 74px' }}>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginBottom: '8px' }}>
                      {msg.attachments.length} attachment{msg.attachments.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {msg.attachments.map((att, i) => {
                        const isImage = att.mimeType.startsWith('image/')
                        const url = `/api/gmail/attachment/${msg.id}?attachmentId=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`
                        return (
                          <div key={i} onClick={(e) => {
                            e.stopPropagation()
                            if (isImage) setLightboxUrl(url); else window.open(url, '_blank')
                          }} style={S.attachmentCard}>
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

          {/* Reply area */}
          <div style={{ padding: '16px 20px 24px 74px' }}>
            {showReply ? (
              <div style={{ border: '1px solid #dadce0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#202124', fontSize: '14px' }}>Reply to {composeTo}</span>
                  <button onClick={() => setShowReply(false)} style={{ background: 'transparent', border: 'none', color: '#5f6368', cursor: 'pointer', fontSize: '16px' }}>x</button>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <label style={{ color: '#5f6368', fontSize: '13px' }}>From</label>
                    <select value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', fontSize: '13px', background: '#fff' }}>
                      {aliases.map(a => <option key={a.email} value={a.email}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email}</option>)}
                    </select>
                  </div>
                  <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Write your reply..." autoFocus
                    style={{ width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', background: '#fff' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button onClick={handleSend} disabled={sending || !composeBody.trim()} style={S.sendBtn(sending || !composeBody.trim())}>
                      <SendIcon /> {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={openReply}
                  style={{ padding: '10px 24px', border: '1px solid #dadce0', borderRadius: '20px', background: '#ffffff', color: '#202124', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ReplyIcon /> Reply
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // ─── Compose View ──────────────────────────────────────
  const renderCompose = () => (
    <>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: '#202124', fontSize: '18px', fontWeight: 400, margin: 0 }}>New Message</h2>
        <button onClick={() => setShowCompose(false)} style={{ background: 'transparent', border: 'none', color: '#5f6368', cursor: 'pointer', fontSize: '20px' }}>x</button>
      </div>
      <div style={S.composeField}>
        <label style={S.composeLabel}>From</label>
        <select value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)}
          style={{ ...S.composeInput, cursor: 'pointer' }}>
          {aliases.map(a => <option key={a.email} value={a.email}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email}</option>)}
        </select>
      </div>
      <div style={S.composeField}>
        <label style={S.composeLabel}>To</label>
        <input type="text" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="Recipients" style={S.composeInput} />
      </div>
      <div style={S.composeField}>
        <label style={S.composeLabel}>Cc</label>
        <input type="text" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} placeholder="" style={S.composeInput} />
      </div>
      <div style={S.composeField}>
        <label style={S.composeLabel}>Subject</label>
        <input type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="" style={S.composeInput} />
      </div>
      <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder=""
        style={S.composeBody as any} />
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSend} disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
          style={S.sendBtn(sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim())}>
          <SendIcon /> {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </>
  )

  // ─── Render ────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Left sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarCompose}>
          <button onClick={openCompose} style={S.composeBtn}>
            <ComposeIcon /> Compose
          </button>
        </div>
        <nav style={{ flex: 1, paddingTop: '4px' }}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => {
              setLabel(item.key); setSelectedThreadId(null); setThreadDetail(null)
              setSearchQuery(''); setSearch(''); setShowCompose(false)
            }} style={S.navItem(label === item.key)}>
              <span style={{ display: 'flex', alignItems: 'center', color: label === item.key ? '#001d35' : '#444746' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Custom labels */}
          {allCustomLabels.length > 0 && (
            <>
              <div style={S.labelSection}>Labels</div>
              {allCustomLabels.map(l => (
                <button key={l} onClick={() => {
                  setSearchQuery(`label:${l}`); setSearch(`label:${l}`)
                  setSelectedThreadId(null); setThreadDetail(null)
                }} style={{
                  ...S.navItem(searchQuery === `label:${l}`),
                  fontSize: '13px',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: '#444746' }}><LabelIcon /></span>
                  {l.replace('Label_', '').replace(/_/g, '/')}
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Main content */}
      <div style={S.main}>
        {showCompose ? renderCompose() :
         selectedThreadId && threadDetail ? renderThreadDetail() :
         loadingThread ? (
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368' }}>Loading...</div>
         ) : renderThreadList()}
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
