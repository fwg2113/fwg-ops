'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useBuckets, type CachedThread } from './hooks/useBuckets'
import { useSync } from './hooks/useSync'
import { BUCKET_LABELS, FOLLOW_UP_TIER_LABELS, type Bucket, type FollowUpTier } from '../../lib/email-buckets'

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

type ThreadDetail = { id: string; messages: EmailMessage[]; subject: string }
type Alias = { email: string; displayName: string; isPrimary: boolean; isDefault: boolean }

// Gmail Material Icons (filled)
const I = ({ d, sz = 20, c }: { d: string; sz?: number; c?: string }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill={c || 'currentColor'}><path d={d} /></svg>
)
const P = {
  inbox: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z',
  send: 'M3.4 20.4l17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z',
  compose: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  archive: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
  trash: 'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
  unreadMark: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z',
  unreadOpen: 'M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zm-2 0v.01L12 13 4 8l8-4.68L19.99 8zM4 18V10l8 5 8-5v8H4z',
  starOff: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  starOn: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  draft: 'M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 13L3.74 7.84 12 3l8.26 4.84L12 13z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  chevLeft: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  chevRight: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  collapse: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  expand: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  attach: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  cb: 'M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  cbOn: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  flag: 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
  flagOff: 'M12.36 6l.4 2H18v6h-3.36l-.4-2H7V6h5.36M14 4H5v17h2v-7h5.6l.4 2h7V4h-6z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  done: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
}

const parseAddr = (r: string) => { const m = r.match(/^(.+?)\s*<(.+?)>$/); return m ? { n: m[1].replace(/"/g,'').trim(), e: m[2] } : { n: r.split('@')[0], e: r } }
const initials = (n: string) => { const p = n.split(' ').filter(x => x && !x.includes('@')); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : p.length ? p[0].substring(0,2).toUpperCase() : '??' }
const fmtDate = (d: string) => { const dt = new Date(d), now = new Date(), diff = Math.floor((now.getTime()-dt.getTime())/864e5); if (!diff && dt.getDate()===now.getDate()) return dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); if (diff<7) return dt.toLocaleDateString([],{month:'short',day:'numeric'}); return dt.getFullYear()===now.getFullYear() ? dt.toLocaleDateString([],{month:'short',day:'numeric'}) : dt.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) }
const fmtFull = (d: string) => { const dt = new Date(d); return dt.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'})+', '+dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) }
const fmtSz = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`

// Bucket icon mapping
const BUCKET_ICONS: Record<Bucket, string> = {
  need_to_respond: P.inbox,
  responded: P.send,
  waiting_on_task: P.flag,
  follow_up: P.clock,
  archived: P.done,
}

// Bucket colors for count badges
const BUCKET_COLORS: Record<Bucket, string> = {
  need_to_respond: '#d93025',
  responded: '#1a73e8',
  waiting_on_task: '#e37400',
  follow_up: '#9334e6',
  archived: '#5f6368',
}

export default function EmailInbox() {
  const buckets = useBuckets()
  const { syncing, lastSync, triggerSync } = useSync(() => {
    buckets.refresh()
    window.dispatchEvent(new Event('unread-counts-changed'))
  })

  const [selThread, setSelThread] = useState<string|null>(null)
  const [detail, setDetail] = useState<ThreadDetail|null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [aliases, setAliases] = useState<Alias[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [cTo, setCTo] = useState(''); const [cCc, setCCc] = useState(''); const [cSubj, setCSubj] = useState('')
  const [cBody, setCBody] = useState(''); const [cFrom, setCFrom] = useState('')
  const [cThreadId, setCThreadId] = useState<string|undefined>()
  const [cReplyTo, setCReplyTo] = useState<string|undefined>()
  const [cRefs, setCRefs] = useState<string|undefined>()
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string|null>(null)
  const [hovRow, setHovRow] = useState<string|null>(null)
  const [hovMsg, setHovMsg] = useState<string|null>(null)
  const [lightbox, setLightbox] = useState<string|null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [followUpExpanded, setFollowUpExpanded] = useState(false)
  const [customerContext, setCustomerContext] = useState<any>(null)
  const [customerContextLoading, setCustomerContextLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Load aliases on mount
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/gmail/aliases'); const d = await r.json(); if(d.aliases){setAliases(d.aliases); const p=d.aliases.find((a:Alias)=>a.isPrimary); if(p)setCFrom(p.email)} } catch(e){}
    })()
  }, [])

  // Initial load: fetch bucket data + trigger background sync
  useEffect(() => {
    buckets.loadBucket('need_to_respond', null, 1)
    buckets.loadCounts()
    // Trigger incremental sync in background
    triggerSync('incremental')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openThread = async (gmailThreadId: string) => {
    setSelThread(gmailThreadId); setLoadingDetail(true); setShowReply(false); setShowCompose(false)
    try {
      const r = await fetch(`/api/gmail/threads/${gmailThreadId}`); const d = await r.json()
      if (d.error) { setErr(d.error); setLoadingDetail(false); return }
      setDetail(d)
      if (d.messages?.length) setExpanded(new Set([d.messages[d.messages.length-1].id]))
      // Mark as read in local state
      buckets.setThreads(prev => prev.map(t => t.gmail_thread_id === gmailThreadId ? {...t, is_unread: false} : t))
      window.dispatchEvent(new Event('unread-counts-changed'))
    } catch(e:any) { setErr(e.message) }
    setLoadingDetail(false)
  }

  useEffect(() => { if(detail) setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),100) }, [detail])

  // Fetch customer context when thread opens
  useEffect(() => {
    if (!detail?.messages?.length) { setCustomerContext(null); return }
    const externalMsg = detail.messages.find(m => !parseAddr(m.from).e.includes('frederickwraps'))
    if (!externalMsg) { setCustomerContext(null); return }
    const email = parseAddr(externalMsg.from).e
    setCustomerContextLoading(true)
    fetch(`/api/customers/context?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setCustomerContext(d))
      .catch(() => setCustomerContext(null))
      .finally(() => setCustomerContextLoading(false))
  }, [detail])

  // Quick-reply templates
  const QUICK_REPLIES = [
    { label: 'Quote attached', body: 'Hi,\n\nPlease find your quote attached. Let me know if you have any questions or would like to move forward!\n\nThanks,\nFrederick Wraps & Graphics' },
    { label: 'Mockup ready', body: 'Hi,\n\nYour mockup is ready! Please take a look and let me know if you would like any changes or if we are good to move forward.\n\nThanks,\nFrederick Wraps & Graphics' },
    { label: 'Following up', body: 'Hi,\n\nJust following up on my last message. Let me know if you have any questions or if you would like to move forward!\n\nThanks,\nFrederick Wraps & Graphics' },
    { label: 'Schedule appointment', body: 'Hi,\n\nWe would love to get you on the schedule! What days and times work best for you?\n\nThanks,\nFrederick Wraps & Graphics' },
    { label: 'Job complete', body: 'Hi,\n\nYour project is complete and ready for pickup! Please let us know when you would like to come by.\n\nThanks,\nFrederick Wraps & Graphics' },
    { label: 'Need more info', body: 'Hi,\n\nThanks for reaching out! To provide you with an accurate quote, could you send over the following:\n\n- \n\nThanks,\nFrederick Wraps & Graphics' },
  ]

  const useTemplate = (body: string) => {
    setCBody(body)
    setShowTemplates(false)
  }

  // Polish email draft with Claude
  const doPolish = async () => {
    if (!cBody.trim() || polishing) return
    setPolishing(true)
    try {
      // Build thread context from current detail messages
      const threadContext = detail?.messages?.map(m => ({
        from: m.from,
        body: m.body,
      })) || []

      const res = await fetch('/api/gmail/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: cBody,
          threadContext,
          subject: cSubj,
        }),
      })
      const data = await res.json()
      if (data.error) { alert('Polish failed: ' + data.error); return }
      if (data.polished) setCBody(data.polished)
    } catch (e: any) {
      alert('Polish failed: ' + e.message)
    } finally {
      setPolishing(false)
    }
  }

  // Auto-link document numbers in email body HTML
  const autoLinkDocs = (html: string) => {
    // Match patterns like #1234, Quote #1234, Invoice #1234, QUO-1234, INV-1234
    return html.replace(
      /(?:(?:quote|invoice|quo|inv)[\s#-]*)?#(\d{3,6})\b/gi,
      (match, num) => `<a href="/documents?search=${num}" target="_blank" style="color:#1a73e8;text-decoration:underline;cursor:pointer" title="View document #${num}">${match}</a>`
    )
  }

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQ(search)
    setSelThread(null)
    setDetail(null)
    // For search, fall back to the Gmail threads API
  }

  const openCompose = () => { setCTo('');setCCc('');setCSubj('');setCBody('');setCThreadId(undefined);setCReplyTo(undefined);setCRefs(undefined); setShowCompose(true);setShowReply(false);setSelThread(null);setDetail(null) }
  const openReply = () => {
    if(!detail) return; const m=detail.messages[detail.messages.length-1]; const s=parseAddr(m.from)
    setCTo(s.e);setCCc('');setCSubj(m.subject.startsWith('Re:')?m.subject:`Re: ${m.subject}`)
    setCBody('');setCThreadId(detail.id);setCReplyTo(m.messageId);setCRefs(m.references?`${m.references} ${m.messageId}`:m.messageId)
    setShowReply(true);setShowCompose(false)
  }
  const doSend = async () => {
    if(!cTo.trim()||!cSubj.trim()||!cBody.trim()) return; setSending(true)
    try {
      const r = await fetch('/api/gmail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:cTo,from:cFrom||undefined,subject:cSubj,body:cBody.replace(/\n/g,'<br>'),cc:cCc||undefined,threadId:cThreadId,inReplyTo:cReplyTo,references:cRefs})})
      const d = await r.json()
      if(d.error) alert('Failed: '+d.error); else {
        setShowCompose(false);setShowReply(false)
        if(cThreadId&&selThread)openThread(selThread)
        // Refresh buckets after send (the API already recomputed the bucket)
        buckets.refresh()
      }
    } catch(e:any){alert('Failed: '+e.message)} setSending(false)
  }

  const modify = async (id: string, add?: string[], rem?: string[]) => {
    await fetch(`/api/gmail/threads/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({addLabelIds:add,removeLabelIds:rem})})
  }

  const doArchiveBucket = async (gmailThreadId: string) => {
    // Archive via bucket system
    await buckets.toggleFlag(gmailThreadId, 'archived_flag', true)
    // Also remove INBOX label in Gmail
    await modify(gmailThreadId, undefined, ['INBOX'])
    if(selThread===gmailThreadId){setSelThread(null);setDetail(null)}
  }
  const doTrash = async (gmailThreadId: string) => {
    await modify(gmailThreadId,['TRASH'],['INBOX'])
    buckets.setThreads(p=>p.filter(t=>t.gmail_thread_id!==gmailThreadId))
    setSel(p=>{const n=new Set(p);n.delete(gmailThreadId);return n})
    if(selThread===gmailThreadId){setSelThread(null);setDetail(null)}
  }
  const doUnread = async (gmailThreadId: string) => {
    await modify(gmailThreadId,['UNREAD'])
    buckets.setThreads(p=>p.map(t=>t.gmail_thread_id===gmailThreadId?{...t,is_unread:true}:t))
    if(selThread===gmailThreadId){setSelThread(null);setDetail(null)}
    window.dispatchEvent(new Event('unread-counts-changed'))
  }

  const bulkArchive = async () => { await Promise.all(Array.from(sel).map(id=>doArchiveBucket(id))); setSel(new Set()) }
  const bulkTrash = async () => { await Promise.all(Array.from(sel).map(id=>doTrash(id))); setSel(new Set()) }
  const bulkUnread = async () => { await Promise.all(Array.from(sel).map(id=>doUnread(id))); setSel(new Set()) }

  const toggleSel = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSel(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n}) }
  const toggleAll = () => { sel.size===buckets.threads.length ? setSel(new Set()) : setSel(new Set(buckets.threads.map(t=>t.gmail_thread_id))) }
  const toggleMsg = (id: string) => setExpanded(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})

  const toggleWaitingOnTask = async (gmailThreadId: string, currentValue: boolean) => {
    await buckets.toggleFlag(gmailThreadId, 'waiting_on_task_flag', !currentValue)
    if(selThread===gmailThreadId){setSelThread(null);setDetail(null)}
  }

  const ib = (d: boolean) => ({ padding:'8px', background:'none', border:'none', color:'#5f6368', cursor:'pointer', display:'flex' as const, borderRadius:'50%', opacity:d?.5:1 })

  // Search mode: falls back to Gmail threads API
  const [searchThreads, setSearchThreads] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (!searchQ) { setSearchThreads([]); return }
    const doFetch = async () => {
      setSearchLoading(true)
      try {
        const p = new URLSearchParams({ maxResults: '50', q: searchQ })
        const r = await fetch(`/api/gmail/threads?${p}`)
        const d = await r.json()
        setSearchThreads(d.threads || [])
      } catch (e) { setSearchThreads([]) }
      setSearchLoading(false)
    }
    doFetch()
  }, [searchQ])

  const isSearchMode = !!searchQ

  // Current thread for WaitingOnTask check
  const currentCachedThread = selThread ? buckets.threads.find(t => t.gmail_thread_id === selThread) : null

  const renderList = () => {
    const displayThreads = isSearchMode ? searchThreads : buckets.threads
    const isLoading = isSearchMode ? searchLoading : buckets.loading

    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',overflow:'hidden'}}>
        {/* Toolbar */}
        <div style={{display:'flex',alignItems:'center',gap:'2px',padding:'4px 8px 4px 4px',borderBottom:'1px solid #e0e0e0',flexShrink:0,height:'44px'}}>
          <button onClick={toggleAll} style={{...ib(false),flexShrink:0}}><I d={sel.size>0&&sel.size===displayThreads.length?P.cbOn:P.cb} sz={18}/></button>
          {sel.size > 0 ? (
            <>
              <button onClick={bulkArchive} title="Archive" style={ib(false)}><I d={P.archive} sz={18}/></button>
              <button onClick={bulkTrash} title="Delete" style={ib(false)}><I d={P.trash} sz={18}/></button>
              <button onClick={bulkUnread} title="Mark unread" style={ib(false)}><I d={P.unreadOpen} sz={18}/></button>
            </>
          ) : (
            <button onClick={()=>{triggerSync('incremental')}} title={syncing?'Syncing...':'Refresh'} style={{...ib(syncing),animation:syncing?'spin 1s linear infinite':undefined}}><I d={P.refresh} sz={18}/></button>
          )}
          <div style={{flex:1}}/>
          {/* Sync indicator */}
          {syncing && <span style={{fontSize:'11px',color:'#1a73e8',marginRight:'8px'}}>Syncing...</span>}
          {lastSync && !syncing && <span style={{fontSize:'11px',color:'#5f6368',marginRight:'8px'}}>Updated {fmtDate(lastSync.toISOString())}</span>}
          {/* Pagination info */}
          {!isSearchMode && displayThreads.length > 0 && (
            <span style={{fontSize:'12px',color:'#5f6368',whiteSpace:'nowrap'}}>
              {displayThreads.length} of {buckets.total}
            </span>
          )}
        </div>

        {/* Follow-up tier sub-header */}
        {buckets.activeBucket === 'follow_up' && !isSearchMode && (
          <div style={{display:'flex',gap:'6px',padding:'8px 12px',borderBottom:'1px solid #f1f3f4',background:'#fafafa',flexWrap:'wrap'}}>
            <button
              onClick={() => buckets.switchBucket('follow_up', null)}
              style={{
                padding:'4px 10px',fontSize:'11px',borderRadius:'12px',cursor:'pointer',border:'1px solid',
                background: !buckets.activeFollowUpTier ? '#9334e6' : '#fff',
                color: !buckets.activeFollowUpTier ? '#fff' : '#5f6368',
                borderColor: !buckets.activeFollowUpTier ? '#9334e6' : '#dadce0',
                fontWeight: !buckets.activeFollowUpTier ? 600 : 400,
              }}
            >
              All ({buckets.counts.counts.follow_up || 0})
            </button>
            {(Object.keys(FOLLOW_UP_TIER_LABELS) as FollowUpTier[]).map(tier => {
              const count = buckets.counts.followUpTiers[tier] || 0
              const isActive = buckets.activeFollowUpTier === tier
              return (
                <button key={tier}
                  onClick={() => buckets.switchBucket('follow_up', tier)}
                  style={{
                    padding:'4px 10px',fontSize:'11px',borderRadius:'12px',cursor:'pointer',border:'1px solid',
                    background: isActive ? '#9334e6' : '#fff',
                    color: isActive ? '#fff' : '#5f6368',
                    borderColor: isActive ? '#9334e6' : '#dadce0',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {FOLLOW_UP_TIER_LABELS[tier]} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Thread rows */}
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',width:'100%'}}>
          {isLoading ? (
            <div style={{padding:'60px',textAlign:'center',color:'#5f6368',fontSize:'14px'}}>Loading...</div>
          ) : err ? (
            <div style={{padding:'40px',textAlign:'center',color:'#d93025',fontSize:'14px'}}>{err}</div>
          ) : displayThreads.length===0 ? (
            <div style={{padding:'80px',textAlign:'center',color:'#5f6368',fontSize:'14px'}}>
              {isSearchMode ? 'No results' : `No emails in ${BUCKET_LABELS[buckets.activeBucket]}`}
            </div>
          ) : displayThreads.map(t => {
            // Normalize: support both CachedThread (bucket) and ThreadSummary (search)
            const isCached = 'gmail_thread_id' in t
            const threadId = isCached ? (t as CachedThread).gmail_thread_id : (t as any).id
            const from = isCached ? (t as CachedThread).last_message_from : (t as any).from
            const subject = t.subject || '(no subject)'
            const snippet = t.snippet || ''
            const isUnread = isCached ? (t as CachedThread).is_unread : (t as any).isUnread
            const hasAttachments = isCached ? (t as CachedThread).has_attachments : (t as any).hasAttachments
            const messageCount = isCached ? (t as CachedThread).message_count : (t as any).messageCount
            const date = isCached ? (t as CachedThread).last_message_date : (t as any).date
            const waitingOnTask = isCached ? (t as CachedThread).waiting_on_task_flag : false

            const s = parseAddr(from)
            const hov = hovRow===threadId
            const isSel = sel.has(threadId)

            return (
              <div key={threadId}
                onMouseEnter={()=>setHovRow(threadId)} onMouseLeave={()=>setHovRow(null)}
                onClick={()=>openThread(threadId)}
                style={{
                  display:'flex', alignItems:'center', height:'32px',
                  cursor:'pointer', borderBottom:'1px solid #f1f3f4',
                  background: isSel ? '#c2dbff' : hov ? '#f2f6fc' : isUnread ? '#f2f6fc' : '#fff',
                  fontSize:'12px', width:'100%', overflow:'hidden',
                }}>
                {/* Checkbox */}
                <div onClick={e=>toggleSel(threadId,e)} style={{width:'28px',display:'flex',justifyContent:'center',flexShrink:0,color:'#5f6368'}}>
                  <I d={isSel?P.cbOn:P.cb} sz={16}/>
                </div>
                {/* Waiting on task indicator */}
                {waitingOnTask && (
                  <div style={{width:'20px',display:'flex',justifyContent:'center',flexShrink:0,color:'#e37400'}} title="Waiting on task">
                    <I d={P.flag} sz={14} c="#e37400"/>
                  </div>
                )}
                {/* Sender */}
                <div style={{width:'140px',flexShrink:0,paddingRight:'8px',fontWeight:isUnread?700:400,color:isUnread?'#202124':'#5f6368',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {s.n}
                </div>
                {/* Content: subject + snippet */}
                <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:'3px',overflow:'hidden'}}>
                  <span style={{fontWeight:isUnread?700:400,color:'#202124',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flexShrink:1,minWidth:0}}>
                    {subject}
                  </span>
                  {messageCount>1 && <span style={{color:'#5f6368',flexShrink:0}}>({messageCount})</span>}
                  <span style={{color:'#5f6368',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1,minWidth:0}}>
                    &nbsp;- {snippet}
                  </span>
                </div>
                {/* Right: hover actions or date */}
                <div style={{width:'110px',flexShrink:0,display:'flex',justifyContent:'flex-end',alignItems:'center',paddingRight:'8px'}}>
                  {hov ? (
                    <div style={{display:'flex',gap:0}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>toggleWaitingOnTask(threadId, waitingOnTask)} title={waitingOnTask ? 'Remove "Waiting on Task"' : 'Flag as "Waiting on Task"'} style={{padding:'4px',background:'none',border:'none',color:waitingOnTask?'#e37400':'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={waitingOnTask?P.flag:P.flagOff} sz={16} c={waitingOnTask?'#e37400':undefined}/></button>
                      <button onClick={()=>doArchiveBucket(threadId)} title="Archive" style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.archive} sz={16}/></button>
                      <button onClick={()=>doTrash(threadId)} title="Delete" style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.trash} sz={16}/></button>
                      <button onClick={()=>doUnread(threadId)} title="Mark unread" style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.unreadOpen} sz={16}/></button>
                    </div>
                  ) : (
                    <>
                      {hasAttachments && <span style={{color:'#5f6368',marginRight:'4px',display:'flex'}}><I d={P.attach} sz={14}/></span>}
                      <span style={{fontWeight:isUnread?700:400,color:isUnread?'#202124':'#5f6368',whiteSpace:'nowrap'}}>{fmtDate(date)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderDetail = () => {
    if(!detail) return null
    const isWaitingOnTask = currentCachedThread?.waiting_on_task_flag || false
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:'2px',padding:'4px 8px',borderBottom:'1px solid #e0e0e0',flexShrink:0,height:'44px'}}>
          <button onClick={()=>{setSelThread(null);setDetail(null);setShowReply(false)}} style={ib(false)} title="Back"><I d={P.back} sz={18}/></button>
          <button onClick={()=>doArchiveBucket(detail.id)} style={ib(false)} title="Archive"><I d={P.archive} sz={18}/></button>
          <button onClick={()=>doTrash(detail.id)} style={ib(false)} title="Delete"><I d={P.trash} sz={18}/></button>
          <button onClick={()=>doUnread(detail.id)} style={ib(false)} title="Mark unread"><I d={P.unreadMark} sz={18}/></button>
          <div style={{width:'1px',height:'20px',background:'#dadce0',margin:'0 4px'}}/>
          {/* Waiting on Task toggle */}
          <button
            onClick={()=>toggleWaitingOnTask(detail.id, isWaitingOnTask)}
            title={isWaitingOnTask ? 'Remove "Waiting on Task"' : 'Mark as "Waiting on Task"'}
            style={{
              ...ib(false),
              color: isWaitingOnTask ? '#e37400' : '#5f6368',
              background: isWaitingOnTask ? '#fef3c7' : 'none',
            }}
          >
            <I d={isWaitingOnTask ? P.flag : P.flagOff} sz={18} c={isWaitingOnTask ? '#e37400' : '#5f6368'}/>
          </button>
          <span style={{fontSize:'11px',color:isWaitingOnTask?'#e37400':'#5f6368',cursor:'pointer',userSelect:'none'}} onClick={()=>toggleWaitingOnTask(detail.id, isWaitingOnTask)}>
            {isWaitingOnTask ? 'Waiting on us' : 'Flag as waiting'}
          </span>
          <div style={{flex:1}}/>
          <span style={{color:'#5f6368',fontSize:'12px',paddingRight:'8px'}}>{detail.messages.length} message{detail.messages.length!==1?'s':''}</span>
        </div>
        <div style={{padding:'12px 56px 4px',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',flexShrink:0}}>
          <h1 style={{color:'#202124',fontSize:'20px',fontWeight:400,margin:0}}>{detail.subject}</h1>
        </div>
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Thread messages */}
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',minWidth:0}}>
          {detail.messages.map((msg,idx)=>{
            const s=parseAddr(msg.from), rcpt=parseAddr(msg.to), isExp=expanded.has(msg.id), isFWG=s.e.includes('frederickwraps'), isHov=hovMsg===msg.id
            if(!isExp) return (
              <div key={msg.id} onMouseEnter={()=>setHovMsg(msg.id)} onMouseLeave={()=>setHovMsg(null)}
                onClick={()=>toggleMsg(msg.id)}
                style={{display:'flex',alignItems:'center',gap:'12px',padding:'8px 16px 8px 56px',cursor:'pointer',borderBottom:'1px solid #f1f3f4',background:isHov?'#f5f5f5':'#fff'}}>
                <div style={{width:'32px',height:'32px',borderRadius:'50%',background:isFWG?'#d71cd1':'#1a73e8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:600,flexShrink:0}}>{initials(s.n)}</div>
                <span style={{fontWeight:600,color:'#202124',fontSize:'13px',width:'140px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.n}</span>
                <span style={{color:'#5f6368',fontSize:'13px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{msg.body?.replace(/<[^>]*>/g,'').substring(0,120)}</span>
                {msg.attachments.length>0&&<span style={{color:'#5f6368',flexShrink:0,display:'flex'}}><I d={P.attach} sz={14}/></span>}
                <span style={{color:'#5f6368',fontSize:'11px',flexShrink:0}}>{fmtFull(msg.date)}</span>
              </div>
            )
            return (
              <div key={msg.id} style={{borderBottom:'1px solid #e0e0e0',background:'#fff'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'14px 16px 10px 56px'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'50%',background:isFWG?'#d71cd1':'#1a73e8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:600,flexShrink:0}}>{initials(s.n)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div><span style={{fontWeight:600,color:'#202124',fontSize:'13px'}}>{s.n}</span><span style={{color:'#5f6368',fontSize:'11px',marginLeft:'6px'}}>&lt;{s.e}&gt;</span></div>
                      <div style={{display:'flex',alignItems:'center',gap:'4px',flexShrink:0}}>
                        <span style={{color:'#5f6368',fontSize:'11px'}}>{fmtFull(msg.date)}</span>
                        <button onClick={e=>{e.stopPropagation();toggleMsg(msg.id)}} style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.collapse} sz={16}/></button>
                      </div>
                    </div>
                    <div style={{color:'#5f6368',fontSize:'11px',marginTop:'1px'}}>to {rcpt.n||rcpt.e}{msg.cc&&<span>, cc: {msg.cc}</span>}</div>
                  </div>
                </div>
                <div style={{padding:'0 16px 16px 100px',color:'#202124',fontSize:'13px',lineHeight:'1.5',overflowWrap:'break-word',wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:autoLinkDocs(msg.body)}}/>
                {msg.attachments.length>0&&(
                  <div style={{padding:'0 16px 14px 100px'}}>
                    <div style={{fontSize:'11px',color:'#5f6368',marginBottom:'6px'}}>{msg.attachments.length} attachment{msg.attachments.length!==1?'s':''}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                      {msg.attachments.map((att,i)=>{
                        const isImg=att.mimeType.startsWith('image/'), url=`/api/gmail/attachment/${msg.id}?attachmentId=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`
                        return (
                          <div key={i} onClick={e=>{e.stopPropagation();isImg?setLightbox(url):window.open(url,'_blank')}}
                            style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',background:'#f8f9fa',borderRadius:'8px',cursor:'pointer',border:'1px solid #e0e0e0',maxWidth:'200px'}}>
                            {isImg?(
                              <div style={{width:'32px',height:'32px',borderRadius:'4px',overflow:'hidden',flexShrink:0}}><img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
                            ):(
                              <div style={{width:'32px',height:'32px',borderRadius:'4px',background:'#1a73e8',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'9px',fontWeight:700,flexShrink:0}}>{att.filename.split('.').pop()?.toUpperCase().slice(0,4)}</div>
                            )}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{color:'#202124',fontSize:'12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{att.filename}</div>
                              <div style={{color:'#5f6368',fontSize:'10px'}}>{fmtSz(att.size)}</div>
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
          <div ref={endRef}/>
          <div style={{padding:'14px 16px 20px 100px'}}>
            {showReply?(
              <div style={{border:'1px solid #dadce0',borderRadius:'10px',overflow:'hidden'}}>
                <div style={{padding:'10px 14px',borderBottom:'1px solid #e0e0e0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{color:'#202124',fontSize:'13px'}}>Reply to {cTo}</span>
                  <button onClick={()=>setShowReply(false)} style={{background:'none',border:'none',color:'#5f6368',cursor:'pointer',fontSize:'14px'}}>x</button>
                </div>
                <div style={{padding:'10px 14px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                    <label style={{color:'#5f6368',fontSize:'12px'}}>From</label>
                    <select value={cFrom} onChange={e=>setCFrom(e.target.value)} style={{flex:1,padding:'6px 8px',border:'1px solid #dadce0',borderRadius:'4px',color:'#202124',fontSize:'12px',background:'#fff'}}>
                      {aliases.map(a=><option key={a.email} value={a.email}>{a.displayName?`${a.displayName} <${a.email}>`:a.email}</option>)}
                    </select>
                  </div>
                  {/* Quick-reply templates */}
                  <div style={{marginBottom:'8px'}}>
                    <button onClick={()=>setShowTemplates(!showTemplates)} style={{padding:'3px 10px',background:'none',border:'1px solid #dadce0',borderRadius:'12px',color:'#1a73e8',cursor:'pointer',fontSize:'11px',display:'flex',alignItems:'center',gap:'4px'}}>
                      <I d={P.draft} sz={12} c="#1a73e8"/> {showTemplates ? 'Hide templates' : 'Quick replies'}
                    </button>
                    {showTemplates && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'6px'}}>
                        {QUICK_REPLIES.map((t,i) => (
                          <button key={i} onClick={()=>useTemplate(t.body)}
                            style={{padding:'4px 10px',background:'#f0f4f9',border:'1px solid #d3e3fd',borderRadius:'12px',color:'#1a73e8',cursor:'pointer',fontSize:'11px',fontWeight:500}}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea value={cBody} onChange={e=>setCBody(e.target.value)} placeholder="Write your reply..." autoFocus
                    style={{width:'100%',minHeight:'100px',padding:'8px',border:'1px solid #dadce0',borderRadius:'4px',color:'#202124',fontSize:'13px',lineHeight:'1.5',resize:'vertical',background:'#fff',boxSizing:'border-box'}}/>
                  <div style={{display:'flex',justifyContent:'flex-end',marginTop:'10px',gap:'8px'}}>
                    <button onClick={doPolish} disabled={polishing||!cBody.trim()} style={{padding:'8px 16px',background:polishing?'#e8d5f5':'#f3e8ff',border:'1px solid #d4b8e8',borderRadius:'18px',color:'#7c3aed',fontSize:'13px',fontWeight:600,cursor:polishing||!cBody.trim()?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px',opacity:!cBody.trim()?0.5:1}}>
                      {polishing ? 'Polishing...' : 'Polish'}
                    </button>
                    <button onClick={doSend} disabled={sending||!cBody.trim()} style={{padding:'8px 20px',background:sending||!cBody.trim()?'#ccc':'#0b57d0',border:'none',borderRadius:'18px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:sending?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                      <I d={P.send} sz={14}/> {sending?'Sending...':'Send'}
                    </button>
                  </div>
                </div>
              </div>
            ):(
              <button onClick={openReply} style={{padding:'8px 20px',border:'1px solid #dadce0',borderRadius:'18px',background:'#fff',color:'#202124',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                <I d={P.reply} sz={16}/> Reply
              </button>
            )}
          </div>
        </div>

        {/* Customer Context Sidebar */}
        {customerContext && (customerContext.customer || customerContextLoading) && (
          <div style={{width:'260px',flexShrink:0,borderLeft:'1px solid #e0e0e0',background:'#fafbfc',overflowY:'auto',overflowX:'hidden'}}>
            {customerContextLoading ? (
              <div style={{padding:'20px',textAlign:'center',color:'#5f6368',fontSize:'12px'}}>Loading...</div>
            ) : customerContext.customer ? (
              <div style={{padding:'12px'}}>
                {/* Customer header */}
                <div style={{marginBottom:'12px'}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'#202124',marginBottom:'2px'}}>
                    {customerContext.customer.display_name || `${customerContext.customer.first_name || ''} ${customerContext.customer.last_name || ''}`.trim() || 'Unknown'}
                  </div>
                  {customerContext.customer.company && (
                    <div style={{fontSize:'11px',color:'#5f6368'}}>{customerContext.customer.company}</div>
                  )}
                  {customerContext.customer.phone && (
                    <div style={{fontSize:'11px',color:'#5f6368',marginTop:'2px'}}>{customerContext.customer.phone}</div>
                  )}
                  {customerContext.customer.lifetime_value > 0 && (
                    <div style={{fontSize:'11px',color:'#188038',fontWeight:600,marginTop:'4px'}}>
                      Lifetime: ${Number(customerContext.customer.lifetime_value).toLocaleString()}
                    </div>
                  )}
                  <a href={`/customers/${customerContext.customer.id}`} target="_blank" rel="noreferrer"
                    style={{fontSize:'10px',color:'#1a73e8',textDecoration:'none',display:'inline-block',marginTop:'4px'}}>
                    View full profile
                  </a>
                </div>

                {/* Documents */}
                {customerContext.documents?.length > 0 && (
                  <div style={{marginBottom:'12px'}}>
                    <div style={{fontSize:'10px',fontWeight:600,color:'#5f6368',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Documents</div>
                    {customerContext.documents.slice(0, 8).map((doc: any) => {
                      const isQuote = doc.doc_type === 'quote'
                      const statusColors: Record<string, string> = {
                        draft: '#5f6368', sent: '#1a73e8', viewed: '#9334e6', approved: '#188038',
                        paid: '#188038', partial: '#e37400', revision_requested: '#d93025',
                        ach_pending: '#e37400', archived: '#5f6368',
                      }
                      return (
                        <a key={doc.id} href={`/documents/${doc.id}`} target="_blank" rel="noreferrer"
                          style={{display:'block',padding:'6px 8px',marginBottom:'3px',background:'#fff',borderRadius:'6px',border:'1px solid #e8eaed',textDecoration:'none',cursor:'pointer'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <span style={{fontSize:'11px',fontWeight:600,color:'#202124'}}>
                              {isQuote ? 'Q' : 'INV'}-{doc.doc_number}
                            </span>
                            <span style={{fontSize:'9px',padding:'1px 5px',borderRadius:'8px',background:`${statusColors[doc.status] || '#5f6368'}18`,color:statusColors[doc.status] || '#5f6368',fontWeight:600,textTransform:'uppercase'}}>
                              {doc.status}
                            </span>
                          </div>
                          <div style={{fontSize:'10px',color:'#5f6368',marginTop:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {doc.project_description || doc.vehicle_description || doc.category || ''}
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginTop:'2px',fontSize:'10px'}}>
                            <span style={{color:'#202124',fontWeight:500}}>${Number(doc.total || 0).toLocaleString()}</span>
                            {doc.balance_due > 0 && <span style={{color:'#d93025'}}>Due: ${Number(doc.balance_due).toLocaleString()}</span>}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                )}

                {/* Recent payments */}
                {customerContext.recentPayments?.length > 0 && (
                  <div>
                    <div style={{fontSize:'10px',fontWeight:600,color:'#5f6368',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Recent Payments</div>
                    {customerContext.recentPayments.slice(0, 5).map((pmt: any) => (
                      <div key={pmt.id} style={{padding:'4px 8px',marginBottom:'2px',fontSize:'11px'}}>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <span style={{color:'#188038',fontWeight:600}}>${Number(pmt.amount).toLocaleString()}</span>
                          <span style={{color:'#5f6368',fontSize:'10px'}}>{fmtDate(pmt.created_at)}</span>
                        </div>
                        <div style={{color:'#5f6368',fontSize:'10px'}}>{pmt.payment_method}</div>
                      </div>
                    ))}
                  </div>
                )}

                {customerContext.documents?.length === 0 && customerContext.recentPayments?.length === 0 && (
                  <div style={{fontSize:'11px',color:'#5f6368',fontStyle:'italic'}}>No documents or payments found</div>
                )}
              </div>
            ) : null}
          </div>
        )}
        </div>
      </div>
    )
  }

  const renderCompose = () => (
    <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',overflow:'hidden'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #e0e0e0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <h2 style={{color:'#202124',fontSize:'16px',fontWeight:400,margin:0}}>New Message</h2>
        <button onClick={()=>setShowCompose(false)} style={{background:'none',border:'none',color:'#5f6368',cursor:'pointer',fontSize:'16px'}}>x</button>
      </div>
      {[{l:'From',t:'select',v:cFrom,f:setCFrom},{l:'To',v:cTo,f:setCTo,p:'Recipients'},{l:'Cc',v:cCc,f:setCCc},{l:'Subject',v:cSubj,f:setCSubj}].map((x,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',borderBottom:'1px solid #e0e0e0',padding:'8px 16px'}}>
          <label style={{color:'#5f6368',fontSize:'13px',width:'44px'}}>{x.l}</label>
          {x.t==='select'?(
            <select value={x.v} onChange={e=>x.f(e.target.value)} style={{flex:1,padding:'4px 0',background:'transparent',border:'none',color:'#202124',fontSize:'13px',outline:'none'}}>
              {aliases.map(a=><option key={a.email} value={a.email}>{a.displayName?`${a.displayName} <${a.email}>`:a.email}</option>)}
            </select>
          ):(
            <input type="text" value={x.v} onChange={e=>x.f(e.target.value)} placeholder={x.p||''} style={{flex:1,padding:'4px 0',background:'transparent',border:'none',color:'#202124',fontSize:'13px',outline:'none'}}/>
          )}
        </div>
      ))}
      <textarea value={cBody} onChange={e=>setCBody(e.target.value)} style={{flex:1,padding:'14px 16px',color:'#202124',fontSize:'13px',lineHeight:'1.5',border:'none',outline:'none',resize:'none',background:'transparent'}}/>
      <div style={{padding:'10px 16px',borderTop:'1px solid #e0e0e0',display:'flex',justifyContent:'flex-end',gap:'8px'}}>
        <button onClick={doPolish} disabled={polishing||!cBody.trim()} style={{padding:'8px 16px',background:polishing?'#e8d5f5':'#f3e8ff',border:'1px solid #d4b8e8',borderRadius:'18px',color:'#7c3aed',fontSize:'13px',fontWeight:600,cursor:polishing||!cBody.trim()?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px',opacity:!cBody.trim()?0.5:1}}>
          {polishing ? 'Polishing...' : 'Polish'}
        </button>
        <button onClick={doSend} disabled={sending||!cTo.trim()||!cSubj.trim()||!cBody.trim()} style={{padding:'8px 20px',background:sending||!cTo.trim()||!cSubj.trim()||!cBody.trim()?'#ccc':'#0b57d0',border:'none',borderRadius:'18px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:sending?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
          <I d={P.send} sz={14}/> {sending?'Sending...':'Send'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'Google Sans,Roboto,-apple-system,sans-serif',height:'calc(100vh - 90px)',display:'flex',flexDirection:'column',borderRadius:'16px',overflow:'hidden',border:'1px solid #e0e0e0',width:'100%',maxWidth:'100%',boxSizing:'border-box'}}>
      {/* Search bar */}
      <div style={{display:'flex',alignItems:'center',padding:'6px 12px',background:'#f6f8fc',borderBottom:'1px solid #e0e0e0',flexShrink:0,gap:'12px'}}>
        <form onSubmit={doSearch} style={{flex:1,position:'relative',maxWidth:'720px'}}>
          <div style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'#5f6368',display:'flex'}}><I d={P.search} sz={18}/></div>
          <input type="text" placeholder="Search mail" value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'8px 12px 8px 38px',background:'#eaf1fb',border:'1px solid transparent',borderRadius:'24px',color:'#202124',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
        </form>
        {isSearchMode && (
          <button onClick={()=>{setSearchQ('');setSearch('')}} style={{padding:'4px 12px',background:'none',border:'1px solid #dadce0',borderRadius:'16px',color:'#5f6368',cursor:'pointer',fontSize:'12px'}}>
            Clear search
          </button>
        )}
      </div>

      {/* Body: sidebar + main */}
      <div className="email-layout" style={{flex:1,display:'flex',overflow:'hidden',width:'100%'}}>
        {/* Bucket Sidebar */}
        <div className="email-sidebar" style={{width:'220px',background:'#f6f8fc',borderRight:'1px solid #e0e0e0',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'10px 10px 6px'}}>
            <button onClick={openCompose} style={{width:'100%',padding:'10px 16px',background:'#c2e7ff',border:'none',borderRadius:'14px',color:'#001d35',fontSize:'13px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',boxShadow:'0 1px 2px rgba(0,0,0,0.06)'}}>
              <I d={P.compose} sz={16}/> Compose
            </button>
          </div>
          <nav style={{flex:1,overflowY:'auto',overflowX:'hidden',paddingTop:'2px'}}>
            {(Object.keys(BUCKET_LABELS) as Bucket[]).map(bucket => {
              const isActive = buckets.activeBucket === bucket && !isSearchMode
              const count = buckets.counts.counts[bucket] || 0
              const color = BUCKET_COLORS[bucket]
              const isFollowUp = bucket === 'follow_up'

              return (
                <div key={bucket}>
                  <button
                    onClick={() => {
                      buckets.switchBucket(bucket)
                      setSelThread(null); setDetail(null); setSearchQ(''); setSearch(''); setShowCompose(false); setSel(new Set())
                      if (isFollowUp) setFollowUpExpanded(!followUpExpanded)
                    }}
                    style={{
                      display:'flex',alignItems:'center',gap:'10px',padding:'6px 14px',margin:'1px 6px',borderRadius:'16px',cursor:'pointer',
                      background:isActive?'#d3e3fd':'transparent',color:isActive?'#001d35':'#444746',fontSize:'13px',fontWeight:isActive?700:400,
                      border:'none',width:'calc(100% - 12px)',textAlign:'left',overflow:'hidden',
                    }}
                  >
                    <span style={{display:'flex',flexShrink:0}}><I d={BUCKET_ICONS[bucket]} sz={18}/></span>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{BUCKET_LABELS[bucket]}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize:'11px',fontWeight:600,color:bucket==='need_to_respond'?'#fff':color,
                        background:bucket==='need_to_respond'?color:'transparent',
                        padding:bucket==='need_to_respond'?'1px 6px':'0',borderRadius:'8px',flexShrink:0,
                      }}>
                        {count}
                      </span>
                    )}
                    {isFollowUp && count > 0 && (
                      <span style={{display:'flex',flexShrink:0,color:'#5f6368'}}>
                        <I d={followUpExpanded ? P.collapse : P.expand} sz={16}/>
                      </span>
                    )}
                  </button>

                  {/* Follow-up tier breakdown */}
                  {isFollowUp && followUpExpanded && (
                    <div style={{paddingLeft:'20px'}}>
                      {(Object.keys(FOLLOW_UP_TIER_LABELS) as FollowUpTier[]).map(tier => {
                        const tierCount = buckets.counts.followUpTiers[tier] || 0
                        if (tierCount === 0) return null
                        const isTierActive = isActive && buckets.activeFollowUpTier === tier
                        return (
                          <button key={tier}
                            onClick={(e) => {
                              e.stopPropagation()
                              buckets.switchBucket('follow_up', tier)
                              setSelThread(null); setDetail(null); setSel(new Set())
                            }}
                            style={{
                              display:'flex',alignItems:'center',gap:'8px',padding:'3px 14px',margin:'0 6px',borderRadius:'12px',cursor:'pointer',
                              background:isTierActive?'#e8d5f5':'transparent',color:isTierActive?'#7627bb':'#5f6368',fontSize:'11px',fontWeight:isTierActive?600:400,
                              border:'none',width:'calc(100% - 12px)',textAlign:'left',
                            }}
                          >
                            <span style={{flex:1}}>{FOLLOW_UP_TIER_LABELS[tier]}</span>
                            <span style={{fontSize:'10px',color:'#9334e6'}}>{tierCount}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Sync status at bottom of sidebar */}
          <div style={{padding:'8px 14px',borderTop:'1px solid #e0e0e0',fontSize:'10px',color:'#5f6368'}}>
            {syncing ? 'Syncing with Gmail...' : lastSync ? `Last sync: ${fmtDate(lastSync.toISOString())}` : 'Not synced yet'}
            <button onClick={()=>triggerSync('full')} disabled={syncing}
              style={{marginLeft:'6px',background:'none',border:'none',color:'#1a73e8',cursor:syncing?'not-allowed':'pointer',fontSize:'10px',textDecoration:'underline',padding:0}}>
              {syncing ? '...' : 'Full sync'}
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,background:'#fff',display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,width:0}}>
          {showCompose ? renderCompose() :
           selThread&&detail ? renderDetail() :
           loadingDetail ? <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#5f6368',fontSize:'13px'}}>Loading...</div> :
           renderList()}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',zIndex:2000,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',justifyContent:'flex-end',padding:'14px 20px',gap:'10px'}}>
            <a href={lightbox} download onClick={e=>e.stopPropagation()} style={{padding:'6px 16px',background:'rgba(255,255,255,0.15)',borderRadius:'16px',color:'#fff',textDecoration:'none',fontSize:'13px'}}>Download</a>
            <button onClick={()=>setLightbox(null)} style={{padding:'6px 14px',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'16px',color:'#fff',cursor:'pointer',fontSize:'14px'}}>Close</button>
          </div>
          <div onClick={e=>e.stopPropagation()} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
            <img src={lightbox} alt="" style={{maxWidth:'90vw',maxHeight:'80vh',borderRadius:'8px',objectFit:'contain'}}/>
          </div>
        </div>
      )}
    </div>
  )
}
