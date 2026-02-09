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

type ThreadDetail = { id: string; messages: EmailMessage[]; subject: string }
type Alias = { email: string; displayName: string; isPrimary: boolean; isDefault: boolean }
type GmailLabel = { id: string; name: string; type: string; color: string | null; textColor: string | null }

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
  label: 'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  chevLeft: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  chevRight: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  collapse: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  attach: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  cb: 'M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  cbOn: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
}

const SYS = new Set(['INBOX','SENT','DRAFT','STARRED','IMPORTANT','SPAM','TRASH','UNREAD','CATEGORY_PERSONAL','CATEGORY_SOCIAL','CATEGORY_PROMOTIONS','CATEGORY_UPDATES','CATEGORY_FORUMS'])

const parseAddr = (r: string) => { const m = r.match(/^(.+?)\s*<(.+?)>$/); return m ? { n: m[1].replace(/"/g,'').trim(), e: m[2] } : { n: r.split('@')[0], e: r } }
const initials = (n: string) => { const p = n.split(' ').filter(x => x && !x.includes('@')); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : p.length ? p[0].substring(0,2).toUpperCase() : '??' }
const fmtDate = (d: string) => { const dt = new Date(d), now = new Date(), diff = Math.floor((now.getTime()-dt.getTime())/864e5); if (!diff && dt.getDate()===now.getDate()) return dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); if (diff<7) return dt.toLocaleDateString([],{month:'short',day:'numeric'}); return dt.getFullYear()===now.getFullYear() ? dt.toLocaleDateString([],{month:'short',day:'numeric'}) : dt.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) }
const fmtFull = (d: string) => { const dt = new Date(d); return dt.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'})+', '+dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) }
const fmtSz = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`

export default function EmailInbox() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [selThread, setSelThread] = useState<string|null>(null)
  const [detail, setDetail] = useState<ThreadDetail|null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [label, setLabel] = useState('INBOX')
  const [pageTokens, setPageTokens] = useState<string[]>([]) // stack of tokens for prev
  const [nextToken, setNextToken] = useState<string|null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEstimate, setTotalEstimate] = useState(0)
  const [aliases, setAliases] = useState<Alias[]>([])
  const [labelMap, setLabelMap] = useState<Record<string,GmailLabel>>({})
  const [allLabels, setAllLabels] = useState<GmailLabel[]>([])
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
  const endRef = useRef<HTMLDivElement>(null)
  const PER_PAGE = 50

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/gmail/aliases'); const d = await r.json(); if(d.aliases){setAliases(d.aliases); const p=d.aliases.find((a:Alias)=>a.isPrimary); if(p)setCFrom(p.email)} } catch(e){}
    })()
    ;(async () => {
      try { const r = await fetch('/api/gmail/labels'); const d = await r.json(); if(d.labels){ const m:Record<string,GmailLabel>={}; const u:GmailLabel[]=[]; d.labels.forEach((l:GmailLabel)=>{m[l.id]=l; if(l.type==='user')u.push(l)}); setLabelMap(m); setAllLabels(u.sort((a,b)=>a.name.localeCompare(b.name))) } } catch(e){}
    })()
  }, [])

  const loadThreads = useCallback(async (pageToken?: string) => {
    setLoading(true); setErr(null)
    try {
      const p = new URLSearchParams({ maxResults: String(PER_PAGE) })
      if (label) p.set('label', label)
      if (pageToken) p.set('pageToken', pageToken)
      if (searchQ) p.set('q', searchQ)
      const r = await fetch(`/api/gmail/threads?${p}`)
      const d = await r.json()
      if (d.error) { setErr(d.error); setLoading(false); return }
      setThreads(d.threads || [])
      setNextToken(d.nextPageToken || null)
      if (d.resultSizeEstimate) setTotalEstimate(d.resultSizeEstimate)
      setSel(new Set())
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [label, searchQ])

  useEffect(() => { setCurrentPage(1); setPageTokens([]); loadThreads() }, [loadThreads])

  const goNext = () => {
    if (!nextToken) return
    setPageTokens(prev => [...prev, nextToken!])
    setCurrentPage(prev => prev + 1)
    loadThreads(nextToken)
  }
  const goPrev = () => {
    if (pageTokens.length < 2) { setPageTokens([]); setCurrentPage(1); loadThreads(); return }
    const newTokens = [...pageTokens]
    newTokens.pop()
    const prevToken = newTokens[newTokens.length - 1]
    setPageTokens(newTokens)
    setCurrentPage(prev => prev - 1)
    loadThreads(prevToken)
  }

  const openThread = async (id: string) => {
    setSelThread(id); setLoadingDetail(true); setShowReply(false); setShowCompose(false)
    try {
      const r = await fetch(`/api/gmail/threads/${id}`); const d = await r.json()
      if (d.error) { setErr(d.error); setLoadingDetail(false); return }
      setDetail(d)
      if (d.messages?.length) setExpanded(new Set([d.messages[d.messages.length-1].id]))
      setThreads(prev => prev.map(t => t.id === id ? {...t, isUnread: false} : t))
      window.dispatchEvent(new Event('unread-counts-changed'))
    } catch(e:any) { setErr(e.message) }
    setLoadingDetail(false)
  }

  useEffect(() => { if(detail) setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),100) }, [detail])

  const doSearch = (e: React.FormEvent) => { e.preventDefault(); setSearchQ(search); setSelThread(null); setDetail(null) }

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
      if(d.error) alert('Failed: '+d.error); else { setShowCompose(false);setShowReply(false); if(cThreadId&&selThread)openThread(selThread); loadThreads() }
    } catch(e:any){alert('Failed: '+e.message)} setSending(false)
  }

  const modify = async (id: string, add?: string[], rem?: string[]) => {
    await fetch(`/api/gmail/threads/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({addLabelIds:add,removeLabelIds:rem})})
  }
  const doArchive = async (id: string) => { await modify(id,undefined,['INBOX']); setThreads(p=>p.filter(t=>t.id!==id)); setSel(p=>{const n=new Set(p);n.delete(id);return n}); if(selThread===id){setSelThread(null);setDetail(null)} }
  const doTrash = async (id: string) => { await modify(id,['TRASH'],['INBOX']); setThreads(p=>p.filter(t=>t.id!==id)); setSel(p=>{const n=new Set(p);n.delete(id);return n}); if(selThread===id){setSelThread(null);setDetail(null)} }
  const doUnread = async (id: string) => { await modify(id,['UNREAD']); setThreads(p=>p.map(t=>t.id===id?{...t,isUnread:true}:t)); if(selThread===id){setSelThread(null);setDetail(null)}; window.dispatchEvent(new Event('unread-counts-changed')) }
  const doStar = async (id: string, starred: boolean) => {
    if(starred) await modify(id,undefined,['STARRED']); else await modify(id,['STARRED'])
    setThreads(p=>p.map(t=>t.id===id?{...t,labelIds:starred?t.labelIds.filter(l=>l!=='STARRED'):[...t.labelIds,'STARRED']}:t))
  }
  const bulkArchive = async () => { await Promise.all(Array.from(sel).map(id=>modify(id,undefined,['INBOX']))); setThreads(p=>p.filter(t=>!sel.has(t.id))); setSel(new Set()) }
  const bulkTrash = async () => { await Promise.all(Array.from(sel).map(id=>modify(id,['TRASH'],['INBOX']))); setThreads(p=>p.filter(t=>!sel.has(t.id))); setSel(new Set()) }
  const bulkUnread = async () => { await Promise.all(Array.from(sel).map(id=>modify(id,['UNREAD']))); setThreads(p=>p.map(t=>sel.has(t.id)?{...t,isUnread:true}:t)); setSel(new Set()); window.dispatchEvent(new Event('unread-counts-changed')) }

  const toggleSel = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSel(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n}) }
  const toggleAll = () => { sel.size===threads.length ? setSel(new Set()) : setSel(new Set(threads.map(t=>t.id))) }
  const toggleMsg = (id: string) => setExpanded(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  const resLabel = (id: string) => labelMap[id]?.name || id

  const navItems = [
    {k:'INBOX',l:'Inbox',i:P.inbox},{k:'SENT',l:'Sent',i:P.send},{k:'STARRED',l:'Starred',i:P.starOff},{k:'DRAFT',l:'Drafts',i:P.draft},{k:'TRASH',l:'Trash',i:P.trash},{k:'',l:'All Mail',i:P.draft},
  ]

  const startIdx = (currentPage - 1) * PER_PAGE + 1
  const endIdx = startIdx + threads.length - 1

  // ─── CSS-in-JS with proper table layout ────────────────
  // Using CSS custom property trick: we set table-layout fixed equivalent via width:100% + overflow:hidden at every level

  const ib = (d: boolean) => ({ padding:'8px', background:'none', border:'none', color:'#5f6368', cursor:'pointer', display:'flex' as const, borderRadius:'50%', opacity:d?.5:1 })

  const renderList = () => (
    <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',overflow:'hidden'}}>
      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:'2px',padding:'4px 8px 4px 4px',borderBottom:'1px solid #e0e0e0',flexShrink:0,height:'44px'}}>
        <button onClick={toggleAll} style={{...ib(false),flexShrink:0}}><I d={sel.size>0&&sel.size===threads.length?P.cbOn:P.cb} sz={18}/></button>
        {sel.size > 0 ? (
          <>
            <button onClick={bulkArchive} title="Archive" style={ib(false)}><I d={P.archive} sz={18}/></button>
            <button onClick={bulkTrash} title="Delete" style={ib(false)}><I d={P.trash} sz={18}/></button>
            <button onClick={bulkUnread} title="Mark unread" style={ib(false)}><I d={P.unreadOpen} sz={18}/></button>
          </>
        ) : (
          <button onClick={()=>loadThreads()} title="Refresh" style={ib(false)}><I d={P.refresh} sz={18}/></button>
        )}
        <div style={{flex:1}}/>
        {/* Pagination */}
        {threads.length > 0 && (
          <div style={{display:'flex',alignItems:'center',gap:'2px',flexShrink:0}}>
            <span style={{fontSize:'12px',color:'#5f6368',whiteSpace:'nowrap'}}>{startIdx}-{endIdx}</span>
            <button onClick={goPrev} disabled={currentPage<=1} style={ib(currentPage<=1)} title="Newer"><I d={P.chevLeft} sz={18}/></button>
            <button onClick={goNext} disabled={!nextToken} style={ib(!nextToken)} title="Older"><I d={P.chevRight} sz={18}/></button>
          </div>
        )}
      </div>

      {/* Thread rows */}
      <div style={{flex:1,overflowY:'auto',overflowX:'hidden',width:'100%'}}>
        {loading ? (
          <div style={{padding:'60px',textAlign:'center',color:'#5f6368',fontSize:'14px'}}>Loading...</div>
        ) : err ? (
          <div style={{padding:'40px',textAlign:'center',color:'#d93025',fontSize:'14px'}}>{err}</div>
        ) : threads.length===0 ? (
          <div style={{padding:'80px',textAlign:'center',color:'#5f6368',fontSize:'14px'}}>{searchQ?'No results':'Nothing here'}</div>
        ) : threads.map(t => {
          const s = parseAddr(t.from)
          const hov = hovRow===t.id
          const isSel = sel.has(t.id)
          const starred = t.labelIds.includes('STARRED')
          const cLabels = t.labelIds.filter(l=>!SYS.has(l))
          const hasDraft = t.labelIds.includes('DRAFT')

          return (
            <div key={t.id}
              onMouseEnter={()=>setHovRow(t.id)} onMouseLeave={()=>setHovRow(null)}
              onClick={()=>openThread(t.id)}
              style={{
                display:'flex', alignItems:'center', height:'32px',
                cursor:'pointer', borderBottom:'1px solid #f1f3f4',
                background: isSel ? '#c2dbff' : hov ? '#f2f6fc' : t.isUnread ? '#f2f6fc' : '#fff',
                fontSize:'12px', width:'100%', overflow:'hidden',
              }}>
              {/* Checkbox */}
              <div onClick={e=>toggleSel(t.id,e)} style={{width:'28px',display:'flex',justifyContent:'center',flexShrink:0,color:'#5f6368'}}>
                <I d={isSel?P.cbOn:P.cb} sz={16}/>
              </div>
              {/* Star */}
              <div onClick={e=>{e.stopPropagation();doStar(t.id,starred)}} style={{width:'24px',display:'flex',justifyContent:'center',flexShrink:0,cursor:'pointer',color:starred?'#f4b400':'#c4c7c5'}}>
                <I d={starred?P.starOn:P.starOff} sz={16} c={starred?'#f4b400':'#dadce0'}/>
              </div>
              {/* Sender */}
              <div style={{width:'140px',flexShrink:0,paddingRight:'8px',fontWeight:t.isUnread?700:400,color:t.isUnread?'#202124':'#5f6368',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {s.n}
              </div>
              {/* Content: labels + subject + snippet */}
              <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:'3px',overflow:'hidden'}}>
                {cLabels.slice(0,1).map(l=>(
                  <span key={l} style={{fontSize:'10px',padding:'0 4px',borderRadius:'2px',background:'#e8eaed',color:'#5f6368',whiteSpace:'nowrap',flexShrink:0,lineHeight:'16px'}}>{resLabel(l)}</span>
                ))}
                {hasDraft && <span style={{fontSize:'10px',padding:'0 4px',borderRadius:'2px',background:'#fef3c7',color:'#92400e',whiteSpace:'nowrap',flexShrink:0,lineHeight:'16px'}}>Draft</span>}
                <span style={{fontWeight:t.isUnread?700:400,color:'#202124',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flexShrink:1,minWidth:0}}>
                  {t.subject}
                </span>
                {t.messageCount>1 && <span style={{color:'#5f6368',flexShrink:0}}>({t.messageCount})</span>}
                <span style={{color:'#5f6368',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1,minWidth:0}}>
                  &nbsp;- {t.snippet}
                </span>
              </div>
              {/* Right: hover actions or date */}
              <div style={{width:'90px',flexShrink:0,display:'flex',justifyContent:'flex-end',alignItems:'center',paddingRight:'8px'}}>
                {hov ? (
                  <div style={{display:'flex',gap:0}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>doArchive(t.id)} title="Archive" style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.archive} sz={16}/></button>
                    <button onClick={()=>doTrash(t.id)} title="Delete" style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.trash} sz={16}/></button>
                    <button onClick={()=>doUnread(t.id)} title="Mark unread" style={{padding:'4px',background:'none',border:'none',color:'#5f6368',cursor:'pointer',display:'flex',borderRadius:'50%'}}><I d={P.unreadOpen} sz={16}/></button>
                  </div>
                ) : (
                  <>
                    {t.hasAttachments && <span style={{color:'#5f6368',marginRight:'4px',display:'flex'}}><I d={P.attach} sz={14}/></span>}
                    <span style={{fontWeight:t.isUnread?700:400,color:t.isUnread?'#202124':'#5f6368',whiteSpace:'nowrap'}}>{fmtDate(t.date)}</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderDetail = () => {
    if(!detail) return null
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:'2px',padding:'4px 8px',borderBottom:'1px solid #e0e0e0',flexShrink:0,height:'44px'}}>
          <button onClick={()=>{setSelThread(null);setDetail(null);setShowReply(false)}} style={ib(false)} title="Back"><I d={P.back} sz={18}/></button>
          <button onClick={()=>doArchive(detail.id)} style={ib(false)} title="Archive"><I d={P.archive} sz={18}/></button>
          <button onClick={()=>doTrash(detail.id)} style={ib(false)} title="Delete"><I d={P.trash} sz={18}/></button>
          <button onClick={()=>doUnread(detail.id)} style={ib(false)} title="Mark unread"><I d={P.unreadMark} sz={18}/></button>
          <div style={{flex:1}}/>
          <span style={{color:'#5f6368',fontSize:'12px',paddingRight:'8px'}}>{detail.messages.length} message{detail.messages.length!==1?'s':''}</span>
        </div>
        <div style={{padding:'12px 56px 4px',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',flexShrink:0}}>
          <h1 style={{color:'#202124',fontSize:'20px',fontWeight:400,margin:0}}>{detail.subject}</h1>
          {detail.messages[0]&&detail.messages[0].labelIds.filter(l=>!SYS.has(l)).map(l=>(
            <span key={l} style={{fontSize:'11px',padding:'1px 6px',borderRadius:'3px',background:'#e8eaed',color:'#5f6368'}}>{resLabel(l)}</span>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',width:'100%'}}>
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
                <div style={{padding:'0 16px 16px 100px',color:'#202124',fontSize:'13px',lineHeight:'1.5',overflowWrap:'break-word',wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:msg.body}}/>
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
                  <textarea value={cBody} onChange={e=>setCBody(e.target.value)} placeholder="Write your reply..." autoFocus
                    style={{width:'100%',minHeight:'100px',padding:'8px',border:'1px solid #dadce0',borderRadius:'4px',color:'#202124',fontSize:'13px',lineHeight:'1.5',resize:'vertical',background:'#fff',boxSizing:'border-box'}}/>
                  <div style={{display:'flex',justifyContent:'flex-end',marginTop:'10px'}}>
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
      <div style={{padding:'10px 16px',borderTop:'1px solid #e0e0e0',display:'flex',justifyContent:'flex-end'}}>
        <button onClick={doSend} disabled={sending||!cTo.trim()||!cSubj.trim()||!cBody.trim()} style={{padding:'8px 20px',background:sending||!cTo.trim()||!cSubj.trim()||!cBody.trim()?'#ccc':'#0b57d0',border:'none',borderRadius:'18px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:sending?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
          <I d={P.send} sz={14}/> {sending?'Sending...':'Send'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'Google Sans,Roboto,-apple-system,sans-serif',height:'calc(100vh - 90px)',display:'flex',flexDirection:'column',borderRadius:'16px',overflow:'hidden',border:'1px solid #e0e0e0',width:'100%',maxWidth:'100%',boxSizing:'border-box'}}>
      {/* Search bar - top, full width like Gmail */}
      <div style={{display:'flex',alignItems:'center',padding:'6px 12px',background:'#f6f8fc',borderBottom:'1px solid #e0e0e0',flexShrink:0,gap:'12px'}}>
        <form onSubmit={doSearch} style={{flex:1,position:'relative',maxWidth:'720px'}}>
          <div style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'#5f6368',display:'flex'}}><I d={P.search} sz={18}/></div>
          <input type="text" placeholder="Search mail" value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'8px 12px 8px 38px',background:'#eaf1fb',border:'1px solid transparent',borderRadius:'24px',color:'#202124',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
        </form>
      </div>

      {/* Body: sidebar + main */}
      <div style={{flex:1,display:'flex',overflow:'hidden',width:'100%'}}>
        {/* Sidebar */}
        <div style={{width:'200px',background:'#f6f8fc',borderRight:'1px solid #e0e0e0',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'10px 10px 6px'}}>
            <button onClick={openCompose} style={{width:'100%',padding:'10px 16px',background:'#c2e7ff',border:'none',borderRadius:'14px',color:'#001d35',fontSize:'13px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',boxShadow:'0 1px 2px rgba(0,0,0,0.06)'}}>
              <I d={P.compose} sz={16}/> Compose
            </button>
          </div>
          <nav style={{flex:1,overflowY:'auto',overflowX:'hidden',paddingTop:'2px'}}>
            {navItems.map(item=>{
              const act=label===item.k&&!searchQ
              return (
                <button key={item.k} onClick={()=>{setLabel(item.k);setSelThread(null);setDetail(null);setSearchQ('');setSearch('');setShowCompose(false);setSel(new Set())}}
                  style={{display:'flex',alignItems:'center',gap:'12px',padding:'4px 14px',margin:'1px 6px',borderRadius:'16px',cursor:'pointer',background:act?'#d3e3fd':'transparent',color:act?'#001d35':'#444746',fontSize:'13px',fontWeight:act?700:400,border:'none',width:'calc(100% - 12px)',textAlign:'left',overflow:'hidden'}}>
                  <span style={{display:'flex',flexShrink:0}}><I d={item.i} sz={18}/></span>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.l}</span>
                </button>
              )
            })}
            {allLabels.length>0&&(
              <>
                <div style={{padding:'12px 14px 4px',fontSize:'10px',fontWeight:600,color:'#444746',textTransform:'uppercase',letterSpacing:'0.5px'}}>Labels</div>
                {allLabels.map(l=>{
                  const act=label===l.id&&!searchQ
                  const parts=l.name.split('/')
                  const depth=parts.length-1
                  const displayName=parts[parts.length-1]
                  return (
                    <button key={l.id} onClick={()=>{setLabel(l.id);setSearchQ('');setSearch('');setSelThread(null);setDetail(null);setSel(new Set())}}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'3px 14px',margin:'0 6px',borderRadius:'16px',cursor:'pointer',background:act?'#d3e3fd':'transparent',color:act?'#001d35':'#444746',fontSize:'12px',fontWeight:act?600:400,border:'none',width:'calc(100% - 12px)',textAlign:'left',overflow:'hidden',paddingLeft:`${14+depth*16}px`}}>
                      <span style={{display:'flex',flexShrink:0}}><I d={P.label} sz={depth>0?14:16}/></span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</span>
                    </button>
                  )
                })}
              </>
            )}
          </nav>
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
