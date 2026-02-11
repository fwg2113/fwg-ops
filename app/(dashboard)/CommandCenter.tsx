'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// ============================================================================
// TYPES
// ============================================================================

type Task = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  due_date: string
  submission_id?: string
  quote_id?: string
  invoice_id?: string
  created_at: string
}

type Document = {
  id: string
  doc_number: number
  doc_type: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name?: string
  vehicle_description?: string
  project_description: string
  category: string
  total: number
  created_at: string
  sent_at?: string
  viewed_at?: string
  last_followup_at?: string
  followup_count?: number
  paid_at?: string
  event_id?: string
  revision_history_json?: any
  notes?: string
  hasScheduledEvent?: boolean
  in_production?: boolean
  bucket?: string
  balance_due?: number
  fulfillment_type?: string
  fulfillment_details?: any
}

type Submission = {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  company_name?: string
  vehicle_description?: string
  status: string
  vehicle_category: string
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  project_type: string
  price_range_min: number
  price_range_max: number
  created_at: string
  converted_to_quote_id?: string
}

type CustomerAction = {
  id: string
  document_id: string | null
  submission_id: string | null
  template_key: string
  step_key: string
  title: string
  description: string | null
  status: string
  priority: string
  sort_order: number
  auto_complete_on_status: string | null
  created_at: string
  completed_at: string | null
  documents?: {
    id: string
    customer_name: string
    doc_number: number
    doc_type: string
    total: number
    vehicle_description?: string
    project_description?: string
    category?: string
    status?: string
  } | null
}

type PinnedItem = {
  item_type: string
  item_id: string
}

type DashboardData = {
  quotes: Document[]
  invoices: Document[]
  submissions: Submission[]
  tasks: Task[]
  customerActions: CustomerAction[]
  productionStatus: Record<string, { total: number; completed: number }>
  pinnedItems: PinnedItem[]
  metrics: {
    monthlyRevenue: number
    ppfVinylRevenue: number
    bonus25Pct: number
    pipelineValue: number
    yearlyRevenue: number
  }
  categoryBreakdown: { category: string; amount: number }[]
}

// ============================================================================
// ICONS
// ============================================================================

const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const EyeIcon = ({ viewed, size = 16 }: { viewed: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={viewed ? '#a855f7' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
)

const ArchiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)

const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// ============================================================================
// HELPERS
// ============================================================================

const formatCategoryLabel = (category: string): string => {
  const specialCases: Record<string, string> = { 'PPF': 'PPF', 'TINT': 'Window Tint' }
  if (specialCases[category]) return specialCases[category]
  return category.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
}

const getCardState = (
  doc: Document,
  todoActions: CustomerAction[],
  productionStatus: Record<string, { total: number; completed: number }>
): 'action_needed' | 'waiting' | 'in_production' | 'production_complete' | 'idle' => {
  const prodStat = productionStatus[doc.id]
  if (doc.in_production && prodStat && prodStat.completed < prodStat.total) return 'in_production'
  if (doc.in_production && prodStat && prodStat.total > 0 && prodStat.completed >= prodStat.total) return 'production_complete'
  if (todoActions.length > 0) return 'action_needed'
  if (doc.status === 'sent' || doc.status === 'viewed') return 'waiting'
  return 'idle'
}

const getStateBadge = (state: string, doc?: Document) => {
  const configs: Record<string, { label: string; bg: string; color: string; glow?: string }> = {
    'action_needed': { label: 'Action Needed', bg: 'rgba(215, 28, 209, 0.15)', color: '#d71cd1', glow: '#d71cd140' },
    'waiting': { label: 'Waiting on Customer', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', glow: '#3b82f640' },
    'in_production': { label: 'In Production', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', glow: '#a855f740' },
    'production_complete': { label: 'Production Complete', bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', glow: '#22c55e40' },
    'idle': { label: 'Up to Date', bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b' },
  }
  const cfg = configs[state] || configs['idle']
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
      boxShadow: cfg.glow ? `0 0 8px ${cfg.glow}` : 'none',
      textTransform: 'uppercase', letterSpacing: '0.3px'
    }}>
      {state === 'waiting' && doc && <EyeIcon viewed={doc.status === 'viewed'} size={12} />}
      {cfg.label}
    </div>
  )
}

const stepLabels: Record<string, string> = {
  'REVIEW_AND_CATEGORIZE': 'Review & Categorize',
  'SEND_QUOTE': 'Send Quote',
  'FOLLOW_UP_QUOTE': 'Follow Up',
  'COLLECT_PAYMENT': 'Collect Payment',
  'SCHEDULE_JOB': 'Schedule Job',
  'NOTIFY_COMPLETION': 'Notify Customer'
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommandCenter({ initialData }: { initialData: DashboardData }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['submissions', 'quotes', 'invoices', 'tasks']))
  const [showArchiveModal, setShowArchiveModal] = useState<{ type: 'document' | 'submission'; id: string } | null>(null)
  const [archiveReason, setArchiveReason] = useState<'won' | 'cold'>('cold')
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'NORMAL', due_date: '' })

  // Sync with server data on refresh
  useEffect(() => { setData(initialData) }, [initialData])

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Group customer actions by document/submission
  const actionsByDocId = new Map<string, CustomerAction[]>()
  const actionsBySubId = new Map<string, CustomerAction[]>()
  data.customerActions.forEach(ca => {
    if (ca.document_id) {
      const arr = actionsByDocId.get(ca.document_id) || []
      arr.push(ca)
      actionsByDocId.set(ca.document_id, arr)
    } else if (ca.submission_id) {
      const arr = actionsBySubId.get(ca.submission_id) || []
      arr.push(ca)
      actionsBySubId.set(ca.submission_id, arr)
    }
  })

  // Get TODO actions for a document
  const getTodoActions = (docId: string) => (actionsByDocId.get(docId) || []).filter(a => a.status === 'TODO')
  const getAllActions = (docId: string) => actionsByDocId.get(docId) || []
  const getSubActions = (subId: string) => actionsBySubId.get(subId) || []
  const getSubTodoActions = (subId: string) => (actionsBySubId.get(subId) || []).filter(a => a.status === 'TODO')

  // Toggle card expansion
  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Toggle section collapse
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  // Complete a customer action
  const completeCustomerAction = async (actionId: string, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    const prev = data.customerActions
    setData(d => ({
      ...d,
      customerActions: d.customerActions.map(ca => ca.id === actionId ? { ...ca, status: 'COMPLETED', completed_at: new Date().toISOString() } : ca)
    }))
    try {
      const res = await fetch('/api/customer-actions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId })
      })
      if (!res.ok) {
        console.error('Failed to complete action:', await res.text())
        setData(d => ({ ...d, customerActions: prev }))
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to complete action:', err)
      setData(d => ({ ...d, customerActions: prev }))
    }
  }

  // Archive a document (save current status/bucket for restore)
  const archiveDocument = async (docId: string, reason: 'won' | 'cold') => {
    const doc = [...data.quotes, ...data.invoices].find(d => d.id === docId)
    const bucketValue = reason === 'won' ? 'ARCHIVE_WON' : 'COLD'
    const statusValue = reason === 'won' ? 'archived' : undefined
    const update: any = {
      bucket: bucketValue,
      pre_archive_status: doc?.status || null,
      pre_archive_bucket: doc?.bucket || null
    }
    if (statusValue) update.status = statusValue
    await supabase.from('documents').update(update).eq('id', docId)
    setData(d => ({
      ...d,
      quotes: d.quotes.filter(q => q.id !== docId),
      invoices: d.invoices.filter(i => i.id !== docId)
    }))
    setShowArchiveModal(null)
    router.refresh()
  }

  // Archive a submission (save current status for restore)
  const archiveSubmission = async (subId: string) => {
    const sub = data.submissions.find(s => s.id === subId)
    await supabase.from('submissions').update({
      status: 'archived',
      pre_archive_status: sub?.status || 'new'
    }).eq('id', subId)
    setData(d => ({ ...d, submissions: d.submissions.filter(s => s.id !== subId) }))
    setShowArchiveModal(null)
    router.refresh()
  }

  // Complete a manual task
  const completeTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    await supabase.from('tasks').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', taskId)
    setData({ ...data, tasks: data.tasks.map(t => t.id === taskId ? { ...t, status: 'COMPLETED' } : t) })
    setShowTaskDetailModal(false)
  }

  // Create new task
  const createTask = async () => {
    if (!newTask.title.trim()) return
    const { data: created, error } = await supabase
      .from('tasks')
      .insert({ title: newTask.title, description: newTask.description, priority: newTask.priority, due_date: newTask.due_date || null, status: 'TO_DO', auto_generated: false })
      .select().single()
    if (!error && created) {
      setData(d => ({ ...d, tasks: [...d.tasks, created] }))
      setNewTask({ title: '', description: '', priority: 'NORMAL', due_date: '' })
      setShowAddTaskModal(false)
    }
  }

  // Delete task
  const deleteTask = async () => {
    if (!selectedTask) return
    await supabase.from('tasks').delete().eq('id', selectedTask.id)
    setData(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== selectedTask.id) }))
    setShowTaskDetailModal(false)
  }

  // Filter out COLD bucket from active view
  const activeQuotes = data.quotes.filter(q => q.bucket !== 'COLD')
  const activeInvoices = data.invoices.filter(i => i.bucket !== 'COLD')
  const activeSubmissions = data.submissions

  // Waiting items for the existing section
  const waitingItems = data.quotes
    .filter(q => q.status === 'sent' || q.status === 'viewed')
    .map(q => {
      const sentDate = q.sent_at ? new Date(q.sent_at) : new Date(q.created_at)
      const daysWaiting = Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
      return { ...q, daysWaiting }
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
  const waitingTotal = waitingItems.reduce((sum, q) => sum + (q.total || 0), 0)

  // Sort documents by urgency: action_needed first, then production_complete, then in_production, then waiting, then idle
  const stateOrder: Record<string, number> = { 'action_needed': 0, 'production_complete': 1, 'in_production': 2, 'waiting': 3, 'idle': 4 }
  const sortByState = (docs: Document[]) => [...docs].sort((a, b) => {
    const sa = getCardState(a, getTodoActions(a.id), data.productionStatus)
    const sb = getCardState(b, getTodoActions(b.id), data.productionStatus)
    return (stateOrder[sa] ?? 4) - (stateOrder[sb] ?? 4)
  })

  const sortedQuotes = sortByState(activeQuotes)
  const sortedInvoices = sortByState(activeInvoices)

  const maxCategoryValue = Math.max(...data.categoryBreakdown.map(c => c.amount), 1)
  const manualTasks = data.tasks.filter(t => t.status !== 'COMPLETED')

  return (
    <div>
      {/* Customer Action Center */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        marginBottom: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
            <span style={{ color: '#d71cd1' }}><LightningIcon /></span>
            Customer Action Center
            <button onClick={handleRefresh} style={{
              background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
              padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'all 0.15s ease',
              transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
            }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#d71cd1'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
            >
              <RefreshIcon />
            </button>
          </div>
          <button onClick={() => setShowAddTaskModal(true)} style={{
            padding: '8px 16px', background: '#d71cd1', border: 'none', borderRadius: '8px',
            color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer'
          }}>
            + Add Task
          </button>
        </div>

        <div style={{ padding: '12px' }}>
          {/* Submissions Section */}
          <SectionHeader
            title="Submissions"
            count={activeSubmissions.length}
            color="#06b6d4"
            collapsed={collapsedSections.has('submissions')}
            onToggle={() => toggleSection('submissions')}
          />
          {!collapsedSections.has('submissions') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {activeSubmissions.length === 0 ? (
                <EmptyState text="No active submissions" />
              ) : activeSubmissions.map(sub => (
                <SubmissionCard
                  key={sub.id}
                  submission={sub}
                  actions={getSubActions(sub.id)}
                  todoActions={getSubTodoActions(sub.id)}
                  expanded={expandedCards.has(`sub-${sub.id}`)}
                  onToggle={() => toggleCard(`sub-${sub.id}`)}
                  onComplete={completeCustomerAction}
                  onArchive={() => setShowArchiveModal({ type: 'submission', id: sub.id })}
                  onClick={() => router.push(`/submissions?id=${sub.id}`)}
                />
              ))}
            </div>
          )}

          {/* Quotes Section */}
          <SectionHeader
            title="Quotes"
            count={sortedQuotes.length}
            color="#3b82f6"
            collapsed={collapsedSections.has('quotes')}
            onToggle={() => toggleSection('quotes')}
          />
          {!collapsedSections.has('quotes') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {sortedQuotes.length === 0 ? (
                <EmptyState text="No active quotes" />
              ) : sortedQuotes.map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  allActions={getAllActions(doc.id)}
                  todoActions={getTodoActions(doc.id)}
                  state={getCardState(doc, getTodoActions(doc.id), data.productionStatus)}
                  productionStatus={data.productionStatus[doc.id]}
                  expanded={expandedCards.has(`doc-${doc.id}`)}
                  onToggle={() => toggleCard(`doc-${doc.id}`)}
                  onComplete={completeCustomerAction}
                  onArchive={() => setShowArchiveModal({ type: 'document', id: doc.id })}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                />
              ))}
            </div>
          )}

          {/* Invoices Section */}
          <SectionHeader
            title="Invoices"
            count={sortedInvoices.length}
            color="#22c55e"
            collapsed={collapsedSections.has('invoices')}
            onToggle={() => toggleSection('invoices')}
          />
          {!collapsedSections.has('invoices') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {sortedInvoices.length === 0 ? (
                <EmptyState text="No active invoices" />
              ) : sortedInvoices.map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  allActions={getAllActions(doc.id)}
                  todoActions={getTodoActions(doc.id)}
                  state={getCardState(doc, getTodoActions(doc.id), data.productionStatus)}
                  productionStatus={data.productionStatus[doc.id]}
                  expanded={expandedCards.has(`doc-${doc.id}`)}
                  onToggle={() => toggleCard(`doc-${doc.id}`)}
                  onComplete={completeCustomerAction}
                  onArchive={() => setShowArchiveModal({ type: 'document', id: doc.id })}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                />
              ))}
            </div>
          )}

          {/* Manual Tasks Section */}
          {manualTasks.length > 0 && (
            <>
              <SectionHeader
                title="Tasks"
                count={manualTasks.length}
                color="#fbbf24"
                collapsed={collapsedSections.has('tasks')}
                onToggle={() => toggleSection('tasks')}
              />
              {!collapsedSections.has('tasks') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {manualTasks.map(t => (
                    <div key={t.id} onClick={() => { setSelectedTask(t); setShowTaskDetailModal(true) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', background: '#1d1d1d', borderRadius: '10px',
                        cursor: 'pointer', border: '1px solid rgba(148, 163, 184, 0.1)',
                        transition: 'border-color 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#fbbf24'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)'}
                    >
                      <button onClick={(e) => completeTask(t.id, e)} style={{
                        width: '22px', height: '22px', borderRadius: '6px', border: '2px solid #fbbf24',
                        background: 'transparent', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fbbf24'
                      }}>
                        <CheckIcon />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.title}
                        </div>
                        {t.description && (
                          <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Waiting on Customer */}
      {waitingItems.length > 0 && (
        <div style={{
          background: '#111111', border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              <span style={{ color: '#3b82f6' }}><ClockIcon /></span>
              Waiting on Customer
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>${waitingTotal.toLocaleString()}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {waitingItems.map(q => {
              const daysWaiting = Math.floor((Date.now() - (q.sent_at ? new Date(q.sent_at).getTime() : new Date(q.created_at).getTime())) / (1000 * 60 * 60 * 24))
              return (
                <div key={q.id} onClick={() => router.push(`/documents/${q.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                  background: '#1d1d1d', borderRadius: '10px', cursor: 'pointer',
                  border: '1px solid transparent', transition: 'all 0.15s ease'
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <EyeIcon viewed={q.status === 'viewed'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {q.customer_name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Quote #{q.doc_number} &bull; {daysWaiting}d waiting</div>
                  </div>
                  <div style={{ fontWeight: 600, color: '#94a3b8', flexShrink: 0 }}>${(q.total || 0).toLocaleString()}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Snapshot Metrics */}
      <div style={{
        background: '#111111', border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '16px' }}>Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[
            { value: data.metrics.monthlyRevenue, label: `${new Date().toLocaleString('default', { month: 'short' })} Revenue`, color: '#d71cd1' },
            { value: data.metrics.ppfVinylRevenue, label: 'PPF & Vinyl', color: '#d71cd1' },
            { value: Math.round(data.metrics.bonus25Pct), label: '2.5% Bonus', color: '#22c55e' },
            { value: data.metrics.pipelineValue, label: 'Pipeline Value', color: '#06b6d4' },
            { value: data.metrics.yearlyRevenue, label: `${new Date().getFullYear()} YTD`, color: '#a855f7' },
          ].map(m => (
            <div key={m.label} style={{ padding: '16px', background: '#1d1d1d', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: m.color, marginBottom: '4px' }}>${m.value.toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MTD by Category */}
      {data.categoryBreakdown.length > 0 && (
        <div style={{
          background: '#111111', border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '16px' }}>MTD by Category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.categoryBreakdown.map(cat => (
              <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', fontSize: '13px', color: '#94a3b8', flexShrink: 0 }}>{formatCategoryLabel(cat.category)}</div>
                <div style={{ flex: 1, height: '20px', background: '#1d1d1d', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(cat.amount / maxCategoryValue) * 100}%`, background: 'linear-gradient(90deg, #d71cd1, #8b5cf6)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ width: '80px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>${cat.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowArchiveModal(null)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#f1f5f9', fontSize: '18px', marginBottom: '16px' }}>
              Archive {showArchiveModal.type === 'submission' ? 'Submission' : 'Document'}
            </h3>
            {showArchiveModal.type === 'document' && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {(['won', 'cold'] as const).map(r => (
                  <button key={r} onClick={() => setArchiveReason(r)} style={{
                    flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer',
                    border: archiveReason === r ? '2px solid #d71cd1' : '2px solid rgba(148,163,184,0.2)',
                    background: archiveReason === r ? 'rgba(215,28,209,0.1)' : '#1d1d1d',
                    color: archiveReason === r ? '#d71cd1' : '#94a3b8', fontSize: '14px', fontWeight: 600
                  }}>
                    {r === 'won' ? 'Completed (Won)' : 'Cold Lead'}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowArchiveModal(null)} style={{
                padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={() => {
                if (showArchiveModal.type === 'submission') archiveSubmission(showArchiveModal.id)
                else archiveDocument(showArchiveModal.id, archiveReason)
              }} style={{
                padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px',
                color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer'
              }}>Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowAddTaskModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '500px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Add Task</div>
              <button onClick={() => setShowAddTaskModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Task Title <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="What needs to be done?" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Description</label>
                <textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Optional details..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }}>
                    <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Due Date</label>
                  <input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.2)', background: '#1d1d1d', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
              <button onClick={() => setShowAddTaskModal(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createTask} disabled={!newTask.title.trim()} style={{ padding: '10px 20px', background: '#d71cd1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer', opacity: newTask.title.trim() ? 1 : 0.5 }}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetailModal && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowTaskDetailModal(false)}>
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '500px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Task Details</div>
              <button onClick={() => setShowTaskDetailModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '20px', marginBottom: '8px' }}>{selectedTask.title}</h3>
              {selectedTask.description && <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>{selectedTask.description}</p>}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Priority</span><p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedTask.priority}</p></div>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Status</span><p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedTask.status}</p></div>
                {selectedTask.due_date && <div><span style={{ color: '#64748b', fontSize: '12px' }}>Due Date</span><p style={{ color: '#f1f5f9', fontSize: '14px' }}>{new Date(selectedTask.due_date).toLocaleDateString()}</p></div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
              <button onClick={deleteTask} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '14px', cursor: 'pointer' }}>Delete</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowTaskDetailModal(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>Close</button>
                <button onClick={() => completeTask(selectedTask.id)} style={{ padding: '10px 20px', background: '#22c55e', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckIcon /> Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({ title, count, color, collapsed, onToggle }: {
  title: string; count: number; color: string; collapsed: boolean; onToggle: () => void
}) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
      padding: '10px 12px', marginBottom: collapsed ? '4px' : '8px',
      background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px',
      transition: 'background 0.15s'
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ color }}><ChevronDownIcon open={!collapsed} /></div>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
        background: `${color}20`, color
      }}>{count}</span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(148,163,184,0.1)' }} />
    </button>
  )
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px', color: '#4b5563', fontSize: '13px' }}>
      {text}
    </div>
  )
}

// ============================================================================
// SUBMISSION CARD
// ============================================================================

function SubmissionCard({ submission, actions, todoActions, expanded, onToggle, onComplete, onArchive, onClick }: {
  submission: Submission
  actions: CustomerAction[]
  todoActions: CustomerAction[]
  expanded: boolean
  onToggle: () => void
  onComplete: (actionId: string, e?: React.MouseEvent) => void
  onArchive: () => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const liveTask = todoActions.sort((a, b) => a.sort_order - b.sort_order)[0]
  const vehicle = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(' ')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#1d1d1d', borderRadius: '12px',
        border: `1px solid ${hovered ? '#06b6d4' : 'rgba(148,163,184,0.12)'}`,
        transition: 'border-color 0.15s', overflow: 'hidden'
      }}
    >
      {/* Card Header */}
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {submission.customer_name}
            </span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', flexShrink: 0 }}>
              Submission
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {vehicle}{submission.project_type ? ` \u2022 ${formatCategoryLabel(submission.project_type)}` : ''}
          </div>
        </div>
        {submission.price_range_max > 0 && (
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>${submission.price_range_max.toLocaleString()}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {getStateBadge(todoActions.length > 0 ? 'action_needed' : 'idle')}
        </div>
      </div>

      {/* Live Task */}
      {liveTask && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 16px', borderTop: '1px solid rgba(148,163,184,0.08)',
          background: 'rgba(215,28,209,0.04)'
        }}>
          <button onClick={(e) => onComplete(liveTask.id, e)} style={{
            width: '22px', height: '22px', borderRadius: '6px', border: '2px solid #d71cd1',
            background: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#d71cd1',
            transition: 'all 0.15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#d71cd1'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#d71cd1' }}
          >
            <CheckIcon />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', flex: 1 }}>
            {stepLabels[liveTask.step_key] || liveTask.title}
          </span>
        </div>
      )}

      {/* Expand/Archive Row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px 8px', borderTop: '1px solid rgba(148,163,184,0.05)'
      }}>
        <button onClick={(e) => { e.stopPropagation(); onToggle() }} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'transparent', border: 'none', color: '#4b5563',
          fontSize: '11px', cursor: 'pointer', padding: '4px 0'
        }}>
          <ChevronDownIcon open={expanded} />
          {expanded ? 'Hide' : 'Workflow'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onArchive() }} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'transparent', border: 'none', color: '#4b5563',
          fontSize: '11px', cursor: 'pointer', padding: '4px'
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
        >
          <ArchiveIcon /> Archive
        </button>
      </div>

      {/* Expanded Workflow Timeline */}
      {expanded && actions.length > 0 && (
        <div style={{ padding: '0 16px 12px', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          <WorkflowTimeline actions={actions} onComplete={onComplete} />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DOCUMENT CARD (Quote or Invoice)
// ============================================================================

function DocumentCard({ doc, allActions, todoActions, state, productionStatus, expanded, onToggle, onComplete, onArchive, onClick }: {
  doc: Document
  allActions: CustomerAction[]
  todoActions: CustomerAction[]
  state: string
  productionStatus?: { total: number; completed: number }
  expanded: boolean
  onToggle: () => void
  onComplete: (actionId: string, e?: React.MouseEvent) => void
  onArchive: () => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const liveTask = todoActions.sort((a, b) => a.sort_order - b.sort_order)[0]
  const isQuote = doc.doc_type === 'quote'
  const borderColor = hovered ? (isQuote ? '#3b82f6' : '#22c55e') : 'rgba(148,163,184,0.12)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#1d1d1d', borderRadius: '12px',
        border: `1px solid ${borderColor}`,
        transition: 'border-color 0.15s', overflow: 'hidden'
      }}
    >
      {/* Card Header */}
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {doc.customer_name}
            </span>
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '4px', flexShrink: 0,
              background: isQuote ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
              color: isQuote ? '#3b82f6' : '#22c55e'
            }}>
              {isQuote ? 'Quote' : 'Invoice'} #{doc.doc_number}
            </span>
            {doc.category && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(148,163,184,0.1)', color: '#64748b', flexShrink: 0 }}>
                {formatCategoryLabel(doc.category)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doc.vehicle_description || doc.project_description || ''}
          </div>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>
          ${(doc.total || 0).toLocaleString()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {getStateBadge(state, doc)}
        </div>
      </div>

      {/* Production Progress Bar */}
      {state === 'in_production' && productionStatus && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '6px', background: '#282a30', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '3px',
                width: `${(productionStatus.completed / productionStatus.total) * 100}%`,
                background: 'linear-gradient(90deg, #a855f7, #8b5cf6)',
                transition: 'width 0.4s ease'
              }} />
            </div>
            <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 600 }}>
              {productionStatus.completed}/{productionStatus.total}
            </span>
          </div>
        </div>
      )}

      {/* Live Task */}
      {liveTask && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 16px', borderTop: '1px solid rgba(148,163,184,0.08)',
          background: state === 'production_complete' ? 'rgba(34,197,94,0.04)' : 'rgba(215,28,209,0.04)'
        }}>
          <button onClick={(e) => onComplete(liveTask.id, e)} style={{
            width: '22px', height: '22px', borderRadius: '6px',
            border: `2px solid ${state === 'production_complete' ? '#22c55e' : '#d71cd1'}`,
            background: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: state === 'production_complete' ? '#22c55e' : '#d71cd1',
            transition: 'all 0.15s'
          }}
            onMouseEnter={e => { const c = state === 'production_complete' ? '#22c55e' : '#d71cd1'; e.currentTarget.style.background = c; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { const c = state === 'production_complete' ? '#22c55e' : '#d71cd1'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c }}
          >
            <CheckIcon />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', flex: 1 }}>
            {stepLabels[liveTask.step_key] || liveTask.title}
          </span>
        </div>
      )}

      {/* Waiting indicator when no live task */}
      {!liveTask && state === 'waiting' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', borderTop: '1px solid rgba(148,163,184,0.08)',
          background: 'rgba(59,130,246,0.04)'
        }}>
          <EyeIcon viewed={doc.status === 'viewed'} size={14} />
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {doc.status === 'viewed' ? 'Customer viewed' : 'Sent'}{doc.sent_at ? ` \u2022 ${Math.floor((Date.now() - new Date(doc.sent_at).getTime()) / 86400000)}d ago` : ''}
          </span>
        </div>
      )}

      {/* Expand/Archive Row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px 8px', borderTop: '1px solid rgba(148,163,184,0.05)'
      }}>
        <button onClick={(e) => { e.stopPropagation(); onToggle() }} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'transparent', border: 'none', color: '#4b5563',
          fontSize: '11px', cursor: 'pointer', padding: '4px 0'
        }}>
          <ChevronDownIcon open={expanded} />
          {expanded ? 'Hide' : 'Workflow'}{allActions.length > 0 ? ` (${allActions.filter(a => a.status === 'COMPLETED').length}/${allActions.length})` : ''}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onArchive() }} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'transparent', border: 'none', color: '#4b5563',
          fontSize: '11px', cursor: 'pointer', padding: '4px'
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
        >
          <ArchiveIcon /> Archive
        </button>
      </div>

      {/* Expanded Workflow Timeline */}
      {expanded && allActions.length > 0 && (
        <div style={{ padding: '0 16px 12px', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          <WorkflowTimeline actions={allActions} onComplete={onComplete} />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// WORKFLOW TIMELINE (Expandable dropdown)
// ============================================================================

function WorkflowTimeline({ actions, onComplete }: {
  actions: CustomerAction[]
  onComplete: (actionId: string, e?: React.MouseEvent) => void
}) {
  const sorted = [...actions].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <div style={{ paddingTop: '10px' }}>
      {sorted.map((action, idx) => {
        const isCompleted = action.status === 'COMPLETED'
        const isTodo = action.status === 'TODO'
        const isLast = idx === sorted.length - 1
        return (
          <div key={action.id} style={{ display: 'flex', gap: '10px', position: 'relative' }}>
            {/* Timeline connector */}
            {!isLast && (
              <div style={{
                position: 'absolute', left: '10px', top: '22px', bottom: '-2px',
                width: '2px', background: isCompleted ? '#22c55e30' : '#282a30'
              }} />
            )}
            {/* Step indicator */}
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isCompleted ? '#22c55e' : isTodo ? '#282a30' : '#282a30',
              border: isTodo ? '2px solid #64748b' : 'none',
              color: isCompleted ? 'white' : '#64748b', zIndex: 1,
              cursor: isTodo ? 'pointer' : 'default',
              transition: 'all 0.15s'
            }}
              onClick={isTodo ? (e) => onComplete(action.id, e) : undefined}
              onMouseEnter={isTodo ? (e) => { e.currentTarget.style.borderColor = '#d71cd1'; e.currentTarget.style.color = '#d71cd1' } : undefined}
              onMouseLeave={isTodo ? (e) => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = '#64748b' } : undefined}
            >
              {isCompleted && <CheckIcon />}
            </div>
            {/* Step content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : '12px' }}>
              <div style={{
                fontSize: '13px', fontWeight: 500,
                color: isCompleted ? '#64748b' : isTodo ? '#e2e8f0' : '#4b5563',
                textDecoration: isCompleted ? 'line-through' : 'none'
              }}>
                {stepLabels[action.step_key] || action.title}
              </div>
              {action.completed_at && (
                <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>
                  Completed {new Date(action.completed_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
