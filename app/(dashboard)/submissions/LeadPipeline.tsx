'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Submission = {
  id: string
  submission_id?: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name: string
  vehicle_category: string
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
  project_type: string
  price_range_min: number
  price_range_max: number
  created_at: string
}

type Document = {
  id: number
  doc_number: number
  doc_type: string
  status: string
  customer_name: string
  vehicle_description: string
  project_description: string
  category: string
  total: number
  created_at: string
  sent_at?: string
  viewed_at?: string
  paid_at?: string
  bucket?: string
}

type PipelineCard = {
  type: 'submission' | 'quote' | 'invoice'
  id: string | number
  docNumber?: number | string
  name: string
  description: string
  amount: number
  date: string
  viewed: boolean
  status: string
  bucket?: string
}

type Props = {
  submissions: Submission[]
  quotes: Document[]
  invoices: Document[]
}

export default function LeadPipeline({ submissions, quotes, invoices }: Props) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Determine bucket for quotes/invoices
  const getBucket = (doc: Document): string => {
    if (doc.bucket === 'COLD') return 'cold'
    if (doc.doc_type === 'invoice' && doc.status?.toLowerCase() === 'paid') return 'production'
    if (doc.status?.toLowerCase() === 'draft') return 'action'
    if (doc.status?.toLowerCase() === 'sent' || doc.status?.toLowerCase() === 'viewed') return 'waiting'
    if (doc.status?.toLowerCase() === 'approved') return 'action'
    return 'action'
  }

  // Build lane data
  const buildLanes = () => {
    const lanes = {
      newLeads: [] as PipelineCard[],
      action: [] as PipelineCard[],
      waiting: [] as PipelineCard[],
      production: [] as PipelineCard[],
      cold: [] as PipelineCard[]
    }

    // Filter function
    const matchesSearch = (card: PipelineCard) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        card.name?.toLowerCase().includes(term) ||
        card.description?.toLowerCase().includes(term) ||
        String(card.docNumber)?.includes(term)
      )
    }

    // Process submissions - New/In Progress go to newLeads
    submissions.forEach(sub => {
      if (sub.status === 'converted' || sub.status === 'lost' || sub.status === 'archived') return
      
      const card: PipelineCard = {
        type: 'submission',
        id: sub.id,
        docNumber: sub.submission_id || sub.id,
        name: sub.customer_name || 'Unknown',
        description: [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(' ') || sub.project_type?.replace(/_/g, ' ') || '',
        amount: sub.price_range_max || 0,
        date: sub.created_at,
        viewed: false,
        status: sub.status
      }
      
      if (matchesSearch(card)) {
        lanes.newLeads.push(card)
      }
    })

    // Process quotes
    quotes.forEach(quote => {
      if (quote.status?.toLowerCase() === 'archived' || quote.status?.toLowerCase() === 'converted') return
      
      const bucket = getBucket(quote)
      const card: PipelineCard = {
        type: 'quote',
        id: quote.id,
        docNumber: quote.doc_number,
        name: quote.customer_name || 'Unknown',
        description: quote.vehicle_description || quote.project_description || '',
        amount: quote.total || 0,
        date: quote.sent_at || quote.created_at,
        viewed: !!quote.viewed_at,
        status: quote.status,
        bucket: quote.bucket
      }
      
      if (matchesSearch(card)) {
        if (quote.bucket === 'COLD') {
          lanes.cold.push(card)
        } else if (bucket === 'waiting') {
          lanes.waiting.push(card)
        } else {
          lanes.action.push(card)
        }
      }
    })

    // Process invoices
    invoices.forEach(inv => {
      if (inv.status?.toLowerCase() === 'archived') return
      
      const bucket = getBucket(inv)
      const card: PipelineCard = {
        type: 'invoice',
        id: inv.id,
        docNumber: inv.doc_number,
        name: inv.customer_name || 'Unknown',
        description: inv.vehicle_description || inv.project_description || '',
        amount: inv.total || 0,
        date: inv.paid_at || inv.created_at,
        viewed: !!inv.viewed_at,
        status: inv.status,
        bucket: inv.bucket
      }
      
      if (matchesSearch(card)) {
        if (inv.bucket === 'COLD') {
          lanes.cold.push(card)
        } else if (bucket === 'production') {
          lanes.production.push(card)
        } else if (bucket === 'waiting') {
          lanes.waiting.push(card)
        } else {
          lanes.action.push(card)
        }
      }
    })

    return lanes
  }

  const lanes = buildLanes()
  
  // Calculate stats (exclude cold)
  const activeItems = lanes.newLeads.length + lanes.action.length + lanes.waiting.length + lanes.production.length
  const totalPipeline = [...lanes.newLeads, ...lanes.action, ...lanes.waiting, ...lanes.production]
    .reduce((sum, card) => sum + (card.amount || 0), 0)

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    const diffWeeks = Math.floor(diffDays / 7)

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffWeeks === 1) return '1 weeks ago'
    return `${diffWeeks} weeks ago`
  }

  const handleCardClick = (card: PipelineCard) => {
    if (card.type === 'submission') {
      router.push(`/submissions/${card.id}`)
    } else {
      router.push(`/documents/${card.id}`)
    }
  }

  // Icons
  const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )

  const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )

  const EyeIcon = ({ viewed }: { viewed: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={viewed ? '#a855f7' : '#64748b'} strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )

  const EyeOffIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )

  const SnowflakeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    </svg>
  )

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'submission':
        return { bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }
      case 'quote':
        return { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }
      case 'invoice':
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
    }
  }

  const getLaneDotColor = (lane: string) => {
    switch (lane) {
      case 'newLeads': return '#eab308'
      case 'action': return '#f97316'
      case 'waiting': return '#3b82f6'
      case 'production': return '#22c55e'
      default: return '#64748b'
    }
  }

  const renderCard = (card: PipelineCard) => {
    const badgeStyle = getBadgeStyle(card.type)
    const badgeLabel = card.type === 'submission' 
      ? `SUBMISSION ${card.docNumber}` 
      : card.type === 'quote' 
        ? `QUOTE ${card.docNumber}` 
        : `INVOICE ${card.docNumber}`

    return (
      <div
        key={`${card.type}-${card.id}`}
        onClick={() => handleCardClick(card)}
        style={{
          background: '#1d1d1d',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '10px',
          padding: '14px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          marginBottom: '10px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#d71cd1'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            background: badgeStyle.bg,
            color: badgeStyle.color
          }}>
            {badgeLabel}
          </span>
          {card.amount > 0 && (
            <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px' }}>
              ${card.amount.toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
          {card.name}
        </div>
        {card.description && (
          <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.description}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '11px' }}>{formatDate(card.date)}</span>
          {card.type !== 'submission' && (
            card.viewed ? <EyeIcon viewed={true} /> : <EyeOffIcon />
          )}
        </div>
      </div>
    )
  }

  const renderLane = (title: string, cards: PipelineCard[], laneKey: string) => (
    <div style={{
      flex: '1 1 250px',
      minWidth: '250px',
      maxWidth: '300px',
      background: '#111111',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 'calc(100vh - 280px)'
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: getLaneDotColor(laneKey)
          }} />
          <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px' }}>{title}</span>
        </div>
        <span style={{
          background: '#282a30',
          color: '#94a3b8',
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 500
        }}>
          {cards.length}
        </span>
      </div>
      <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
        {cards.length > 0 ? (
          cards.map(card => renderCard(card))
        ) : (
          <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            No items
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 600 }}>Lead Pipeline</h1>
        <button
          onClick={handleRefresh}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: '#282a30',
            border: 'none',
            borderRadius: '8px',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ 
            display: 'flex',
            transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
            transition: 'transform 0.5s ease'
          }}>
            <RefreshIcon />
          </span>
          Refresh
        </button>
      </div>

      {/* Controls Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', maxWidth: '350px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search pipeline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 42px',
              background: '#1d1d1d',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#22c55e', fontSize: '20px', fontWeight: 700 }}>
              ${totalPipeline.toLocaleString()}
            </div>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Pipeline
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700 }}>
              {activeItems}
            </div>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Items
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Lanes */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
        {renderLane('New Leads', lanes.newLeads, 'newLeads')}
        {renderLane('Action Needed', lanes.action, 'action')}
        {renderLane('Waiting', lanes.waiting, 'waiting')}
        {renderLane('In Production', lanes.production, 'production')}
      </div>

      {/* Cold Section */}
      {lanes.cold.length > 0 && (
        <div style={{
          background: '#111111',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
              <SnowflakeIcon />
              <span style={{ fontWeight: 600 }}>Cold</span>
            </div>
            <span style={{ color: '#64748b', fontSize: '13px' }}>{lanes.cold.length} items</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {lanes.cold.map(card => (
              <div
                key={`cold-${card.type}-${card.id}`}
                onClick={() => handleCardClick(card)}
                style={{
                  minWidth: '200px',
                  background: '#1d1d1d',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: '10px',
                  padding: '14px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: getBadgeStyle(card.type).bg,
                    color: getBadgeStyle(card.type).color
                  }}>
                    {card.type}
                  </span>
                  {card.amount > 0 && (
                    <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px' }}>
                      ${card.amount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
                  {card.name}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '10px' }}>
                  {card.description || card.status}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{formatDate(card.date)}</span>
                  {card.viewed ? <EyeIcon viewed={true} /> : <EyeOffIcon />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
