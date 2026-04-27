'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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
  due_date?: string
  snoozed?: boolean
  snoozed_at?: string
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
  vehicle_count?: number
  project_type: string
  price_range_min: number
  price_range_max: number
  created_at: string
  converted_to_quote_id?: string
  vehicles?: { type_label: string; year?: string; make?: string; model?: string }[]
  coverage_type?: string
  snoozed?: boolean
  snoozed_at?: string
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
  nextProductionTasks: Record<string, { id: string; title: string; status: string; sort_order: number; track?: string }>
  productionDocCategories: Record<string, string[]>
  pinnedItems: PinnedItem[]
  metrics: {
    monthlyRevenue: number
    commissionPool: number
    bonus25Pct: number
    embroideryBonus10Pct: number
    yearlyRevenue: number
  }
  categoryBreakdown: { category: string; amount: number }[]
  expectedRevenue: { id: string; doc_number: number; doc_type: string; customer_name: string; total: number; balance_due: number }[]
}

// Action Queue item - flattened view of all active projects
type ActionQueueItem = {
  id: string // unique key
  entityId: string // actual document/submission/task id
  type: 'submission' | 'quote' | 'invoice' | 'task'
  state: 'action_needed' | 'production_complete' | 'in_production' | 'waiting' | 'idle'
  customerName: string
  projectDescription: string
  category?: string
  docNumber?: number
  total?: number
  nextAction: string
  nextActionId?: string // customer_action or task id to complete
  canComplete: boolean // whether the next action has a completable button
  productionProgress?: { completed: number; total: number }
  parentCategories?: string[]
  dueDate?: string
  waitingDays?: number
  viewed?: boolean
  priority: number // lower = more urgent
  snoozed?: boolean
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

const SnoozeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3l14 0" />
    <path d="M5 3l14 14" />
    <path d="M5 17l14 0" />
  </svg>
)

const UnsnoozeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
  const hasProduction = doc.in_production || (doc.status === 'paid' && prodStat && prodStat.total > 0)
  if (hasProduction && prodStat && prodStat.completed < prodStat.total) return 'in_production'
  if (hasProduction && prodStat && prodStat.total > 0 && prodStat.completed >= prodStat.total) return 'production_complete'
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
  const [showArchiveModal, setShowArchiveModal] = useState<{ type: 'document' | 'submission'; id: string } | null>(null)
  const [archiveReason, setArchiveReason] = useState<'won' | 'cold'>('cold')
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'NORMAL', due_date: '' })
  const [queueFilter, setQueueFilter] = useState<string>('action_needed')
  const [productionSubTab, setProductionSubTab] = useState<string>('all')

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

  const getTodoActions = (docId: string) => (actionsByDocId.get(docId) || []).filter(a => a.status === 'TODO')
  const getSubTodoActions = (subId: string) => (actionsBySubId.get(subId) || []).filter(a => a.status === 'TODO')

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

  // Archive a document
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

  // Archive a submission
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

  // Snooze/unsnooze a document or submission
  const toggleSnooze = async (entityId: string, entityType: 'submission' | 'quote' | 'invoice', currentSnoozed: boolean) => {
    const newSnoozed = !currentSnoozed
    const apiType = entityType === 'submission' ? 'submission' : 'document'

    // Optimistic update
    if (entityType === 'submission') {
      setData(d => ({ ...d, submissions: d.submissions.map(s => s.id === entityId ? { ...s, snoozed: newSnoozed, snoozed_at: newSnoozed ? new Date().toISOString() : undefined } : s) }))
    } else {
      setData(d => ({
        ...d,
        quotes: d.quotes.map(q => q.id === entityId ? { ...q, snoozed: newSnoozed, snoozed_at: newSnoozed ? new Date().toISOString() : undefined } : q),
        invoices: d.invoices.map(i => i.id === entityId ? { ...i, snoozed: newSnoozed, snoozed_at: newSnoozed ? new Date().toISOString() : undefined } : i),
      }))
    }

    try {
      const res = await fetch('/api/documents/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entityId, type: apiType, snoozed: newSnoozed })
      })
      if (!res.ok) console.error('Failed to toggle snooze:', await res.text())
      else router.refresh()
    } catch (err) {
      console.error('Failed to toggle snooze:', err)
    }
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

  // ========================================================================
  // BUILD ACTION QUEUE - Flatten all active items into a single sorted list
  // ========================================================================
  const activeQuotes = data.quotes.filter(q => q.bucket !== 'COLD')
  const activeInvoices = data.invoices.filter(i => i.bucket !== 'COLD')
  const manualTasks = data.tasks.filter(t => t.status !== 'COMPLETED')

  const actionQueue: ActionQueueItem[] = []

  // Add submissions
  for (const sub of data.submissions) {
    const todoActions = getSubTodoActions(sub.id)
    const nextAction = todoActions.sort((a, b) => a.sort_order - b.sort_order)[0]
    const vehicle = sub.vehicles && sub.vehicles.length > 0
      ? sub.vehicles.length === 1
        ? [sub.vehicles[0].year, sub.vehicles[0].make, sub.vehicles[0].model].filter(Boolean).join(' ') || sub.vehicles[0].type_label
        : `${sub.vehicles.length} vehicles`
      : [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(' ')
    const desc = [vehicle, sub.coverage_type || sub.project_type].filter(Boolean).join(' \u2022 ')

    actionQueue.push({
      id: `sub-${sub.id}`,
      entityId: sub.id,
      type: 'submission',
      state: nextAction ? 'action_needed' : 'idle',
      customerName: sub.customer_name,
      projectDescription: desc || 'New submission',
      category: sub.coverage_type || sub.project_type,
      total: sub.price_range_max > 0 ? sub.price_range_max : undefined,
      nextAction: nextAction ? (stepLabels[nextAction.step_key] || nextAction.title) : 'Up to date',
      nextActionId: nextAction?.id,
      canComplete: !!nextAction,
      priority: nextAction ? 0 : 4,
      snoozed: !!sub.snoozed,
    })
  }

  // Add quotes
  for (const doc of activeQuotes) {
    const todoActions = getTodoActions(doc.id)
    const state = getCardState(doc, todoActions, data.productionStatus)
    const nextAction = todoActions.sort((a, b) => a.sort_order - b.sort_order)[0]
    const sentDate = doc.sent_at ? new Date(doc.sent_at) : null
    const daysWaiting = sentDate ? Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined

    let nextActionText = 'Up to date'
    let nextActionId: string | undefined
    let canComplete = false

    if (nextAction) {
      nextActionText = stepLabels[nextAction.step_key] || nextAction.title
      nextActionId = nextAction.id
      canComplete = true
    } else if (state === 'waiting') {
      nextActionText = doc.status === 'viewed'
        ? `Customer viewed${daysWaiting !== undefined ? ` \u2022 ${daysWaiting}d ago` : ''}`
        : `Sent${daysWaiting !== undefined ? ` \u2022 ${daysWaiting}d waiting` : ''}`
    }

    const stateOrderMap: Record<string, number> = { 'action_needed': 0, 'production_complete': 1, 'in_production': 2, 'waiting': 3, 'idle': 4 }

    actionQueue.push({
      id: `quote-${doc.id}`,
      entityId: doc.id,
      type: 'quote',
      state,
      customerName: doc.customer_name,
      projectDescription: doc.vehicle_description || doc.project_description || '',
      category: doc.category,
      docNumber: doc.doc_number,
      total: doc.total,
      nextAction: nextActionText,
      nextActionId,
      canComplete,
      waitingDays: daysWaiting,
      parentCategories: data.productionDocCategories[doc.id] || [],
      dueDate: doc.due_date || undefined,
      viewed: doc.status === 'viewed',
      priority: stateOrderMap[state] ?? 4,
      snoozed: !!doc.snoozed,
    })
  }

  // Add invoices
  for (const doc of activeInvoices) {
    const todoActions = getTodoActions(doc.id)
    const state = getCardState(doc, todoActions, data.productionStatus)
    const prodStat = data.productionStatus[doc.id]
    const nextProdTask = data.nextProductionTasks[doc.id]
    const nextAction = todoActions.sort((a, b) => a.sort_order - b.sort_order)[0]

    let nextActionText = 'Up to date'
    let nextActionId: string | undefined
    let canComplete = false

    if (state === 'production_complete' && nextAction) {
      nextActionText = stepLabels[nextAction.step_key] || nextAction.title
      nextActionId = nextAction.id
      canComplete = true
    } else if (state === 'in_production' && nextProdTask) {
      nextActionText = nextProdTask.title
    } else if (nextAction) {
      nextActionText = stepLabels[nextAction.step_key] || nextAction.title
      nextActionId = nextAction.id
      canComplete = true
    }

    const stateOrderMap: Record<string, number> = { 'action_needed': 0, 'production_complete': 1, 'in_production': 2, 'waiting': 3, 'idle': 4 }

    actionQueue.push({
      id: `invoice-${doc.id}`,
      entityId: doc.id,
      type: 'invoice',
      state,
      customerName: doc.customer_name,
      projectDescription: doc.vehicle_description || doc.project_description || '',
      category: doc.category,
      docNumber: doc.doc_number,
      total: doc.total,
      nextAction: nextActionText,
      nextActionId,
      canComplete,
      productionProgress: prodStat,
      parentCategories: data.productionDocCategories[doc.id] || [],
      dueDate: doc.due_date || undefined,
      priority: stateOrderMap[state] ?? 4,
      snoozed: !!doc.snoozed,
    })
  }

  // Add manual tasks
  for (const t of manualTasks) {
    actionQueue.push({
      id: `task-${t.id}`,
      entityId: t.id,
      type: 'task',
      state: 'action_needed',
      customerName: t.title,
      projectDescription: t.description || '',
      nextAction: t.title,
      nextActionId: t.id,
      canComplete: true,
      priority: t.priority === 'URGENT' ? -1 : t.priority === 'HIGH' ? 0 : 1,
    })
  }

  // Sort: by priority (lower = more urgent), then by state
  actionQueue.sort((a, b) => a.priority - b.priority)

  // Separate snoozed items from active queue
  const snoozedQueue = actionQueue.filter(item => item.snoozed)
  const activeQueue = actionQueue.filter(item => !item.snoozed)

  // Filter
  let filteredQueue = queueFilter === 'snoozed'
    ? snoozedQueue
    : queueFilter === 'all'
      ? activeQueue
      : activeQueue.filter(item => item.state === queueFilter)

  // Apply production sub-tab filtering
  if (queueFilter === 'in_production' && productionSubTab !== 'all') {
    if (productionSubTab === 'completed') {
      filteredQueue = activeQueue.filter(item => item.state === 'production_complete')
    } else {
      filteredQueue = filteredQueue.filter(item => {
        const cats = item.parentCategories || []
        switch (productionSubTab) {
          case 'automotive': return cats.includes('AUTOMOTIVE')
          case 'signage': return cats.includes('SIGNAGE')
          case 'apparel': return cats.includes('APPAREL')
          case 'dtf': return cats.includes('DTF_TRANSFER') || cats.includes('DTF')
          case 'embroidery': return cats.includes('EMBROIDERY')
          default: return true
        }
      })
    }
  }

  // Count by state for filter badges (only non-snoozed items)
  const stateCounts = activeQueue.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const maxCategoryValue = Math.max(...data.categoryBreakdown.map(c => c.amount), 1)

  // Navigation helpers
  const navigateToItem = (item: ActionQueueItem) => {
    if (item.type === 'submission') router.push(`/submissions?id=${item.entityId}`)
    else if (item.type === 'task') { setSelectedTask(manualTasks.find(t => t.id === item.entityId) || null); setShowTaskDetailModal(true) }
    else router.push(`/documents/${item.entityId}`)
  }

  const handleComplete = (item: ActionQueueItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.type === 'task') {
      completeTask(item.entityId, e)
    } else if (item.nextActionId) {
      completeCustomerAction(item.nextActionId, e)
    }
  }

  // State colors and labels
  const stateConfig: Record<string, { label: string; color: string; bg: string }> = {
    'action_needed': { label: 'Action Needed', color: '#d71cd1', bg: 'rgba(215, 28, 209, 0.08)' },
    'production_complete': { label: 'Production Complete', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)' },
    'in_production': { label: 'In Production', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)' },
    'waiting': { label: 'Waiting on Customer', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)' },
    'idle': { label: 'Up to Date', color: '#64748b', bg: 'rgba(100, 116, 139, 0.06)' },
  }

  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
    'submission': { label: 'Submission', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    'quote': { label: 'Quote', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    'invoice': { label: 'Invoice', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    'task': { label: 'Task', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  }

  // Snoozed state config for rendering
  const snoozedStateConfig = { label: 'Snoozed', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' }

  // Group queue items by state for rendering
  const stateGroups: { state: string; items: ActionQueueItem[] }[] = []
  if (queueFilter === 'snoozed') {
    if (filteredQueue.length > 0) stateGroups.push({ state: 'snoozed', items: filteredQueue })
  } else {
    const stateRenderOrder = ['action_needed', 'production_complete', 'in_production', 'waiting', 'idle']
    for (const s of stateRenderOrder) {
      const items = filteredQueue.filter(item => item.state === s)
      if (items.length > 0) stateGroups.push({ state: s, items })
    }
  }

  return (
    <div>
      {/* Action Queue */}
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
            Action Queue
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', padding: '2px 8px', background: 'rgba(148,163,184,0.1)', borderRadius: '6px' }}>
              {activeQueue.length} active
            </span>
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

        {/* Filter Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '12px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          overflowX: 'auto'
        }}>
          {[
            { key: 'all', label: 'All', count: activeQueue.length, color: '#94a3b8' },
            { key: 'action_needed', label: 'Action Needed', count: stateCounts['action_needed'] || 0, color: '#d71cd1' },
            { key: 'production_complete', label: 'Complete', count: stateCounts['production_complete'] || 0, color: '#22c55e' },
            { key: 'in_production', label: 'In Production', count: stateCounts['in_production'] || 0, color: '#a855f7' },
            { key: 'waiting', label: 'Waiting', count: stateCounts['waiting'] || 0, color: '#3b82f6' },
            { key: 'idle', label: 'Up to Date', count: stateCounts['idle'] || 0, color: '#64748b' },
            { key: 'snoozed', label: 'Snoozed', count: snoozedQueue.length, color: '#f59e0b' },
          ].filter(f => f.key === 'all' || f.count > 0).map(f => (
            <button key={f.key} onClick={() => { setQueueFilter(f.key); if (f.key !== 'in_production') setProductionSubTab('all') }} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: queueFilter === f.key ? `${f.color}20` : 'transparent',
              color: queueFilter === f.key ? f.color : '#64748b',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}>
              {f.label}
              <span style={{
                fontSize: '11px', padding: '1px 6px', borderRadius: '6px',
                background: queueFilter === f.key ? `${f.color}30` : 'rgba(148,163,184,0.1)',
                color: queueFilter === f.key ? f.color : '#4b5563'
              }}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* Production Sub-Tabs */}
        {queueFilter === 'in_production' && (
          <div style={{
            display: 'flex', gap: '4px', padding: '8px 20px 4px',
            borderBottom: '1px solid rgba(148,163,184,0.06)',
          }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'automotive', label: 'Automotive', color: '#a855f7' },
              { key: 'signage', label: 'Signage', color: '#14b8a6' },
              { key: 'apparel', label: 'Apparel', color: '#3b82f6' },
              { key: 'dtf', label: 'DTF', color: '#22d3ee' },
              { key: 'embroidery', label: 'Embroidery', color: '#ec4899' },
              { key: 'completed', label: 'Completed', color: '#22c55e' },
            ].map(tab => {
              const isActive = productionSubTab === tab.key
              const c = tab.color || '#a855f7'
              return (
                <button key={tab.key} onClick={() => setProductionSubTab(tab.key)}
                  style={{
                    padding: '5px 14px', borderRadius: '6px', border: 'none',
                    background: isActive ? `${c}20` : 'transparent',
                    color: isActive ? c : '#475569',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                    borderBottom: isActive ? `2px solid ${c}` : '2px solid transparent',
                  }}>
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Queue Items */}
        <div style={{ padding: '8px 12px 12px' }}>
          {stateGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563' }}>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>No items match this filter</div>
              <div style={{ fontSize: '12px' }}>Try selecting a different filter above</div>
            </div>
          ) : stateGroups.map(group => {
            const cfg = group.state === 'snoozed' ? snoozedStateConfig : stateConfig[group.state]
            return (
              <div key={group.state} style={{ marginBottom: '4px' }}>
                {/* State group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 8px 6px', marginTop: '4px'
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: cfg.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${cfg.color}60`
                  }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#4b5563' }}>{group.items.length}</span>
                  <div style={{ flex: 1, height: '1px', background: `${cfg.color}15` }} />
                </div>

                {/* Items */}
                {group.items.map(item => (
                  <ActionQueueRow
                    key={item.id}
                    item={item}
                    stateConfig={group.state === 'snoozed' ? (stateConfig[item.state] || cfg) : cfg}
                    typeConfig={typeConfig[item.type]}
                    onClick={() => navigateToItem(item)}
                    onComplete={item.canComplete ? (e) => handleComplete(item, e) : undefined}
                    onArchive={
                      item.type === 'submission' ? () => setShowArchiveModal({ type: 'submission', id: item.entityId })
                      : item.type !== 'task' ? () => setShowArchiveModal({ type: 'document', id: item.entityId })
                      : undefined
                    }
                    onSnooze={item.type !== 'task' ? () => toggleSnooze(item.entityId, item.type as 'submission' | 'quote' | 'invoice', !!item.snoozed) : undefined}
                    isSnoozed={!!item.snoozed}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Snapshot Metrics */}
      <div style={{
        background: '#111111', border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '16px' }}>Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
          {[
            { value: data.metrics.monthlyRevenue, label: `${new Date().toLocaleString('default', { month: 'short' })} Revenue`, color: '#d71cd1' },
            { value: data.metrics.commissionPool, label: 'Commission Pool', color: '#d71cd1' },
            { value: Math.round(data.metrics.bonus25Pct), label: '2.5% Bonus', color: '#22c55e' },
            { value: Math.round(data.metrics.embroideryBonus10Pct), label: 'Embroidery 10%', color: '#06b6d4' },
            { value: data.metrics.yearlyRevenue, label: `${new Date().getFullYear()} YTD`, color: '#a855f7' },
          ].map(m => (
            <div key={m.label} style={{ padding: '16px', background: '#1d1d1d', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: m.color, marginBottom: '4px' }}>${m.value.toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expected Revenue */}
      {data.expectedRevenue.length > 0 && (() => {
        const expectedTotal = data.expectedRevenue.reduce((sum, d) => sum + d.balance_due, 0)
        return (
          <div style={{
            background: '#111111', border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '16px', padding: '20px', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#22c55e' }}>Expected Revenue</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{data.expectedRevenue.length} job{data.expectedRevenue.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Confirmed jobs waiting on payment — scheduled, in progress, or completed work we expect to collect on.</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e', marginBottom: '16px' }}>
              ${expectedTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.expectedRevenue.map(d => (
                <div key={d.id}
                  onClick={() => router.push(`/documents/${d.id}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#1d1d1d', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1d1d1d')}
                >
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>#{d.doc_number}</span>
                    <span style={{ color: '#f1f5f9', fontSize: '13px', marginLeft: '8px' }}>{d.customer_name}</span>
                  </div>
                  <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>${d.balance_due.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

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
                <div style={{ minWidth: '80px', maxWidth: '120px', fontSize: '13px', color: '#94a3b8', flexShrink: 0 }}>{formatCategoryLabel(cat.category)}</div>
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
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', margin: '16px' }}
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
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '500px', margin: '16px' }}
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
          <div style={{ background: '#111111', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', width: '100%', maxWidth: '500px', margin: '16px' }}
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
// ACTION QUEUE ROW - Single flat row for each project
// ============================================================================

function ActionQueueRow({ item, stateConfig, typeConfig, onClick, onComplete, onArchive, onSnooze, isSnoozed }: {
  item: ActionQueueItem
  stateConfig: { label: string; color: string; bg: string }
  typeConfig: { label: string; color: string; bg: string }
  onClick: () => void
  onComplete?: (e: React.MouseEvent) => void
  onArchive?: () => void
  onSnooze?: () => void
  isSnoozed?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', margin: '0 0 4px',
        background: hovered ? 'rgba(148,163,184,0.05)' : 'transparent',
        borderRadius: '10px', cursor: 'pointer',
        border: `1px solid ${hovered ? `${stateConfig.color}30` : 'transparent'}`,
        transition: 'all 0.15s ease',
        flexWrap: 'wrap'
      }}
    >
      {/* Complete button */}
      {onComplete ? (
        <button onClick={onComplete} style={{
          width: '24px', height: '24px', borderRadius: '7px',
          border: `2px solid ${stateConfig.color}`,
          background: 'transparent', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          color: stateConfig.color, transition: 'all 0.15s', padding: 0
        }}
          onMouseEnter={e => { e.currentTarget.style.background = stateConfig.color; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = stateConfig.color }}
        >
          <CheckIcon />
        </button>
      ) : (
        <div style={{
          width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${stateConfig.color}15`
        }}>
          {item.state === 'waiting' && <EyeIcon viewed={item.viewed || false} size={14} />}
          {item.state === 'in_production' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stateConfig.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
          {item.state === 'idle' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stateConfig.color} strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}

      {/* Customer & Project Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{
            fontSize: '14px', fontWeight: 600, color: '#f1f5f9',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {item.customerName}
          </span>
          {/* Type badge */}
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
            background: typeConfig.bg, color: typeConfig.color, flexShrink: 0, letterSpacing: '0.2px'
          }}>
            {typeConfig.label}{item.docNumber ? ` #${item.docNumber}` : ''}
          </span>
          {/* Category badge */}
          {item.category && (
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(148,163,184,0.1)', color: '#64748b', flexShrink: 0
            }}>
              {formatCategoryLabel(item.category)}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.projectDescription}
        </div>
      </div>

      {/* Due Date */}
      {item.dueDate && (() => {
        const due = new Date(item.dueDate + 'T00:00:00')
        const now = new Date(); now.setHours(0, 0, 0, 0)
        const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
        const color = daysLeft <= 0 ? '#ef4444' : daysLeft <= 2 ? '#ef4444' : daysLeft <= 4 ? '#f59e0b' : '#64748b'
        const text = daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d`
        return (
          <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color }}>{text}</div>
          </div>
        )
      })()}

      {/* Next Action - THE KEY PIECE */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', borderRadius: '8px',
        background: stateConfig.bg,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '13px', fontWeight: 600, color: stateConfig.color,
        }}>
          {item.nextAction}
        </span>
      </div>

      {/* Production progress bar (inline) */}
      {item.productionProgress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, width: '80px' }}>
          <div style={{ flex: 1, height: '5px', background: '#282a30', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '3px',
              width: `${(item.productionProgress.completed / item.productionProgress.total) * 100}%`,
              background: 'linear-gradient(90deg, #a855f7, #8b5cf6)',
              transition: 'width 0.4s ease'
            }} />
          </div>
          <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 600, flexShrink: 0 }}>
            {item.productionProgress.completed}/{item.productionProgress.total}
          </span>
        </div>
      )}

      {/* Amount */}
      {item.total !== undefined && (
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#22c55e', flexShrink: 0, minWidth: '60px', textAlign: 'right' }}>
          ${item.total.toLocaleString()}
        </div>
      )}

      {/* Snooze button */}
      {onSnooze && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onSnooze() }}
          title={isSnoozed ? 'Unsnooze' : 'Snooze'}
          style={{
            background: 'transparent', border: 'none',
            color: isSnoozed ? '#f59e0b' : '#4b5563',
            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
            flexShrink: 0, transition: 'color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'}
          onMouseLeave={e => e.currentTarget.style.color = isSnoozed ? '#f59e0b' : '#4b5563'}
        >
          {isSnoozed ? <UnsnoozeIcon /> : <SnoozeIcon />}
        </button>
      )}

      {/* Archive button */}
      {onArchive && hovered && (
        <button onClick={(e) => { e.stopPropagation(); onArchive() }} style={{
          background: 'transparent', border: 'none', color: '#4b5563',
          cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
          flexShrink: 0, transition: 'color 0.15s'
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
        >
          <ArchiveIcon />
        </button>
      )}

      {/* Navigate arrow */}
      <div style={{ color: hovered ? stateConfig.color : '#333', flexShrink: 0, transition: 'color 0.15s' }}>
        <ChevronRightIcon />
      </div>
    </div>
  )
}
