'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

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
  project_description: string
  category: string
  total: number
  created_at: string
  sent_at?: string
  viewed_at?: string
  last_followup_at?: string
  followup_count?: number
}

type Submission = {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  status: string
  vehicle_category: string
  project_type: string
  price_range_min: number
  price_range_max: number
  created_at: string
}

type ActionItem = {
  id: string
  type: 'submission' | 'quote' | 'invoice' | 'task'
  actionType: 'new-lead' | 'followup' | 'schedule' | 'convert' | 'send' | 'task'
  customer: string
  details: string
  amount: number
  priority: number
  data: any
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
  pinnedItems: PinnedItem[]
  metrics: {
    monthlyRevenue: number
    ppfVinylRevenue: number
    pipelineValue: number
  }
  categoryBreakdown: { category: string; amount: number }[]
}

// Icons as components
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

const EyeIcon = ({ viewed }: { viewed: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={viewed ? '#a855f7' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const PinIcon = ({ pinned }: { pinned: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={pinned ? '#eab308' : 'none'} stroke={pinned ? '#eab308' : 'currentColor'} strokeWidth="2">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export default function CommandCenter({ initialData }: { initialData: DashboardData }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(initialData.pinnedItems)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'NORMAL',
    due_date: ''
  })

  // Build action items from all data sources
  const buildActionItems = (): ActionItem[] => {
    const items: ActionItem[] = []

    // New submissions (new leads)
    data.submissions
      .filter(s => s.status === 'new')
      .forEach(s => {
        items.push({
          id: `submission-${s.id}`,
          type: 'submission',
          actionType: 'new-lead',
          customer: s.customer_name,
          details: `${s.vehicle_category || ''} ${s.project_type || ''}`.trim() || 'New submission',
          amount: s.price_range_max || 0,
          priority: 100, // New leads are high priority
          data: s
        })
      })

    // Quotes needing action
    data.quotes.forEach(q => {
      // Draft quotes - need to send
      if (q.status === 'draft') {
        items.push({
          id: `quote-${q.id}`,
          type: 'quote',
          actionType: 'send',
          customer: q.customer_name,
          details: q.project_description || q.category || 'Quote',
          amount: q.total || 0,
          priority: 50,
          data: q
        })
      }
      // Approved quotes - convert to invoice
      if (q.status === 'approved') {
        items.push({
          id: `quote-${q.id}`,
          type: 'quote',
          actionType: 'convert',
          customer: q.customer_name,
          details: q.project_description || q.category || 'Quote',
          amount: q.total || 0,
          priority: 90,
          data: q
        })
      }
      // Sent quotes needing follow-up (sent > 3 days ago, not viewed)
      if (q.status === 'sent' && q.sent_at) {
        const sentDate = new Date(q.sent_at)
        const daysSinceSent = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceSent > 3) {
          items.push({
            id: `quote-${q.id}`,
            type: 'quote',
            actionType: 'followup',
            customer: q.customer_name,
            details: q.project_description || q.category || 'Quote',
            amount: q.total || 0,
            priority: 60 + Math.min(daysSinceSent, 30),
            data: q
          })
        }
      }
    })

    // Invoices needing action
    data.invoices.forEach(inv => {
      // Paid invoices - schedule installation
      if (inv.status === 'paid') {
        items.push({
          id: `invoice-${inv.id}`,
          type: 'invoice',
          actionType: 'schedule',
          customer: inv.customer_name,
          details: inv.project_description || inv.category || 'Invoice',
          amount: inv.total || 0,
          priority: 95,
          data: inv
        })
      }
    })

    // Tasks
    data.tasks
      .filter(t => t.status !== 'COMPLETED')
      .forEach(t => {
        let priority = 40
        if (t.priority === 'URGENT') priority = 100
        else if (t.priority === 'HIGH') priority = 80
        else if (t.priority === 'LOW') priority = 20

        items.push({
          id: `task-${t.id}`,
          type: 'task',
          actionType: 'task',
          customer: t.title,
          details: t.description || '',
          amount: 0,
          priority: priority,
          data: t
        })
      })

    // Sort by priority (highest first)
    items.sort((a, b) => b.priority - a.priority)

    return items
  }

  // Get waiting on customer items (sent/viewed quotes not yet approved)
  const getWaitingItems = (): Document[] => {
    return data.quotes.filter(q => q.status === 'sent' || q.status === 'viewed')
  }

  const actionItems = buildActionItems()
  const waitingItems = getWaitingItems()
  const waitingTotal = waitingItems.reduce((sum, q) => sum + (q.total || 0), 0)

  // Check if an item is pinned
  const isPinned = (type: string, id: string) => {
    return pinnedItems.some(p => p.item_type === type && p.item_id === id)
  }

  // Toggle pin status
  const togglePin = async (type: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const alreadyPinned = isPinned(type, id)

    if (alreadyPinned) {
      await supabase
        .from('pinned_items')
        .delete()
        .eq('item_type', type)
        .eq('item_id', id)
      setPinnedItems(pinnedItems.filter(p => !(p.item_type === type && p.item_id === id)))
    } else {
      await supabase
        .from('pinned_items')
        .insert({ item_type: type, item_id: id, pinned_at: new Date().toISOString() })
      setPinnedItems([...pinnedItems, { item_type: type, item_id: id }])
    }
  }

  // Handle clicking on an action item
  const handleItemClick = (item: ActionItem) => {
    if (item.type === 'task') {
      setSelectedTask(item.data)
      setShowTaskDetailModal(true)
    } else if (item.type === 'submission') {
      router.push(`/submissions?id=${item.data.id}`)
    } else {
      router.push(`/documents/${item.data.id}`)
    }
  }

  // Complete a task
  const completeTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    await supabase
      .from('tasks')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', taskId)

    setData({
      ...data,
      tasks: data.tasks.map(t => t.id === taskId ? { ...t, status: 'COMPLETED' } : t)
    })
    setShowTaskDetailModal(false)
  }

  // Create new task
  const createTask = async () => {
    if (!newTask.title.trim()) return

    const { data: created, error } = await supabase
      .from('tasks')
      .insert({
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        status: 'TO_DO',
        auto_generated: false
      })
      .select()
      .single()

    if (!error && created) {
      setData({ ...data, tasks: [...data.tasks, created] })
      setNewTask({ title: '', description: '', priority: 'NORMAL', due_date: '' })
      setShowAddTaskModal(false)
    }
  }

  // Delete task
  const deleteTask = async () => {
    if (!selectedTask) return
    
    await supabase.from('tasks').delete().eq('id', selectedTask.id)
    setData({ ...data, tasks: data.tasks.filter(t => t.id !== selectedTask.id) })
    setShowTaskDetailModal(false)
  }

  // Get action badge style
  const getActionBadgeStyle = (actionType: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      'schedule': { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
      'convert': { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' },
      'followup': { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' },
      'send': { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
      'new-lead': { bg: 'rgba(215, 28, 209, 0.15)', color: '#d71cd1' },
      'task': { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
    }
    return styles[actionType] || styles['task']
  }

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'schedule': 'Schedule Job',
      'convert': 'Convert',
      'followup': 'Follow Up',
      'send': 'Send',
      'new-lead': 'New Lead',
      'task': 'Task'
    }
    return labels[actionType] || 'Action'
  }

  // Separate pinned and unpinned items
  const pinnedActionItems = actionItems.filter(item => {
    const type = item.type === 'submission' ? 'submission' : item.type === 'task' ? 'task' : item.data.doc_type
    return isPinned(type, item.data.id)
  })
  const unpinnedActionItems = actionItems.filter(item => {
    const type = item.type === 'submission' ? 'submission' : item.type === 'task' ? 'task' : item.data.doc_type
    return !isPinned(type, item.data.id)
  })

  // Calculate max category value for progress bars
  const maxCategoryValue = Math.max(...data.categoryBreakdown.map(c => c.amount), 1)

  return (
    <div>
      {/* Customer Action Center */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
            <span style={{ color: '#d71cd1' }}><LightningIcon /></span>
            Customer Action Center
          </div>
          <button
            onClick={() => setShowAddTaskModal(true)}
            style={{
              padding: '8px 16px',
              background: '#d71cd1',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            + Add Task
          </button>
        </div>

        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
          {pinnedActionItems.length > 0 && (
            <>
              {pinnedActionItems.map((item, index) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  rank={index + 1}
                  isPinned={true}
                  onTogglePin={(e) => {
                    const type = item.type === 'submission' ? 'submission' : item.type === 'task' ? 'task' : item.data.doc_type
                    togglePin(type, item.data.id, e)
                  }}
                  onComplete={(e) => item.type === 'task' && completeTask(item.data.id, e)}
                  onClick={() => handleItemClick(item)}
                  getActionBadgeStyle={getActionBadgeStyle}
                  getActionLabel={getActionLabel}
                />
              ))}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                color: '#64748b',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Other Items
                <div style={{ flex: 1, height: '1px', background: 'rgba(148, 163, 184, 0.2)' }} />
              </div>
            </>
          )}
          
          {unpinnedActionItems.length > 0 ? (
            unpinnedActionItems.map((item, index) => (
              <ActionItemRow
                key={item.id}
                item={item}
                rank={pinnedActionItems.length + index + 1}
                isPinned={false}
                onTogglePin={(e) => {
                  const type = item.type === 'submission' ? 'submission' : item.type === 'task' ? 'task' : item.data.doc_type
                  togglePin(type, item.data.id, e)
                }}
                onComplete={(e) => item.type === 'task' && completeTask(item.data.id, e)}
                onClick={() => handleItemClick(item)}
                getActionBadgeStyle={getActionBadgeStyle}
                getActionLabel={getActionLabel}
              />
            ))
          ) : pinnedActionItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              No action items - you are all caught up!
            </div>
          )}
        </div>
      </div>

      {/* Waiting on Customer */}
      {waitingItems.length > 0 && (
        <div style={{
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              <span style={{ color: '#3b82f6' }}><ClockIcon /></span>
              Waiting on Customer
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>
              ${waitingTotal.toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {waitingItems.map(q => (
              <div
                key={q.id}
                onClick={() => router.push(`/documents/${q.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  background: '#1d1d1d',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <EyeIcon viewed={q.status === 'viewed'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.customer_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Quote #{q.doc_number}
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: '#94a3b8', flexShrink: 0 }}>
                  ${(q.total || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snapshot Metrics */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '16px' }}>
          Snapshot
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '16px', background: '#1d1d1d', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#d71cd1', marginBottom: '4px' }}>
              ${data.metrics.monthlyRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {new Date().toLocaleString('default', { month: 'short' })} Revenue
            </div>
          </div>
          <div style={{ padding: '16px', background: '#1d1d1d', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#d71cd1', marginBottom: '4px' }}>
              ${data.metrics.ppfVinylRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              PPF & Vinyl
            </div>
          </div>
          <div style={{ padding: '16px', background: '#1d1d1d', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e', marginBottom: '4px' }}>
              ${Math.round(data.metrics.ppfVinylRevenue * 0.025).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              2.5% Bonus
            </div>
          </div>
          <div style={{ padding: '16px', background: '#1d1d1d', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#06b6d4', marginBottom: '4px' }}>
              ${data.metrics.pipelineValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Pipeline Value
            </div>
          </div>
        </div>
      </div>

      {/* MTD by Category */}
      {data.categoryBreakdown.length > 0 && (
        <div style={{
          background: '#111111',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '16px' }}>
            MTD by Category
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.categoryBreakdown.map(cat => (
              <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '100px', fontSize: '13px', color: '#94a3b8', flexShrink: 0 }}>
                  {cat.category.replace(/_/g, ' ')}
                </div>
                <div style={{ flex: 1, height: '20px', background: '#1d1d1d', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(cat.amount / maxCategoryValue) * 100}%`,
                    background: 'linear-gradient(90deg, #d71cd1, #06b6d4)',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <div style={{ width: '80px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                  ${cat.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowAddTaskModal(false)}>
          <div style={{
            background: '#111111',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Add Task</div>
              <button
                onClick={() => setShowAddTaskModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Task Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="What needs to be done?"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    background: '#1d1d1d',
                    color: '#f1f5f9',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Optional details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    background: '#1d1d1d',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      background: '#1d1d1d',
                      color: '#f1f5f9',
                      fontSize: '14px'
                    }}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      background: '#1d1d1d',
                      color: '#f1f5f9',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '16px 20px',
              borderTop: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <button
                onClick={() => setShowAddTaskModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createTask}
                disabled={!newTask.title.trim()}
                style={{
                  padding: '10px 20px',
                  background: '#d71cd1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  opacity: newTask.title.trim() ? 1 : 0.5
                }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetailModal && selectedTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowTaskDetailModal(false)}>
          <div style={{
            background: '#111111',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>Task Details</div>
              <button
                onClick={() => setShowTaskDetailModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '20px', marginBottom: '8px' }}>{selectedTask.title}</h3>
              {selectedTask.description && (
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>{selectedTask.description}</p>
              )}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Priority</span>
                  <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedTask.priority}</p>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Status</span>
                  <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{selectedTask.status}</p>
                </div>
                {selectedTask.due_date && (
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Due Date</span>
                    <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{new Date(selectedTask.due_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '16px 20px',
              borderTop: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <button
                onClick={deleteTask}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowTaskDetailModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => completeTask(selectedTask.id)}
                  style={{
                    padding: '10px 20px',
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
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

// Action Item Row Component
function ActionItemRow({
  item,
  rank,
  isPinned,
  onTogglePin,
  onComplete,
  onClick,
  getActionBadgeStyle,
  getActionLabel
}: {
  item: ActionItem
  rank: number
  isPinned: boolean
  onTogglePin: (e: React.MouseEvent) => void
  onComplete: (e: React.MouseEvent) => void
  onClick: () => void
  getActionBadgeStyle: (type: string) => { bg: string; color: string }
  getActionLabel: (type: string) => string
}) {
  const [isHovered, setIsHovered] = useState(false)
  const badgeStyle = getActionBadgeStyle(item.actionType)
  const isUrgent = item.priority >= 90

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#1d1d1d',
        borderTop: `1px solid ${isHovered ? '#d71cd1' : 'rgba(148, 163, 184, 0.2)'}`,
        borderRight: `1px solid ${isHovered ? '#d71cd1' : 'rgba(148, 163, 184, 0.2)'}`,
        borderBottom: `1px solid ${isHovered ? '#d71cd1' : 'rgba(148, 163, 184, 0.2)'}`,
        borderLeft: isPinned ? '3px solid #eab308' : `1px solid ${isHovered ? '#d71cd1' : 'rgba(148, 163, 184, 0.2)'}`,
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: isHovered ? 'translateX(4px)' : 'none'
      }}
    >
      {/* Rank */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '13px',
        flexShrink: 0,
        background: isUrgent ? 'linear-gradient(135deg, #d71cd1, #ef4444)' : '#282a30',
        color: isUrgent ? 'white' : '#94a3b8'
      }}>
        {rank}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            background: badgeStyle.bg,
            color: badgeStyle.color
          }}>
            {getActionLabel(item.actionType)}
          </span>
          {item.type !== 'task' && (
            <span style={{
              fontSize: '11px',
              color: '#64748b',
              padding: '2px 8px',
              background: '#282a30',
              borderRadius: '4px'
            }}>
              {item.type === 'submission' ? 'Submission' : `${item.data.doc_type === 'quote' ? 'Quote' : 'Invoice'} #${item.data.doc_number}`}
            </span>
          )}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.customer}
        </div>
        {item.details && (
          <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.details}
          </div>
        )}
      </div>

      {/* Amount */}
      {item.amount > 0 && (
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>
          ${item.amount.toLocaleString()}
        </div>
      )}

      {/* Pin Button */}
      <button
        onClick={onTogglePin}
        style={{
          background: 'transparent',
          border: 'none',
          color: isPinned ? '#eab308' : '#64748b',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          transition: 'all 0.15s ease',
          flexShrink: 0
        }}
      >
        <PinIcon pinned={isPinned} />
      </button>

      {/* Complete Button (for tasks) */}
      {item.type === 'task' && (
        <button
          onClick={onComplete}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
            opacity: isHovered ? 1 : 0,
            flexShrink: 0
          }}
        >
          <CheckIcon />
        </button>
      )}

      {/* Arrow */}
      <div style={{ color: '#64748b', flexShrink: 0 }}>
        <ChevronRightIcon />
      </div>
    </div>
  )
}
