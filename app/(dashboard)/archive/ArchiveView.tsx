'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type ArchivedDoc = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  customer_name: string
  vehicle_description?: string
  project_description?: string
  category?: string
  total: number
  created_at: string
  paid_at?: string
  bucket: string
}

type ArchivedSub = {
  id: string
  customer_name: string
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  project_type?: string
  price_range_max: number
  created_at: string
  status: string
}

const formatCategory = (cat: string): string => {
  const special: Record<string, string> = { 'PPF': 'PPF', 'TINT': 'Window Tint' }
  if (special[cat]) return special[cat]
  return cat.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

export default function ArchiveView({ completedDocs, coldDocs, archivedSubs }: {
  completedDocs: ArchivedDoc[]
  coldDocs: ArchivedDoc[]
  archivedSubs: ArchivedSub[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'completed' | 'cold'>('completed')
  const [search, setSearch] = useState('')

  const filterBySearch = <T extends { customer_name: string }>(items: T[]) =>
    search ? items.filter(i => i.customer_name.toLowerCase().includes(search.toLowerCase())) : items

  const filteredCompleted = filterBySearch(completedDocs)
  const filteredCold = filterBySearch([...coldDocs, ...archivedSubs.map(s => ({
    id: s.id,
    doc_number: 0,
    doc_type: 'submission' as string,
    status: s.status,
    customer_name: s.customer_name,
    vehicle_description: [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(' ') || undefined,
    project_description: s.project_type ? formatCategory(s.project_type) : undefined,
    category: s.project_type,
    total: s.price_range_max || 0,
    created_at: s.created_at,
    bucket: 'COLD'
  }))])

  // Restore a document from archive back to active
  const restoreDocument = async (docId: string, docType: string) => {
    if (docType === 'submission') {
      await supabase.from('submissions').update({ status: 'new' }).eq('id', docId)
    } else {
      await supabase.from('documents').update({ bucket: null, status: 'draft' }).eq('id', docId)
    }
    router.refresh()
  }

  const activeItems = activeTab === 'completed' ? filteredCompleted : filteredCold

  return (
    <div>
      {/* Header */}
      <div style={{
        background: '#111111', border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '16px', marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d71cd1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>Archive</span>
          </div>
          <input
            type="text"
            placeholder="Search by customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)',
              background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px', width: '240px'
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
          {([
            { key: 'completed' as const, label: 'Completed Projects', count: filteredCompleted.length, color: '#22c55e' },
            { key: 'cold' as const, label: 'Cold Leads', count: filteredCold.length, color: '#64748b' },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: '12px 16px', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              color: activeTab === tab.key ? tab.color : '#64748b',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              {tab.label}
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                background: `${tab.color}20`, color: tab.color
              }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{ padding: '12px' }}>
          {activeItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4b5563', fontSize: '14px' }}>
              {activeTab === 'completed' ? 'No completed projects yet' : 'No cold leads'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeItems.map(item => (
                <div key={item.id}
                  onClick={() => {
                    if (item.doc_type === 'submission') router.push(`/submissions?id=${item.id}`)
                    else router.push(`/documents/${item.id}`)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', background: '#1d1d1d', borderRadius: '12px',
                    cursor: 'pointer', border: '1px solid rgba(148,163,184,0.1)',
                    transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = activeTab === 'completed' ? '#22c55e' : '#64748b'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>{item.customer_name}</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px', flexShrink: 0,
                        background: item.doc_type === 'quote' ? 'rgba(59,130,246,0.15)' :
                          item.doc_type === 'invoice' ? 'rgba(34,197,94,0.15)' : 'rgba(6,182,212,0.15)',
                        color: item.doc_type === 'quote' ? '#3b82f6' :
                          item.doc_type === 'invoice' ? '#22c55e' : '#06b6d4'
                      }}>
                        {item.doc_type === 'submission' ? 'Submission' : `${item.doc_type === 'quote' ? 'Quote' : 'Invoice'} #${item.doc_number}`}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {item.vehicle_description || item.project_description || ''}
                      {item.category ? ` \u2022 ${formatCategory(item.category)}` : ''}
                    </div>
                  </div>
                  {item.total > 0 && (
                    <div style={{ fontSize: '15px', fontWeight: 700, color: activeTab === 'completed' ? '#22c55e' : '#64748b', flexShrink: 0 }}>
                      ${item.total.toLocaleString()}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#4b5563', flexShrink: 0 }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); restoreDocument(item.id, item.doc_type) }}
                    style={{
                      padding: '6px 12px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: '6px', color: '#64748b', fontSize: '11px', cursor: 'pointer',
                      transition: 'all 0.15s', flexShrink: 0
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; e.currentTarget.style.color = '#06b6d4' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)'; e.currentTarget.style.color = '#64748b' }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
